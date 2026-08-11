import { beforeEach, describe, expect, test } from "vitest";
import { createFakeSupabase, fakeUuid, type FakeRow, type FakeSupabase } from "./helpers/fake-supabase";
import { runEstimateVersionBackfill } from "../../scripts/backfill-estimate-versions";

let fake: FakeSupabase;

const CONTACT_ID = "55555555-5555-4555-8555-555555555555";
const SENT_AT = "2026-07-20T15:04:00.000Z";

function seedSentEstimate(overrides: FakeRow = {}) {
  const id = fakeUuid();
  const estimate = {
    id,
    business_unit: "CC",
    brief_id: fakeUuid(),
    contact_id: CONTACT_ID,
    estimate_number: `CC-EST-2026-${id.slice(-4)}`,
    currency: "USD",
    subtotal_cents: 500000,
    tax_cents: 0,
    total_cents: 500000,
    deposit_percent: 50,
    deposit_due_cents: 250000,
    balance_remaining_cents: 250000,
    internal_status: "sent",
    client_status: "sent",
    approval_status: "not_required",
    scope_snapshot: {},
    pricing_snapshot: {},
    sent_at: SENT_AT,
    updated_at: SENT_AT,
    active_version_id: null,
    ...overrides,
  };
  fake.store.set("estimates", [...(fake.store.get("estimates") || []), estimate]);
  fake.store.set("estimate_line_items", [
    ...(fake.store.get("estimate_line_items") || []),
    {
      id: fakeUuid(),
      estimate_id: id,
      phase_name: "Production",
      line_type: "production_labor",
      description: "Main edit",
      quantity: 1,
      unit: "project",
      unit_price_cents: 500000,
      line_total_cents: 500000,
      sort_order: 10,
    },
  ]);
  return estimate;
}

function run(apply: boolean) {
  return runEstimateVersionBackfill({ apply }, { sb: fake.client as never });
}

beforeEach(() => {
  fake = createFakeSupabase();
  fake.store.set("contacts", [
    { id: CONTACT_ID, full_name: "Jordan Client", email: "jordan@example.com", company: "Client Co", phone: null },
  ]);
});

describe("estimate version backfill (SITREP #13 prep)", () => {
  test("dry-run reports candidates and writes nothing", async () => {
    seedSentEstimate();
    seedSentEstimate();

    const summary = await run(false);

    expect(summary.wouldFreeze).toBe(2);
    expect(summary.frozen).toHaveLength(0);
    expect(fake.store.get("estimate_versions") || []).toHaveLength(0);
    expect((fake.store.get("estimates") || []).every((row) => row.active_version_id == null)).toBe(true);
  });

  test("apply freezes exactly the unfrozen sent estimates", async () => {
    const sent = seedSentEstimate();
    seedSentEstimate({ internal_status: "draft", sent_at: null }); // never sent — skip
    const frozen = seedSentEstimate(); // already has a version — skip
    fake.store.set("estimate_versions", [
      {
        id: fakeUuid(),
        estimate_id: frozen.id,
        version: 1,
        frozen_at: SENT_AT,
        snapshot: { totals: {} },
        sha256: "c".repeat(64),
      },
    ]);

    const summary = await run(true);

    expect(summary.frozen).toHaveLength(1);
    expect(summary.frozen[0].estimateId).toBe(sent.id);
    expect(summary.alreadyFrozen).toBe(1);
    // The draft row is filtered out at query level — never scanned, never frozen.
    const draft = (fake.store.get("estimates") || []).find((row) => row.internal_status === "draft")!;
    expect(draft.active_version_id).toBeNull();
    expect((fake.store.get("estimate_versions") || []).some((row) => row.estimate_id === draft.id)).toBe(false);

    const versions = fake.store.get("estimate_versions") || [];
    expect(versions).toHaveLength(2);
    const backfilled = versions.find((row) => row.estimate_id === sent.id)!;
    expect(backfilled.version).toBe(1);
    const updated = (fake.store.get("estimates") || []).find((row) => row.id === sent.id)!;
    expect(updated.active_version_id).toBe(backfilled.id);
  });

  test("viewed/approved/changes_requested/rejected count as sent", async () => {
    for (const status of ["viewed", "approved", "rejected", "changes_requested"]) {
      seedSentEstimate({ internal_status: status });
    }

    const summary = await run(true);

    expect(summary.frozen).toHaveLength(4);
  });

  test("backfilled snapshot joins the contact and dates frozen_at from sent_at", async () => {
    const estimate = seedSentEstimate();

    await run(true);

    const version = (fake.store.get("estimate_versions") || []).find((row) => row.estimate_id === estimate.id)!;
    expect(String(version.frozen_at)).toBe(SENT_AT);
    const snapshot = version.snapshot as FakeRow;
    expect(snapshot.frozen_at).toBe(SENT_AT);
    expect(snapshot.contact).toMatchObject({
      full_name: "Jordan Client",
      email: "jordan@example.com",
      company: "Client Co",
    });
    expect((snapshot.totals as FakeRow).deposit_due_cents).toBe(250000);
    expect(String(version.sha256)).toMatch(/^[0-9a-f]{64}$/);
  });

  test("rows edited after send are frozen but drift-flagged", async () => {
    const drifted = seedSentEstimate({ updated_at: "2026-08-01T09:00:00.000Z" });
    const clean = seedSentEstimate();

    const summary = await run(true);

    expect(summary.drifted).toEqual([drifted.id]);
    expect(summary.drifted).not.toContain(clean.id);
    expect(summary.frozen).toHaveLength(2);
  });

  test("sent status without sent_at is skipped, not frozen with a fabricated date", async () => {
    seedSentEstimate({ sent_at: null });

    const summary = await run(true);

    expect(summary.frozen).toHaveLength(0);
    expect(summary.missingSentAt).toBe(1);
    expect(fake.store.get("estimate_versions") || []).toHaveLength(0);
  });

  test("re-run is idempotent — second apply freezes zero", async () => {
    seedSentEstimate();

    const first = await run(true);
    const second = await run(true);

    expect(first.frozen).toHaveLength(1);
    expect(second.frozen).toHaveLength(0);
    expect(second.alreadyFrozen).toBe(1);
    expect(fake.store.get("estimate_versions") || []).toHaveLength(1);
  });
});
