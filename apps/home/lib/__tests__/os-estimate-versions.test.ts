import { beforeEach, describe, expect, test, vi } from "vitest";
import { createFakeSupabase, fakeUuid, type FakeRow, type FakeSupabase } from "./helpers/fake-supabase";

let fake: FakeSupabase;

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => fake.client,
  supabase: new Proxy({}, { get: (_target, prop) => (fake.client as never as Record<PropertyKey, unknown>)[prop] }),
}));

vi.mock("@/lib/os-document-artifacts", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/os-document-artifacts")>();
  return {
    ...mod,
    createDocumentArtifacts: vi.fn(async () => ({ artifacts: [], pdfPath: "", docxPath: "" })),
  };
});

import {
  convertEstimateToDepositInvoice,
  recordEstimateDecision,
  sendEstimate,
} from "../os-commercial-pipeline";
import { canSendEstimate } from "../os-estimates";
import {
  buildEstimateVersionArtifactPayload,
  buildEstimateVersionSnapshot,
  getFrozenEstimateForLegacyQuote,
  hashEstimateVersionSnapshot,
  resolveFrozenDepositAmountCents,
  type EstimateVersionSnapshot,
} from "../os-estimate-versions";

const ESTIMATE_ID = "11111111-1111-4111-8111-111111111111";
const QUOTE_ID = "22222222-2222-4222-8222-222222222222";
const BRIEF_ID = "33333333-3333-4333-8333-333333333333";

function seedEstimateRow(overrides: FakeRow = {}): FakeRow {
  return {
    id: ESTIMATE_ID,
    business_unit: "CC",
    brief_id: BRIEF_ID,
    contact_id: null,
    legacy_quote_id: QUOTE_ID,
    estimate_number: "CC-EST-2026-0007",
    document_version: 1,
    currency: "USD",
    subtotal_cents: 500000,
    tax_cents: 0,
    total_cents: 500000,
    deposit_percent: 50,
    deposit_due_cents: 250000,
    balance_remaining_cents: 250000,
    payment_terms: "50% deposit due before scheduling.",
    internal_status: "draft",
    client_status: "not_sent",
    approval_status: "not_required",
    scope_snapshot: { recommendation: { next_step: "Approve estimate." } },
    pricing_snapshot: { deposit_percent: 50 },
    active_version_id: null,
    ...overrides,
  };
}

function seedLineItems(): FakeRow[] {
  return [
    {
      id: fakeUuid(),
      estimate_id: ESTIMATE_ID,
      phase_name: "Production",
      line_type: "production_labor",
      description: "Main edit",
      quantity: 1,
      unit: "project",
      unit_price_cents: 500000,
      line_total_cents: 500000,
      sort_order: 10,
    },
  ];
}

function seedEstimateDraft(overrides: FakeRow = {}) {
  const estimate = seedEstimateRow(overrides);
  fake.store.set("estimates", [estimate]);
  fake.store.set("estimate_line_items", seedLineItems());
  fake.store.set("quotes", [{ id: QUOTE_ID, deposit_amount_cents: 250000, payload: { estimate_id: ESTIMATE_ID } }]);
  return estimate;
}

function seedSentEstimateUnfrozen(overrides: FakeRow = {}) {
  return seedEstimateDraft({ internal_status: "sent", client_status: "sent", ...overrides });
}

async function freezeViaSend() {
  const result = await sendEstimate({ estimateId: ESTIMATE_ID });
  expect(result.error).toBeNull();
  const estimate = fake.store.get("estimates")![0];
  const versions = fake.store.get("estimate_versions") || [];
  return { result, estimate, versions };
}

beforeEach(() => {
  fake = createFakeSupabase();
});

