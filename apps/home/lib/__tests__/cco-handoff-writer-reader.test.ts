import { createHash } from "node:crypto";
import { readCommercialHandoffStatus } from "../cco-commercial-handoff-status";
import { hashEstimateVersionSnapshot } from "../os-estimate-versions";
import { beforeEach, describe, expect, test } from "vitest";
import { createFakeSupabase, fakeUuid, type FakeRow, type FakeSupabase } from "./helpers/fake-supabase";
import {
  handoffEstimateToCoVideoPro,
} from "../cvp-handoff";

const ESTIMATE_ID = "11111111-1111-4111-8111-111111111111";
const VERSION_ID = "44444444-4444-4444-8444-444444444444";
const BRIEF_ID = "77777777-7777-4777-8777-777777777777";
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
  publicFake.store.set("creative_briefs", [{ id: BRIEF_ID, company_account_id: "content-co-op" }]);
  publicFake.store.set("estimates", [
    {
      id: ESTIMATE_ID,
      business_unit: "CC",
      brief_id: BRIEF_ID,
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
        estimate: { id: ESTIMATE_ID, brief_id: BRIEF_ID, business_unit: "CC", estimate_number: "CC-EST-2026-0007",
          scope_snapshot: { scope_items: [{ scope_bucket: "post_production_deliverables", item_type: "main_edits", label: "Main edit", quantity: 1, metadata: {} }] } },
        contact: { full_name: "Jordan Client", email: "jordan@example.com", company: "Client Co", phone: null },
        line_items: [{ description: "Main edit", quantity: 1, unit: "project", unit_price_cents: 500000, line_total_cents: 500000 }],
        totals: { ...SNAPSHOT_TOTALS },
        frozen_at: "2026-08-11T12:00:00.000Z",
      },
      sha256: "b".repeat(64),
    },
  ]);
  publicFake.store.get("estimate_versions")![0].sha256 = hashEstimateVersionSnapshot(publicFake.store.get("estimate_versions")![0].snapshot);
  publicFake.store.set("estimate_decisions", [{ id: fakeUuid(), estimate_id: ESTIMATE_ID, estimate_version_id: VERSION_ID, decision_type: "approved" }]);
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


const QUOTE_ID = "88888888-8888-4888-8888-888888888888";
function seedSeam(rowTimestamp = "2026-08-11T12:00:00.000Z", snapshotTimestamp = rowTimestamp) {
  seedApprovedFrozenEstimate({legacy_quote_id: QUOTE_ID});
  const version = publicFake.store.get("estimate_versions")![0];
  const snapshot = version.snapshot as { frozen_at: string; estimate: FakeRow };
  version.frozen_at = rowTimestamp; snapshot.frozen_at = snapshotTimestamp;
  snapshot.estimate.legacy_quote_id = QUOTE_ID;
  version.sha256 = hashEstimateVersionSnapshot(snapshot);
  publicFake.store.set("quotes", [{id:QUOTE_ID,business_unit:"CC"}]);
  return version;
}
const read = () => readCommercialHandoffStatus({quoteId:QUOTE_ID,access:{businessUnit:"CC",role:"platform_owner",permissions:["quote_read","invoice_read"]}}, {sb:publicFake.client as never});

