import { beforeEach, describe, expect, test } from "vitest";
import { createFakeSupabase, fakeUuid, type FakeRow, type FakeSupabase } from "./helpers/fake-supabase";
import {
  buildHandoffIdempotencyKey,
  handoffEstimateToCoVideoPro,
} from "../cvp-handoff";

const ESTIMATE_ID = "11111111-1111-4111-8111-111111111111";
const VERSION_ID = "44444444-4444-4444-8444-444444444444";
const CONTACT_ID = "55555555-5555-4555-8555-555555555555";
const CVP_OWNER = "66666666-6666-4666-8666-666666666666";

const SNAPSHOT_TOTALS = {
  subtotal_cents: 500000,
  tax_cents: 0,
  total_cents: 500000,
  deposit_percent: 50,
  deposit_due_cents: 250000,
  balance_remaining_cents: 250000,
  currency: "USD",
};

let publicFake: FakeSupabase;
let cvpFake: FakeSupabase;

function seedApprovedFrozenEstimate(overrides: FakeRow = {}) {
  publicFake.store.set("estimates", [
    {
      id: ESTIMATE_ID,
      business_unit: "CC",
      brief_id: fakeUuid(),
      contact_id: CONTACT_ID,
      estimate_number: "CC-EST-2026-0007",
      internal_status: "approved",
      client_status: "approved",
      active_version_id: VERSION_ID,
      ...overrides,
    },
  ]);
  publicFake.store.set("estimate_versions", [
    {
      id: VERSION_ID,
      estimate_id: ESTIMATE_ID,
      version: 1,
      frozen_at: "2026-08-11T12:00:00.000Z",
      snapshot: {
        estimate: { estimate_number: "CC-EST-2026-0007" },
        line_items: [{ description: "Main edit", quantity: 1, unit: "project", unit_price_cents: 500000, line_total_cents: 500000 }],
        totals: { ...SNAPSHOT_TOTALS },
        frozen_at: "2026-08-11T12:00:00.000Z",
      },
      sha256: "b".repeat(64),
    },
  ]);
  publicFake.store.set("contacts", [
    {
      id: CONTACT_ID,
      full_name: "Jordan Client",
      email: "jordan@example.com",
      company: "Client Co",
      phone: null,
    },
  ]);
}

function runHandoff(env: Record<string, string | undefined> = { CVP_OWNER_USER_ID: CVP_OWNER }) {
  return handoffEstimateToCoVideoPro(
    { estimateId: ESTIMATE_ID },
    { sb: publicFake.client as never, cvpSb: cvpFake.client as never, env },
  );
}

beforeEach(() => {
  publicFake = createFakeSupabase();
  cvpFake = createFakeSupabase();
});

