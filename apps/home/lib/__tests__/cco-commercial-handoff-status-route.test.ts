import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextResponse } from "next/server";
import { createFakeSupabase } from "./helpers/fake-supabase";
const controls = vi.hoisted(() => ({ denied: 0, throwGuard: false, actor: { actorType: "user", actorId: "operator", role: "ops_admin", permissions: ["quote_read", "invoice_read"], tenantBoundary: "internal_workspace", sessionPolicy: "operator_invite" }, initialized: 0, policy: null as unknown }));
let fake = createFakeSupabase();
vi.mock("@/lib/supabase", () => ({ getSupabase: () => { controls.initialized++; return fake.client; } }));
vi.mock("@/lib/platform-access", () => ({ createRoutePolicy: (p: unknown) => { controls.policy = p; return p; }, enforceRoutePolicy: async () => { if (controls.throwGuard)
        throw new Error("private auth diagnostic"); return controls.denied ? { ok: false, response: NextResponse.json({ error: "denied" }, { status: controls.denied }) } : { ok: true, actor: controls.actor }; } }));
import { GET } from "../../app/api/os/quotes/[id]/commercial-status/route";
const id = "11111111-1111-4111-8111-111111111111";
const call = (host = "admin.contentco-op.com", extra = {}) => GET(new Request(`https://admin.contentco-op.com/api/os/quotes/${id}/commercial-status`, { headers: { host, ...extra } }), { params: Promise.resolve({ id }) });
beforeEach(() => { fake = createFakeSupabase(); controls.initialized = 0; controls.denied = 0; controls.throwGuard = false; controls.actor = { actorType: "user", actorId: "operator", role: "ops_admin", permissions: ["quote_read", "invoice_read"], tenantBoundary: "internal_workspace", sessionPolicy: "operator_invite" }; });
describe("commercial status GET admission", () => {
    test.each([401, 403])("preserves policy rejection %s before service initialization", async (status) => { controls.denied = status; expect((await call()).status).toBe(status); expect(controls.initialized).toBe(0); });
    test.each(["contentco-op.com", "admin.astrocleanings.com", "admin.contentco-op.com.evil", "localhost"])("rejects wrong host %s before service initialization", async (host) => { expect((await call(host)).status).toBe(403); expect(controls.initialized).toBe(0); });
    test("conflicting forwarded authority is refused", async () => { expect((await call("admin.contentco-op.com", { "x-forwarded-host": "contentco-op.com" })).status).toBe(403); expect(controls.initialized).toBe(0); });
    test.each(["role", "actorType", "tenantBoundary", "sessionPolicy"])("rejects unsupported actor %s before service client", async (key) => { (controls.actor as Record<string, unknown>)[key] = "client_member"; expect((await call()).status).toBe(403); expect(controls.initialized).toBe(0); });
    test("requires both canonical read permissions", async () => { controls.actor.permissions = ["quote_read"]; expect((await call()).status).toBe(403); expect(controls.initialized).toBe(0); expect(controls.policy).toMatchObject({ requiredPermissions: ["quote_read", "invoice_read"] }); });
    test("invalid quote UUID does not initialize service client", async () => { const r = await GET(new Request("https://admin.contentco-op.com/api/os/quotes/x/commercial-status", { headers: { host: "admin.contentco-op.com" } }), { params: Promise.resolve({ id: "x" }) }); expect(r.status).toBe(400); expect(controls.initialized).toBe(0); });
    test("missing CC quote returns404 and disables cache", async () => { const r = await call(); expect(r.status).toBe(404); expect(r.headers.get("cache-control")).toBe("private, no-store"); });
    test("real adapter returns absent bridge and explicit unavailable proposal", async () => { fake.store.set("quotes", [{ id, business_unit: "CC" }]); const r = await call(); const data = await r.json(); expect(r.status).toBe(200); expect(data.status.quoteVersion.state).toBe("absent"); expect(data.status.proposalLineage.state).toBe("unavailable"); expect(data.quoteId).toBe(id); });
});
import { CommercialHandoffStatusView, fetchCommercialStatus, startCommercialStatusRead, commercialStatusForQuote } from "../../app/os/components/commercial-handoff-status";
import type { CommercialStatus } from "../cco-commercial-handoff-status";
const statusFixture = (): CommercialStatus => ({
    state: "available", authority: "CCO_OS", projection: "read_only",
    quoteVersion: { state: "available", estimateId: id, versionId: id, version: 1, frozenAt: "2026-10-03T12:00:00Z", snapshotSha256: "a".repeat(64), totalCents: 10000, depositDueCents: 5000, currency: "USD" },
    invoices: { state: "available", records: [{ id, href: `/os/invoices/${id}`, amountDueCents: 5000, amountPaidCents: 1000, balanceDueCents: 4000, recordedPaymentStatus: "partial", recordedDocumentStatus: "partially_paid", recordedCompletedPaymentCents: 1000, ledgerReconciliation: "agrees", providerConfirmation: "unavailable" }] },
    handoff: { state: "absent", reason: "No current-version handoff receipt recorded." },
    proposalLineage: { state: "unavailable", reason: "No verified proposal mapping." },
    nextAction: { kind: "inspect_invoice", href: `/os/invoices/${id}`, label: "Inspect invoice", reason: "Inspect recorded evidence." },
});
describe("commercial panel actual render and request behavior", () => {
    test("renders frozen amount, recorded ledger caveat and inspection-only invoice link", () => {
        const html = renderToStaticMarkup(React.createElement(CommercialHandoffStatusView, { status: statusFixture() }));
        expect(html).toContain("$100.00");
        expect(html).toContain("$40.00");
        expect(html).toContain(`/os/invoices/${id}`);
        expect(html).toContain("Provider confirmation unavailable");
        expect(html).toContain("Proposal lineage unavailable");
        expect(html).not.toContain("<button");
    });
    test("malformed next-action URL cannot inject a commercial action link", () => {
        const status = statusFixture();
        status.nextAction!.href = "https://evil.example/pay";
        const html = renderToStaticMarkup(React.createElement(CommercialHandoffStatusView, { status }));
        expect(html).not.toContain("evil.example");
    });
    test("unavailable invoice never renders zero-money balance", () => {
        const status = statusFixture();
        status.invoices = { state: "unavailable", reason: "Ledger unavailable" };
        const html = renderToStaticMarkup(React.createElement(CommercialHandoffStatusView, { status }));
        expect(html).toContain("Ledger unavailable");
        expect(html).not.toContain("$0.00");
    });
    test("late request after abort never delivers old-quote evidence", async () => {
        const controller = new AbortController();
        let resolve!: (r: Response) => void;
        const response = new Promise<Response>(r => { resolve = r; });
        const transport = vi.fn(() => response);
        const pending = fetchCommercialStatus(id, controller.signal, transport);
        controller.abort();
        resolve(Response.json({ quoteId: id, status: statusFixture() }));
        expect(await pending).toBeNull();
    });
    test("quote binding mismatch is rejected before display", async () => {
        const result = await fetchCommercialStatus(id, new AbortController().signal, async () => Response.json({ quoteId: "another", status: statusFixture() }));
        expect(result).toBeNull();
    });
    test("fetches only bound read GET with credentials and no cache", async () => {
        const transport = vi.fn(async () => Response.json({ quoteId: id, status: statusFixture() }));
        const signal = new AbortController().signal;
        expect((await fetchCommercialStatus(id, signal, transport))?.quoteVersion.state).toBe("available");
        expect(transport).toHaveBeenCalledWith(`/api/os/quotes/${id}/commercial-status`, { method: "GET", credentials: "same-origin", cache: "no-store", signal });
    });
});
test("thrown authentication backend returns redacted no-store503 before service init", async () => {
    controls.throwGuard = true;
    const r = await call();
    expect(r.status).toBe(503);
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(await r.text()).not.toContain("private auth");
    expect(controls.initialized).toBe(0);
});
test.each(["money", "records", "version", "nextAction"])("malformed response %s is refused instead of entering the panel", async (kind) => {
    const status = statusFixture();
    if (kind === "money" && status.invoices.state === "available")
        status.invoices.records[0].balanceDueCents = null as never;
    if (kind === "records" && status.handoff.state !== "available")
        status.handoff = { state: "available", records: [null as never] };
    if (kind === "version" && status.quoteVersion.state === "available")
        status.quoteVersion.currency = "invalid";
    if (kind === "nextAction")
        status.nextAction = "bad" as never;
    expect(await fetchCommercialStatus(id, new AbortController().signal, async () => Response.json({ quoteId: id, status }))).toBeNull();
});
test("abort during asynchronous JSON parse refuses the old quote", async () => {
    const controller = new AbortController();
    let resolve!: (v: unknown) => void;
    const json = new Promise(r => { resolve = r; });
    const transport = async () => ({ ok: true, json: () => json } as Response);
    const pending = fetchCommercialStatus(id, controller.signal, transport);
    await Promise.resolve();
    controller.abort();
    resolve({ quoteId: id, status: statusFixture() });
    expect(await pending).toBeNull();
});
describe("panel lifecycle read session", () => {
    test("disposed prior quote cannot overwrite the next quote result", async () => {
        let oldResolve!: (r: Response) => void;
        const old = new Promise<Response>(r => { oldResolve = r; });
        const onOld = vi.fn();
        const onNext = vi.fn();
        const stop = startCommercialStatusRead(id, onOld, () => old);
        stop();
        startCommercialStatusRead(id, onNext, async () => Response.json({ quoteId: id, status: statusFixture() }));
        oldResolve(Response.json({ quoteId: id, status: statusFixture() }));
        await vi.waitFor(() => expect(onNext).toHaveBeenCalledTimes(1));
        expect(onOld).not.toHaveBeenCalled();
    });
    test("quote switch clears previous display before the replacement fetch settles", () => {
        const saved = { quoteId: id, status: statusFixture() };
        expect(commercialStatusForQuote(saved, "22222222-2222-4222-8222-222222222222")).toBeNull();
        expect(commercialStatusForQuote(saved, id)?.quoteVersion.state).toBe("available");
    });
});