describe("actual handoff writer to reader seam", () => {
  test("actual canonical writer receipt without version is readable without mutation", async () => {
    seedSeam(); const written=await runHandoff(); expect(written.error).toBeNull();
    expect(Object.hasOwn(written.receipt!.commercialRef,"version")).toBe(false);
    const before=JSON.stringify([...publicFake.store]);
    expect((await read()).handoff.state).toBe("available");
    expect(JSON.stringify([...publicFake.store])).toBe(before);
  });
  test.each([undefined,null,"1",2])("present invalid commercialRef.version %j is rejected", async (value) => {
    seedSeam(); await runHandoff();
    const receipt=publicFake.store.get("commercial_handoffs")![0].receipt as { commercialRef: FakeRow };
    receipt.commercialRef.version=value;
    expect((await read()).handoff.state).toBe("unavailable");
  });
  test("identical submillisecond timestamps retain microseconds and snapshot bytes", async () => {
    const version=seedSeam("2026-08-11T12:00:00.000123Z"); const before=JSON.stringify(version.snapshot);
    const written=await runHandoff(); expect(written.error).toBeNull();
    expect(written.receipt!.commercialRef.frozen_at).toBe("2026-08-11T12:00:00.000123Z");
    expect(JSON.stringify(version.snapshot)).toBe(before);
    expect((await read()).handoff.state).toBe("available");
  });
  test("one microsecond mismatch blocks before writes", async () => {
    seedSeam("2026-08-11T12:00:00.000124Z","2026-08-11T12:00:00.000123Z");
    const before=JSON.stringify([...publicFake.store]);
    expect((await runHandoff()).error).toBe("estimate_snapshot_invalid");
    expect(JSON.stringify([...publicFake.store])).toBe(before);expect(cvpFake.store.size).toBe(0);
  });
  test("equivalent offset microsecond instant replays with identical payload", async () => {
    seedSeam("2026-08-11T07:00:00.000123-05:00","2026-08-11T12:00:00.000123Z");
    const first=await runHandoff();expect(first.error).toBeNull();
    publicFake.store.get("estimate_versions")![0].frozen_at="2026-08-11T12:00:00.000123+00:00";
    const replay=await runHandoff();expect(replay.error).toBeNull();expect(replay.receipt!.payloadHash).toBe(first.receipt!.payloadHash);
  });
  test.each(["2026-08-11T12:00:00.0001234Z","2026-02-30T12:00:00.000Z","2026-08-11T24:00:00Z","2026-08-11T12:00:00+24:00"])("unsupported/invalid timestamp %s blocks before writes", async (stamp) => {
    seedSeam(stamp);const before=JSON.stringify([...publicFake.store]);
    expect((await runHandoff()).error).toBe("estimate_snapshot_invalid");
    expect(JSON.stringify([...publicFake.store])).toBe(before);expect(cvpFake.store.size).toBe(0);
  });
  test("legacy millisecond canonical receipt remains .SSSZ and offset replay stable", async () => {
    seedSeam();const first=await runHandoff();expect(first.error).toBeNull();
    expect(first.receipt!.commercialRef.frozen_at).toBe("2026-08-11T12:00:00.000Z");
    publicFake.store.get("estimate_versions")![0].frozen_at="2026-08-11T07:00:00-05:00";
    const replay=await runHandoff();expect(replay.error).toBeNull();expect(replay.receipt!.payloadHash).toBe(first.receipt!.payloadHash);
  });
});

function legacyHash(ref: Record<string, unknown>) {
  // Original donor canonical field set; new writer additions cannot redefine this pin.
  const canonical = Object.fromEntries(["estimate_id", "estimate_version_id", "brief_id", "estimate_number", "idempotency_key", "owner_id", "snapshot_sha256", "frozen_at", "contact", "totals", "deliverables"].map((key) => [key, ref[key]]));
  canonical.frozen_at = new Date(String(canonical.frozen_at)).toISOString();
  const stable = (v: unknown): string => Array.isArray(v) ? `[${v.map(stable).join(",")}]` : v && typeof v === "object" ? `{${Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,value])=>`${JSON.stringify(k)}:${stable(value)}`).join(",")}}` : JSON.stringify(v);
  return `sha256:${createHash("sha256").update(stable(canonical)).digest("hex")}`;
}
test("legacy millisecond payload hash stays byte-equivalent to original writer", async () => {
  seedSeam();const first=await runHandoff();expect(first.error).toBeNull();
  expect(first.receipt!.payloadHash).toBe(legacyHash(first.receipt!.commercialRef));
});
test("existing lossy submillisecond payload receipt conflicts without rewrite", async () => {
  seedSeam("2026-08-11T12:00:00.000123Z");const first=await runHandoff();expect(first.error).toBeNull();
  const saved=publicFake.store.get("commercial_handoffs")![0];saved.payload_hash=legacyHash(first.receipt!.commercialRef);
  const before=JSON.stringify([...publicFake.store]);const productionBefore=JSON.stringify([...cvpFake.store]);
  expect((await runHandoff()).error).toBe("idempotency_payload_conflict");
  expect(JSON.stringify([...publicFake.store])).toBe(before);expect(JSON.stringify([...cvpFake.store])).toBe(productionBefore);
});