describe("freeze-on-send (task 2.5)", () => {
  test("sendEstimate freezes version 1 and binds it to the estimate", async () => {
    fake.store.set("estimates", [seedEstimateRow()]);
    fake.store.set("estimate_line_items", seedLineItems());

    const { estimate, versions } = await freezeViaSend();

    expect(versions).toHaveLength(1);
    expect(versions[0].estimate_id).toBe(ESTIMATE_ID);
    expect(versions[0].version).toBe(1);
    expect(estimate.active_version_id).toBe(versions[0].id);
    expect(estimate.internal_status).toBe("sent");

    const snapshot = versions[0].snapshot as Record<string, unknown>;
    expect(snapshot.totals).toEqual({
      subtotal_cents: 500000,
      tax_cents: 0,
      total_cents: 500000,
      deposit_percent: 50,
      deposit_due_cents: 250000,
      balance_remaining_cents: 250000,
      currency: "USD",
    });
    expect((snapshot.line_items as FakeRow[])[0].description).toBe("Main edit");
    expect(String(versions[0].sha256)).toMatch(/^[0-9a-f]{64}$/);
    expect(versions[0].sha256).toBe(hashEstimateVersionSnapshot(snapshot));
  });

  test("re-send after changes_requested mints version 2 and keeps version 1", async () => {
    const v1Id = fakeUuid();
    fake.store.set("estimate_versions", [
      {
        id: v1Id,
        estimate_id: ESTIMATE_ID,
        version: 1,
        frozen_at: new Date().toISOString(),
        snapshot: { totals: { deposit_due_cents: 250000 } },
        sha256: "a".repeat(64),
      },
    ]);
    fake.store.set("estimates", [
      seedEstimateRow({
        internal_status: "changes_requested",
        client_status: "changes_requested",
        active_version_id: v1Id,
        // operator revised pricing after the client asked for changes
        total_cents: 600000,
        subtotal_cents: 600000,
        deposit_due_cents: 300000,
        balance_remaining_cents: 300000,
      }),
    ]);
    fake.store.set("estimate_line_items", seedLineItems());

    const { estimate, versions } = await freezeViaSend();

    expect(versions).toHaveLength(2);
    const v2 = versions.find((row) => row.version === 2)!;
    expect(v2).toBeTruthy();
    expect(estimate.active_version_id).toBe(v2.id);
    expect((v2.snapshot as Record<string, unknown>).totals).toMatchObject({
      total_cents: 600000,
      deposit_due_cents: 300000,
    });
    // v1 immutable
    const v1 = versions.find((row) => row.version === 1)!;
    expect(v1.id).toBe(v1Id);
  });

  test("canSendEstimate permits the changes_requested re-send cycle", () => {
    expect(canSendEstimate({ internalStatus: "changes_requested", approvalStatus: "approved" })).toBe(true);
    expect(canSendEstimate({ internalStatus: "sent", approvalStatus: "not_required" })).toBe(false);
  });

  test("freeze captures the contact and stamps frozen_at with the send time", async () => {
    const contactId = fakeUuid();
    fake.store.set("contacts", [
      { id: contactId, full_name: "Jordan Client", email: "jordan@example.com", company: "Client Co", phone: null },
    ]);
    fake.store.set("estimates", [seedEstimateRow({ contact_id: contactId })]);
    fake.store.set("estimate_line_items", seedLineItems());

    const { estimate, versions } = await freezeViaSend();

    const snapshot = versions[0].snapshot as EstimateVersionSnapshot;
    expect(snapshot.contact).toMatchObject({
      full_name: "Jordan Client",
      email: "jordan@example.com",
      company: "Client Co",
    });
    // Freeze runs BEFORE the send status update, so sent_at must equal the
    // freeze timestamp — the frozen PDF dates itself from it.
    expect(String(versions[0].frozen_at)).toBe(String(estimate.sent_at));
    expect(String(snapshot.frozen_at)).toBe(String(estimate.sent_at));

    const payload = buildEstimateVersionArtifactPayload(snapshot);
    expect(payload.customer.name).toBe("Jordan Client");
    expect(payload.customer.email).toBe("jordan@example.com");
    expect(payload.issueDate).toBe(String(estimate.sent_at).slice(0, 10));
  });
});