describe("cvp handoff (task 4.1)", () => {
  test("creates org, contact, inquiry, converted project, and receipt from the frozen snapshot", async () => {
    seedApprovedFrozenEstimate();

    const result = await runHandoff();

    expect(result.error).toBeNull();
    const receipt = result.receipt!;
    expect(receipt.replayed).toBe(false);
    expect(receipt.idempotencyKey).toBe("cco:cc-est-2026-0007:v1:A");
    expect(receipt.estimateVersionId).toBe(VERSION_ID);

    const orgs = cvpFake.store.get("organizations") || [];
    const contacts = cvpFake.store.get("contacts") || [];
    const inquiries = cvpFake.store.get("inquiries") || [];
    const projects = cvpFake.store.get("projects") || [];
    expect(orgs).toHaveLength(1);
    expect(orgs[0].name).toBe("Client Co");
    expect(orgs[0].owner_id).toBe(CVP_OWNER);
    expect(contacts).toHaveLength(1);
    expect(contacts[0].email).toBe("jordan@example.com");
    expect(inquiries).toHaveLength(1);
    expect(inquiries[0].source).toBe("cco_os");
    expect(inquiries[0].owner_id).toBe(CVP_OWNER);
    expect(inquiries[0].status).toBe("converted");
    expect(inquiries[0].project_id).toBe(projects[0].id);
    expect(String(inquiries[0].summary)).toContain("CC-EST-2026-0007");
    expect(projects).toHaveLength(1);
    expect(projects[0].stage).toBe("intake");
    expect(projects[0].owner_id).toBe(CVP_OWNER);
    expect(projects[0].organization_id).toBe(orgs[0].id);
    expect(projects[0].primary_contact_id).toBe(contacts[0].id);

    // Totals carried across are byte-equal to the frozen snapshot.
    expect(projects[0].commercial_total_cents).toBe(SNAPSHOT_TOTALS.total_cents);
    expect(JSON.stringify((projects[0].commercial_ref as FakeRow).totals)).toBe(JSON.stringify(SNAPSHOT_TOTALS));
    expect((projects[0].commercial_ref as FakeRow).estimate_version_id).toBe(VERSION_ID);
    expect(projects[0].cco_estimate_id).toBe(ESTIMATE_ID);
    expect(projects[0].cco_estimate_version_id).toBe(VERSION_ID);
    expect(inquiries[0].commercial_total_cents).toBe(SNAPSHOT_TOTALS.total_cents);

    // Receipt persisted for idempotent replay.
    const handoffs = publicFake.store.get("commercial_handoffs") || [];
    expect(handoffs).toHaveLength(1);
    expect(handoffs[0].estimate_version_id).toBe(VERSION_ID);
    expect(handoffs[0].cvp_project_id).toBe(projects[0].id);
    expect(handoffs[0].cvp_inquiry_id).toBe(inquiries[0].id);
    expect(String(handoffs[0].payload_hash)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  test("second call replays the same receipt with zero duplicate writes", async () => {
    seedApprovedFrozenEstimate();

    const first = await runHandoff();
    const second = await runHandoff();

    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect(second.receipt!.replayed).toBe(true);
    expect(second.receipt!.idempotencyKey).toBe(first.receipt!.idempotencyKey);
    expect(second.receipt!.cvpProjectId).toBe(first.receipt!.cvpProjectId);
    expect(second.receipt!.payloadHash).toBe(first.receipt!.payloadHash);

    expect(cvpFake.store.get("organizations") || []).toHaveLength(1);
    expect(cvpFake.store.get("contacts") || []).toHaveLength(1);
    expect(cvpFake.store.get("inquiries") || []).toHaveLength(1);
    expect(cvpFake.store.get("projects") || []).toHaveLength(1);
    expect(publicFake.store.get("commercial_handoffs") || []).toHaveLength(1);
  });

  test("replayed key with a different payload fails closed", async () => {
    seedApprovedFrozenEstimate();
    const first = await runHandoff();
    expect(first.error).toBeNull();

    // Tamper: same idempotency key now points at a different version payload.
    publicFake.store.get("estimate_versions")![0].snapshot = {
      ...(publicFake.store.get("estimate_versions")![0].snapshot as FakeRow),
      totals: { ...SNAPSHOT_TOTALS, total_cents: 1 },
    };

    const conflict = await runHandoff();
    expect(conflict.error).toBe("idempotency_payload_conflict");
    expect(conflict.receipt).toBeNull();
  });

  test("fails closed when CVP_OWNER_USER_ID is unset — zero CVP writes", async () => {
    seedApprovedFrozenEstimate();

    const result = await runHandoff({});

    expect(result.error).toBe("cvp_owner_user_id_missing");
    expect(result.receipt).toBeNull();
    expect(cvpFake.store.get("organizations") || []).toHaveLength(0);
    expect(cvpFake.store.get("inquiries") || []).toHaveLength(0);
    expect(cvpFake.store.get("projects") || []).toHaveLength(0);
    expect(publicFake.store.get("commercial_handoffs") || []).toHaveLength(0);
  });

  test("rejects estimates that are not approved", async () => {
    seedApprovedFrozenEstimate({ internal_status: "sent", client_status: "sent" });

    const result = await runHandoff();

    expect(result.error).toBe("estimate_not_approved");
    expect(cvpFake.store.get("projects") || []).toHaveLength(0);
  });

  test("rejects estimates without a frozen version", async () => {
    seedApprovedFrozenEstimate({ active_version_id: null });

    const result = await runHandoff();

    expect(result.error).toBe("estimate_not_frozen");
    expect(cvpFake.store.get("projects") || []).toHaveLength(0);
  });

  test("idempotency key binds package, version, and variant (ghost format)", () => {
    expect(buildHandoffIdempotencyKey("CC-EST-2026-0007", 2, "B")).toBe("cco:cc-est-2026-0007:v2:B");
    expect(buildHandoffIdempotencyKey("CC-EST-2026-0007", 0, "A")).toBeNull();
    expect(buildHandoffIdempotencyKey("CC-EST-2026-0007", 1, "bad!")).toBeNull();
    expect(buildHandoffIdempotencyKey("", 1, "A")).toBeNull();
  });
});
