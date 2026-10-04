import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createFakeSupabase, type FakeSupabase } from "./helpers/fake-supabase";

let fake: FakeSupabase;
let allowCreation: boolean;
let accessed: string[];
let queryCalls: Array<[string, unknown[]]>;
let attemptedWrites: string[];
let forcedBriefResult: { data: unknown; error: { message: string } | null } | undefined;
const effects = vi.hoisted(() => ({ artifacts: vi.fn(), events: vi.fn() }));

vi.mock("@/lib/supabase", () => {
  const client = {
    from(table: string) {
      accessed.push(table);
      if (!allowCreation && table !== "creative_briefs") {
        throw new Error(`forbidden_before_admission:${table}`);
      }
      const query = fake.client.from(table);
      const guarded: typeof query = new Proxy(query, {
        get(target, key) {
          if (!allowCreation && ["insert", "update", "upsert", "delete"].includes(String(key))) {
            return () => {
              attemptedWrites.push(`${table}:${String(key)}`);
              throw new Error("write_before_admission");
            };
          }
          if (table === "creative_briefs" && key === "single" && forcedBriefResult) {
            return async () => forcedBriefResult;
          }
          const value = Reflect.get(target, key);
          return typeof value === "function" ? (...args: unknown[]) => {
            if (table === "creative_briefs") queryCalls.push([String(key), args]);
            const result = value.apply(target, args);
            return result === target ? guarded : result;
          } : value;
        },
      });
      return guarded;
    },
  };
  return { getSupabase: () => client, supabase: client };
});

vi.mock("@/lib/os-document-artifacts", () => ({ createDocumentArtifacts: effects.artifacts }));
vi.mock("@/lib/os-event-log", () => ({ emitTypedEvent: effects.events }));
vi.mock("@/lib/blaze-documents", () => ({ renderQuotePdf: () => { throw new Error("provider_forbidden"); } }));
vi.mock("@/lib/blaze-handoff", () => ({ emitBlazeHandoff: () => { throw new Error("provider_forbidden"); } }));

import { createEstimateFromBrief } from "../os-commercial-pipeline";
import { buildEstimateDraftFromBrief } from "../os-production-scope";

const BRIEF_ID = "77777777-7777-4777-8777-777777777777";
const brief = {
  id: BRIEF_ID,
  company_account_id: "content-co-op",
  contact_name: "Synthetic Person",
  contact_email: "fixture@example.invalid",
  structured_intake: { diagnostic: { main_video_count: "2", multiple_shoot_days: true, shoot_day_count: "2" } },
};

beforeEach(() => {
  fake = createFakeSupabase();
  fake.store.set("creative_briefs", [{ ...brief }]);
  allowCreation = false;
  accessed = [];
  queryCalls = [];
  attemptedWrites = [];
  forcedBriefResult = undefined;
  effects.artifacts.mockReset().mockResolvedValue({ artifacts: [] });
  effects.events.mockReset().mockResolvedValue(null);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("network_forbidden"); }));
});

afterEach(() => {
  expect(attemptedWrites).toEqual([]);
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

async function expectStopped(error?: string) {
  const before = JSON.stringify([...fake.store]);
  const result = await createEstimateFromBrief({ briefId: BRIEF_ID });
  expect(result).toMatchObject({ estimate: null, legacyQuote: null });
  if (error) expect(result.error).toBe(error);
  else expect(result.error).toBeTruthy();
  expect(accessed).toEqual(["creative_briefs"]);
  expect(JSON.stringify([...fake.store])).toBe(before);
  expect(effects.artifacts).not.toHaveBeenCalled();
  expect(effects.events).not.toHaveBeenCalled();
}

describe("canonical estimate brief/company admission", () => {
  test.each(["astro-cleaning-services", null, undefined])("scopes the actual lookup away from company %s", async (company) => {
    fake.store.set("creative_briefs", [{ ...brief, company_account_id: company }]);
    await expectStopped();
    expect(queryCalls).toContainEqual(["eq", ["id", BRIEF_ID]]);
    expect(queryCalls).toContainEqual(["eq", ["company_account_id", "content-co-op"]]);
  });

  test.each([
    ["foreign company", { ...brief, company_account_id: "astro-cleaning-services" }],
    ["null company", { ...brief, company_account_id: null }],
    ["missing company", { ...brief, company_account_id: undefined }],
    ["contradictory saved ACS scope", { ...brief, business_unit: "ACS" }],
    ["unrecognized saved scope", { ...brief, business_unit: "future-unit" }],
    ["malformed saved scope", { ...brief, business_unit: {} }],
    ["array instead of row", [{ ...brief }]],
    ["primitive instead of row", "synthetic_invalid_row"],
    ["foreign row without scope before event fallback", { id: BRIEF_ID, company_account_id: "other-company" }],
  ])("rejects %s even if a response bypasses query filtering", async (_name, row) => {
    forcedBriefResult = { data: row, error: null };
    await expectStopped("brief_scope_mismatch");
  });

  test.each(["ACS", "future-unit", null])("rejects requested scope %s before any lookup", async (businessUnit) => {
    const before = JSON.stringify([...fake.store]);
    const result = await createEstimateFromBrief({
      briefId: BRIEF_ID,
      businessUnit: businessUnit as unknown as Parameters<typeof createEstimateFromBrief>[0]["businessUnit"],
    });
    expect(result).toEqual({ estimate: null, legacyQuote: null, error: "brief_scope_mismatch" });
    expect(accessed).toEqual([]);
    expect(JSON.stringify([...fake.store])).toBe(before);
    expect(effects.artifacts).not.toHaveBeenCalled();
    expect(effects.events).not.toHaveBeenCalled();
  });

  test.each([
    ["missing row", { data: null, error: null }, "brief_not_found"],
    ["failed read", { data: null, error: { message: "synthetic_read_failure" } }, "synthetic_read_failure"],
    ["data alongside failed read", { data: brief, error: { message: "synthetic_read_failure" } }, "synthetic_read_failure"],
  ] as const)("%s remains write-free", async (_name, response, error) => {
    forcedBriefResult = response;
    await expectStopped(error);
  });

  test.each([undefined, null, "CC"])("retains real legacy creation with saved business unit %s", async (businessUnit) => {
    allowCreation = true;
    const saved = { ...brief, business_unit: businessUnit };
    fake.store.set("creative_briefs", [saved]);
    const expected = buildEstimateDraftFromBrief(saved);
    const result = await createEstimateFromBrief({ briefId: BRIEF_ID, businessUnit: "CC" });
    expect(result.error).toBeNull();
    expect(result.estimate).toMatchObject({ brief_id: BRIEF_ID, business_unit: "CC", total_cents: expected.totals.totalCents, scope_snapshot: expected.scopeSnapshot });
    expect(fake.store.get("estimates")).toHaveLength(1);
    expect(fake.store.get("estimate_line_items")).toHaveLength(expected.lineItems.length);
    expect(effects.artifacts).toHaveBeenCalledOnce();
    expect(queryCalls).toContainEqual(["eq", ["company_account_id", "content-co-op"]]);
  });

  test("matching company does not bypass current-format manual scope review", async () => {
    forcedBriefResult = { data: { ...brief, structured_intake: { project: { deliverables: ["Main Film"], shootDayCount: "1.5" } } }, error: null };
    await expectStopped("brief_scope_manual_review_required");
  });
});