describe("decision + invoice bind to the frozen version (task 2.5)", () => {
  test("approved decision stamps estimate_version_id and invoice reads frozen totals", async () => {
    seedEstimateDraft();
    await freezeViaSend();
    const activeVersionId = String(fake.store.get("estimates")![0].active_version_id);

    // Simulate a post-send mutation of the live row (e.g. a bypassed edit):
    // the frozen snapshot must still win for money.
    fake.store.get("estimates")![0].deposit_due_cents = 99900;
    fake.store.get("estimates")![0].total_cents = 199800;

    const decision = await recordEstimateDecision({
      estimateId: ESTIMATE_ID,
      decision: "approved",
      actorType: "client",
      actorEmail: "client@example.com",
    });
    expect(decision.error).toBeNull();

    const decisions = fake.store.get("estimate_decisions") || [];
    expect(decisions).toHaveLength(1);
    expect(decisions[0].estimate_version_id).toBe(activeVersionId);

    const invoices = fake.store.get("invoices") || [];
    expect(invoices).toHaveLength(1);
    expect(invoices[0].estimate_version_id).toBe(activeVersionId);
    expect(invoices[0].amount_due_cents).toBe(250000);
    expect((invoices[0].scope_snapshot as FakeRow).recommendation).toBeTruthy();
  });

  test("decision is rejected when the estimate has no frozen version", async () => {
    seedSentEstimateUnfrozen(); // sent but never frozen (legacy row)

    const decision = await recordEstimateDecision({
      estimateId: ESTIMATE_ID,
      decision: "approved",
      actorType: "client",
    });

    expect(decision.error).toBe("estimate_not_frozen");
    expect(fake.store.get("estimate_decisions") || []).toHaveLength(0);
  });

  test("convert-to-invoice fails closed without a frozen version", async () => {
    seedSentEstimateUnfrozen();

    const result = await convertEstimateToDepositInvoice({ estimateId: ESTIMATE_ID });

    expect(result.error).toBe("estimate_not_frozen");
    expect(result.invoice).toBeNull();
    expect(fake.store.get("invoices") || []).toHaveLength(0);
  });

  test("approve after re-send mints a fresh deposit invoice bound to the new version", async () => {
    // v1 sent; the client pay route pre-mints the v1 deposit invoice.
    seedEstimateDraft();
    await freezeViaSend();
    const v1Id = String(fake.store.get("estimates")![0].active_version_id);

    const first = await convertEstimateToDepositInvoice({ estimateId: ESTIMATE_ID });
    expect(first.error).toBeNull();
    expect(first.invoice!.estimate_version_id).toBe(v1Id);
    expect(first.invoice!.amount_due_cents).toBe(250000);

    // Client asks for changes; operator revises pricing; re-send freezes v2.
    const changes = await recordEstimateDecision({
      estimateId: ESTIMATE_ID,
      decision: "requested_changes",
      actorType: "client",
    });
    expect(changes.error).toBeNull();
    Object.assign(fake.store.get("estimates")![0], {
      subtotal_cents: 600000,
      total_cents: 600000,
      deposit_due_cents: 300000,
      balance_remaining_cents: 300000,
    });
    await freezeViaSend();
    const v2Id = String(fake.store.get("estimates")![0].active_version_id);
    expect(v2Id).not.toBe(v1Id);

    // Approving v2 must NOT return the stale v1 invoice.
    const approval = await recordEstimateDecision({
      estimateId: ESTIMATE_ID,
      decision: "approved",
      actorType: "client",
    });
    expect(approval.error).toBeNull();

    const invoices = fake.store.get("invoices") || [];
    expect(invoices).toHaveLength(2);
    const v2Invoice = invoices.find((row) => row.estimate_version_id === v2Id)!;
    expect(v2Invoice).toBeTruthy();
    expect(v2Invoice.amount_due_cents).toBe(300000);

    // Pay path: snapshot amount equals the v2 invoice amount — no 409.
    const resolved = await resolveFrozenDepositAmountCents(fake.client as never, QUOTE_ID);
    expect(resolved.error).toBeNull();
    expect(resolved.amountCents).toBe(300000);
    expect(Number(v2Invoice.amount_due_cents)).toBe(resolved.amountCents);
  });
});

describe("client-facing money reads (task 2.5)", () => {
  test("legacy quote edit guard reports frozen once a version exists", async () => {
    seedEstimateDraft();

    const before = await getFrozenEstimateForLegacyQuote(fake.client as never, QUOTE_ID);
    expect(before).toBeNull();

    await freezeViaSend();

    const after = await getFrozenEstimateForLegacyQuote(fake.client as never, QUOTE_ID);
    expect(after?.id).toBe(ESTIMATE_ID);
    expect(after?.active_version_id).toBe(String(fake.store.get("estimate_versions")![0].id));
  });

  test("deposit amount resolves from the frozen snapshot even after live-row drift", async () => {
    seedEstimateDraft();
    await freezeViaSend();
    fake.store.get("estimates")![0].deposit_due_cents = 99900;

    const resolved = await resolveFrozenDepositAmountCents(fake.client as never, QUOTE_ID);

    expect(resolved.error).toBeNull();
    expect(resolved.amountCents).toBe(250000);
    expect(String(resolved.estimateVersionId)).toBe(String(fake.store.get("estimate_versions")![0].id));
  });

  test("deposit amount fails closed when nothing is frozen (no 15000 fallback)", async () => {
    seedSentEstimateUnfrozen();

    const resolved = await resolveFrozenDepositAmountCents(fake.client as never, QUOTE_ID);

    expect(resolved.error).toBe("estimate_not_frozen");
    expect(resolved.amountCents).toBeNull();
  });
});

describe("snapshot builder (pure)", () => {
  test("snapshot carries estimate row, line items, and totals; hash is stable", () => {
    const estimate = seedEstimateRow();
    const lineItems = seedLineItems();
    const snapshot = buildEstimateVersionSnapshot({ estimate, lineItems, frozenAt: "2026-08-11T00:00:00.000Z" });

    expect(snapshot.frozen_at).toBe("2026-08-11T00:00:00.000Z");
    expect(snapshot.totals.deposit_due_cents).toBe(250000);
    expect(snapshot.line_items).toHaveLength(1);
    expect((snapshot.estimate as FakeRow).estimate_number).toBe("CC-EST-2026-0007");

    const again = buildEstimateVersionSnapshot({ estimate, lineItems, frozenAt: "2026-08-11T00:00:00.000Z" });
    expect(hashEstimateVersionSnapshot(snapshot)).toBe(hashEstimateVersionSnapshot(again));
  });
});
