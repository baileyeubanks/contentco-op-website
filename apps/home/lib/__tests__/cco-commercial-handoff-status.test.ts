import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { readCommercialHandoffStatus, type CommercialReadAccess } from "../cco-commercial-handoff-status";
import { createFakeSupabase, type FakeRow } from "./helpers/fake-supabase";
const quoteId = "11111111-1111-4111-8111-111111111111";
const estimateId = "22222222-2222-4222-8222-222222222222";
const versionId = "33333333-3333-4333-8333-333333333333";
const invoiceId = "44444444-4444-4444-8444-444444444444";
const projectId = "55555555-5555-4555-8555-555555555555";
const otherId = "66666666-6666-4666-8666-666666666666";
const access: CommercialReadAccess = { businessUnit: "CC", role: "ops_admin", permissions: ["quote_read", "invoice_read"] };
function stable(v: unknown): string {
    if (Array.isArray(v))
        return `[${v.map(stable).join(",")}]`;
    if (v && typeof v === "object")
        return `{${Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => `${JSON.stringify(k)}:${stable(x)}`).join(",")}}`;
    return JSON.stringify(v);
}
function fixture() {
    const fake = createFakeSupabase();
    const totals = { subtotal_cents: 10000, tax_cents: 0, total_cents: 10000, deposit_percent: 50, deposit_due_cents: 5000, balance_remaining_cents: 5000, currency: "USD" };
    const snapshot = { estimate: { id: estimateId, business_unit: "CC", legacy_quote_id: quoteId, estimate_number: "CC-EST-0001" }, line_items: [], totals, frozen_at: "2026-10-03T12:00:00Z" };
    const sha256 = createHash("sha256").update(stable(snapshot)).digest("hex");
    fake.store.set("quotes", [{ id: quoteId, business_unit: "CC", estimated_total: 999999 }]);
    fake.store.set("estimates", [{ id: estimateId, business_unit: "CC", legacy_quote_id: quoteId, active_version_id: versionId, internal_status: "approved", client_status: "approved", total_cents: 999999 }]);
    fake.store.set("estimate_versions", [{ id: versionId, estimate_id: estimateId, version: 1, frozen_at: snapshot.frozen_at, snapshot, sha256 }]);
    fake.store.set("invoices", [{ id: invoiceId, business_unit: "CC", estimate_id: estimateId, estimate_version_id: versionId, quote_id: quoteId, invoice_type: "deposit", invoice_number: "CC-INV-0001", amount_due_cents: 5000, amount_paid_cents: 1000, balance_due_cents: 4000, payment_status: "partial", document_status: "partially_paid" }]);
    fake.store.set("payments", [{ id: otherId, business_unit: "CC", invoice_id: invoiceId, estimate_id: estimateId, amount_cents: 1000, currency: "USD", status: "completed" }]);
    const commercialRef = { source: "cco_os", estimate_id: estimateId, estimate_version_id: versionId, estimate_number: "CC-EST-0001", version: 1, frozen_at: snapshot.frozen_at, snapshot_sha256: sha256, totals, idempotency_key: "cco:cc-est-0001:v1:A" };
    fake.store.set("commercial_handoffs", [{ id: otherId, estimate_id: estimateId, estimate_version_id: versionId, idempotency_key: commercialRef.idempotency_key, payload_hash: `sha256:${"a".repeat(64)}`, cvp_project_id: projectId, cvp_inquiry_id: otherId, receipt: { status: "created", estimateId, estimateVersionId: versionId, cvpProjectId: projectId, cvpInquiryId: otherId, idempotencyKey: commercialRef.idempotency_key, payloadHash: `sha256:${"a".repeat(64)}`, commercialRef } }]);
    const queries: string[] = [];
    const from = fake.client.from.bind(fake.client);
    const sb = { from(table: string) { queries.push(table); return from(table); } };
    const run = (a = access) => readCommercialHandoffStatus({ quoteId, access: a }, { sb: sb as never });
    return { fake, run, queries, sb, snapshot };
}
function row(f: ReturnType<typeof fixture>, table: string): FakeRow { return f.fake.store.get(table)![0]; }
describe("CCO commercial read status", () => {
    test("uses frozen cents and exact invoice graph; ledger is not provider proof", async () => {
        const f = fixture();
        const before = JSON.stringify([...f.fake.store]);
        const result = await f.run();
        expect(result.state).toBe("available");
        expect(result.quoteVersion).toMatchObject({ state: "available", estimateId, versionId, totalCents: 10000, depositDueCents: 5000 });
        expect(result.invoices).toMatchObject({ state: "available", records: [{ id: invoiceId, recordedPaymentStatus: "partial", balanceDueCents: 4000, recordedCompletedPaymentCents: 1000, providerConfirmation: "unavailable" }] });
        expect(result.handoff).toMatchObject({ state: "available", records: [{ projectId, projectAccess: "unverified", href: `https://co-videopro.com/projects/${projectId}` }] });
        expect(result.proposalLineage.state).toBe("unavailable");
        expect(result.nextAction?.href).toBe(`/os/invoices/${invoiceId}`);
        expect(JSON.stringify([...f.fake.store])).toBe(before);
        expect(f.queries).not.toContain("contacts");
    });
    test.each([
        { ...access, businessUnit: "ACS" },
        { ...access, role: "client_member" },
        { ...access, role: "internal_editor" },
        { ...access, permissions: ["quote_read"] },
    ])("rejects unadmitted access before touching any table %#", async (a) => {
        const f = fixture();
        expect((await f.run(a)).state).toBe("denied");
        expect(f.queries).toEqual([]);
    });
    test("rejects invalid document id before reads", async () => {
        const f = fixture();
        expect((await readCommercialHandoffStatus({ quoteId: "../invoice", access }, { sb: f.sb as never })).state).toBe("denied");
        expect(f.queries).toEqual([]);
    });
    test("foreign-company quote stops all dependent reads", async () => {
        const f = fixture();
        row(f, "quotes").business_unit = "ACS";
        expect((await f.run()).state).toBe("not_found");
        expect(f.queries).toEqual(["quotes"]);
    });
    test("missing and ambiguous CC estimate bridges stay distinct", async () => {
        const f = fixture();
        f.fake.store.set("estimates", []);
        expect((await f.run()).quoteVersion.state).toBe("absent");
        const g = fixture();
        g.fake.store.get("estimates")!.push({ ...row(g, "estimates"), id: otherId });
        expect((await g.run()).quoteVersion.state).toBe("unavailable");
        expect(g.queries).not.toContain("invoices");
    });
    test("foreign and unrelated bridges are excluded", async () => {
        const f = fixture();
        f.fake.store.get("estimates")!.push({ ...row(f, "estimates"), id: otherId, business_unit: "ACS" });
        expect((await f.run()).quoteVersion.state).toBe("available");
    });
    test.each(["estimate_id", "sha256", "total_cents", "currency"])("rejects invalid frozen authority %s", async (field) => {
        const f = fixture();
        const v = row(f, "estimate_versions");
        if (field === "estimate_id")
            v.estimate_id = otherId;
        else if (field === "sha256")
            v.sha256 = "b".repeat(64);
        else {
            (f.snapshot.totals as Record<string, unknown>)[field] = field === "currency" ? "" : null;
            v.sha256 = createHash("sha256").update(stable(f.snapshot)).digest("hex");
        }
        const r = await f.run();
        expect(r.quoteVersion.state).toBe("unavailable");
        expect(f.queries).not.toContain("payments");
        expect(r.nextAction).toBeNull();
    });
    test("unfrozen is absent without pretending invoice/receipt queries succeeded", async () => {
        const f = fixture();
        row(f, "estimates").active_version_id = null;
        const r = await f.run();
        expect(r.quoteVersion.state).toBe("absent");
        expect(r.invoices.state).toBe("unavailable");
        expect(f.queries).not.toContain("invoices");
    });
    test("stale and foreign invoices and their payments are excluded", async () => {
        const f = fixture();
        row(f, "invoices").estimate_version_id = otherId;
        expect((await f.run()).invoices.state).toBe("absent");
        expect(f.queries).not.toContain("payments");
    });
    test.each([null, -1, 1.2, Number.MAX_SAFE_INTEGER + 1])("invalid invoice cents never become zero (%s)", async (bad) => {
        const f = fixture();
        row(f, "invoices").balance_due_cents = bad;
        const r = await f.run();
        expect(r.invoices.state).toBe("unavailable");
        expect(r.nextAction?.href).not.toBe(`/os/invoices/${invoiceId}`);
    });
    test("invoice amount must reconcile to its immutable deposit authority", async () => {
        const f = fixture();
        row(f, "invoices").amount_due_cents = 9999;
        expect((await f.run()).invoices.state).toBe("unavailable");
    });
    test("foreign estimate payment cannot settle this invoice", async () => {
        const f = fixture();
        row(f, "payments").estimate_id = otherId;
        expect((await f.run()).invoices).toMatchObject({ state: "available", records: [{ recordedCompletedPaymentCents: 0, ledgerReconciliation: "disagrees" }] });
    });
    test("pending/failed payments are not completed ledger money", async () => {
        const f = fixture();
        row(f, "payments").status = "pending";
        const r = await f.run();
        expect(r.invoices).toMatchObject({ records: [{ recordedCompletedPaymentCents: 0, recordedPaymentStatus: "partial", providerConfirmation: "unavailable" }] });
    });
    test("null payment money leaves invoice evidence unavailable", async () => {
        const f = fixture();
        row(f, "payments").amount_cents = null;
        expect((await f.run()).invoices.state).toBe("unavailable");
    });
    test("receipt does not establish invoice issuance or payment", async () => {
        const f = fixture();
        f.fake.store.set("invoices", []);
        const r = await f.run();
        expect(r.invoices.state).toBe("absent");
        expect(r.handoff.state).toBe("available");
        expect(r.nextAction?.kind).toBe("inspect_recorded_project");
    });
    test.each(["estimateVersionId", "cvpProjectId", "snapshot_sha256", "total_cents"])("invalid receipt binding exposes no project link %s", async (key) => {
        const f = fixture();
        const receipt = row(f, "commercial_handoffs").receipt as Record<string, unknown>;
        if (key === "snapshot_sha256")
            (receipt.commercialRef as Record<string, unknown>)[key] = "a".repeat(64);
        else if (key === "total_cents")
            ((receipt.commercialRef as Record<string, unknown>).totals as Record<string, unknown>)[key] = 1;
        else
            receipt[key] = otherId;
        const r = await f.run();
        expect(r.handoff.state).toBe("unavailable");
        expect(JSON.stringify(r.handoff)).not.toContain("https://");
    });
    test.each(["quotes", "estimates", "estimate_versions", "invoices", "payments", "commercial_handoffs"])("read error on %s is unavailable, not absent", async (table) => {
        const f = fixture();
        const from = f.sb.from.bind(f.sb);
        const sb = { from(t: string) { if (t !== table)
                return from(t); const q = { select: () => q, eq: () => q, in: () => q, limit: () => q, then: (resolve: (r: unknown) => unknown) => Promise.resolve({ data: null, error: { message: "private diagnostic" } }).then(resolve) }; return q; } };
        const r = await readCommercialHandoffStatus({ quoteId, access }, { sb: sb as never });
        expect(JSON.stringify(r)).not.toContain("private diagnostic");
        expect([r.state, r.quoteVersion.state, r.invoices.state, r.handoff.state]).toContain("unavailable");
    });
});
// A hash is integrity evidence, not tenant or document admission.
describe("frozen snapshot identity admission", () => {
    test.each(["id", "business_unit", "legacy_quote_id", "missing"])("rehashed foreign/missing snapshot identity %s stops child reads", async (field) => {
        const f = fixture();
        const identity = f.snapshot.estimate as Record<string, unknown>;
        if (field === "missing")
            delete identity.id;
        else
            identity[field] = field === "business_unit" ? "ACS" : otherId;
        row(f, "estimate_versions").sha256 = createHash("sha256").update(stable(f.snapshot)).digest("hex");
        const r = await f.run();
        expect(r.quoteVersion.state).toBe("unavailable");
        expect(f.queries).not.toContain("invoices");
        expect(f.queries).not.toContain("commercial_handoffs");
    });
});
describe("complete commercial evidence and safe next actions", () => {
    test("multiple current invoices block project-next-action bypass", async () => {
        const f = fixture();
        f.fake.store.get("invoices")!.push({ ...row(f, "invoices"), id: projectId });
        const r = await f.run();
        expect(r.invoices.state).toBe("available");
        expect(r.nextAction).toBeNull();
    });
    test.each(["commercial_handoffs", "invoices", "payments"])("query sentinel overflow for %s stays unavailable", async (table) => {
        const f = fixture();
        const count = table === "payments" ? 101 : 21;
        const seed = row(f, table);
        f.fake.store.set(table, Array.from({ length: count }, (_, i) => ({ ...seed, id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}` })));
        const r = await f.run();
        expect(table === "commercial_handoffs" ? r.handoff.state : r.invoices.state).toBe("unavailable");
    });
    test("unbound manual and foreign-company ledger rows cannot increase completed amount", async () => {
        const f = fixture();
        f.fake.store.get("payments")!.push({ ...row(f, "payments"), id: projectId, estimate_id: null, currency: "CAD", amount_cents: 999999 }, { ...row(f, "payments"), id: invoiceId, business_unit: "ACS", amount_cents: 999999 });
        expect((await f.run()).invoices).toMatchObject({ records: [{ recordedCompletedPaymentCents: 1000, providerConfirmation: "unavailable" }] });
    });
    test("bound mixed-currency ledger is unavailable instead of aggregated", async () => {
        const f = fixture();
        row(f, "payments").currency = "CAD";
        expect((await f.run()).invoices.state).toBe("unavailable");
    });
    test("numeric strings and unsafe totals are unknown, never coerced", async () => {
        const f = fixture();
        row(f, "invoices").amount_paid_cents = "1000";
        expect((await f.run()).invoices.state).toBe("unavailable");
    });
    test("paid recorded invoice still has no provider-confirmed paid assertion", async () => {
        const f = fixture();
        Object.assign(row(f, "invoices"), { amount_paid_cents: 5000, balance_due_cents: 0, payment_status: "paid" });
        row(f, "payments").amount_cents = 5000;
        const r = await f.run();
        expect(r.invoices).toMatchObject({ records: [{ recordedPaymentStatus: "paid", providerConfirmation: "unavailable" }] });
        expect(r.nextAction?.kind).toBe("inspect_recorded_project");
    });
});
describe("exact-count exhaustion", () => {
    test.each([null, 2])("truncated or unavailable bridge count %s cannot imply uniqueness", async (count) => {
        const f = fixture();
        const from = f.sb.from.bind(f.sb);
        const sb = { from(table: string) { if (table !== "estimates")
                return from(table); const q = { select: () => q, eq: () => q, limit: () => q, then: (resolve: (r: unknown) => unknown) => Promise.resolve({ data: [row(f, "estimates")], error: null, count }).then(resolve) }; return q; } };
        const r = await readCommercialHandoffStatus({ quoteId, access }, { sb: sb as never });
        expect(r.quoteVersion.state).toBe("unavailable");
        expect(f.queries).not.toContain("invoices");
    });
});

describe("frozen timestamp instant integrity", () => {
    function timed(snapshotAt: string, rowAt = snapshotAt, refAt = snapshotAt) {
        const f = fixture();
        f.snapshot.frozen_at = snapshotAt;
        const v = row(f, "estimate_versions");
        v.frozen_at = rowAt;
        v.sha256 = createHash("sha256").update(stable(f.snapshot)).digest("hex");
        const receipt = row(f, "commercial_handoffs").receipt as Record<string, unknown>;
        const ref = receipt.commercialRef as Record<string, unknown>;
        ref.frozen_at = refAt;
        ref.snapshot_sha256 = v.sha256;
        return f;
    }
    test.each([
        ["2026-10-03T12:00:00.000Z", "2026-10-03T12:00:00+00:00", "2026-10-03T12:00:00.0Z"],
        ["2026-10-03T12:00:00.123Z", "2026-10-03T12:00:00.123000+00:00", "2026-10-03T12:00:00.1230Z"],
        ["2026-10-03T12:00:00.123400Z", "2026-10-03T12:00:00.1234+00:00", "2026-10-03T12:00:00.123400+00:00"],
        ["2026-10-03T12:00:00.000001Z", "2026-10-03T12:00:00.000001+00:00", "2026-10-03T12:00:00.000001Z"],
        ["2026-10-03T12:00:00Z", "2026-10-03T07:00:00-05:00", "2026-10-03T14:00:00+02:00"],
        ["2026-10-03T23:30:00.000Z", "2026-10-04T01:30:00+02:00", "2026-10-03T23:30:00.000000Z"],
        ["2024-02-29T12:00:00Z", "2024-02-29T12:00:00.000000+00:00", "2024-02-29T12:00:00Z"],
    ])("equivalent instants retain frozen hash and both evidence links (%s, %s, %s)", async (snapshotAt, rowAt, refAt) => {
        const f = timed(snapshotAt, rowAt, refAt);
        const hash = row(f, "estimate_versions").sha256;
        const before = JSON.stringify([...f.fake.store]);
        const r = await f.run();
        expect(r.quoteVersion).toMatchObject({ state: "available", frozenAt: rowAt, snapshotSha256: hash });
        expect(r.invoices.state).toBe("available");
        expect(r.handoff).toMatchObject({ state: "available", records: [{ projectId }] });
        expect(f.snapshot.frozen_at).toBe(snapshotAt);
        expect(row(f, "estimate_versions").sha256).toBe(hash);
        expect(JSON.stringify([...f.fake.store])).toBe(before);
    });
    test.each(["2026-10-03T12:00:00+00:00", "2026-10-03T12:00:00.000000Z"])("equivalent handoff-only timestamp %s retains its project receipt", async (refAt) => {
        const f = timed("2026-10-03T12:00:00.000Z", "2026-10-03T12:00:00.000Z", refAt);
        const before = JSON.stringify([...f.fake.store]);
        const r = await f.run();
        expect(r.quoteVersion.state).toBe("available");
        expect(r.handoff).toMatchObject({ state: "available", records: [{ projectId }] });
        expect(JSON.stringify([...f.fake.store])).toBe(before);
    });
    test.each([
        "2026-10-03T12:00:01Z",
        "2026-10-03T12:00:00.124Z",
        "2026-10-03T12:00:00.123401Z",
        "2026-10-03T12:00:00.1234001Z",
        "2026-10-03T12:00:00+24:00",
        "2026-10-03T12:00:00",
        "invalid",
    ])("different or invalid row instant %s stops child reads", async (rowAt) => {
        const f = timed("2026-10-03T12:00:00.123400Z", rowAt);
        const r = await f.run();
        expect(r.quoteVersion.state).toBe("unavailable");
        expect(f.queries).not.toContain("invoices");
        expect(f.queries).not.toContain("commercial_handoffs");
        expect(r.nextAction).toBeNull();
    });
    test.each([
        "2026-02-30T12:00:00Z", "2026-02-29T12:00:00Z", "2026-10-03T24:00:00Z",
        "2026-10-03T12:00:00.1230000Z", "2026-10-03T12:00:00.1230001Z",
        "2026-10-03T12:00:00", "invalid",
    ])("identical invalid or unsupported-precision timestamps %s never establish authority", async (at) => {
        const f = timed(at);
        const r = await f.run();
        expect(r.quoteVersion.state).toBe("unavailable");
        expect(f.queries).not.toContain("invoices");
        expect(f.queries).not.toContain("commercial_handoffs");
    });
    test.each([
        "2026-10-03T12:00:01Z", "2026-10-03T12:00:00.123401Z",
        "2026-10-03T12:00:00.1234001Z", "2026-10-03T12:00:00", "invalid",
    ])("different or invalid handoff reference instant %s exposes no project receipt", async (refAt) => {
        const f = timed("2026-10-03T12:00:00.123400Z", "2026-10-03T12:00:00.123400Z", refAt);
        const r = await f.run();
        expect(r.quoteVersion.state).toBe("available");
        expect(r.invoices.state).toBe("available");
        expect(r.handoff.state).toBe("unavailable");
        expect(JSON.stringify(r.handoff)).not.toContain("https://");
    });
});
