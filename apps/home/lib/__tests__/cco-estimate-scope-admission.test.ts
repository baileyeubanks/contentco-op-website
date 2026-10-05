import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createFakeSupabase, type FakeSupabase } from "./helpers/fake-supabase";

let fake: FakeSupabase;
let allowedTables: Set<string> | null;
let accessed: string[];
let writeAttempts: string[];
let fallbackPayload: unknown;
let fallbackError: { message: string } | null;
let fallbackCalls: Array<[string, unknown[]]>;
const sideEffects = vi.hoisted(() => ({ artifacts: vi.fn(), events: vi.fn() }));

vi.mock("@/lib/supabase", () => {
  const client = {
    from(table: string) {
      accessed.push(table);
      if (allowedTables && !allowedTables.has(table)) {
        throw new Error(`admission_reached_forbidden_table:${table}`);
      }
      if (table === "events") {
        // Exercise the real fallback's exact read contract; this fake cannot write.
        const query: Record<string, (...args: unknown[]) => unknown> = Object.fromEntries(["select", "eq", "contains", "order", "limit"].map((method) => [method, (...args: unknown[]) => {
          fallbackCalls.push([method, args]);
          return query;
        }]));
        for (const method of ["insert", "update", "upsert", "delete"]) {
          query[method] = () => {
            writeAttempts.push(`events:${method}`);
            throw new Error(`admission_attempted_write:events:${method}`);
          };
        }
        query.maybeSingle = async () => ({ data: fallbackPayload == null ? null : { payload: fallbackPayload }, error: fallbackError });
        return query;
      }
      const query = fake.client.from(table);
      if (!allowedTables) return query;
      const guarded: typeof query = new Proxy(query, {
        get(target, key) {
          if (["insert", "update", "upsert", "delete"].includes(String(key))) {
            return () => {
              writeAttempts.push(`${table}:${String(key)}`);
              throw new Error(`admission_attempted_write:${table}:${String(key)}`);
            };
          }
          const value = Reflect.get(target, key);
          return typeof value === "function" ? (...args: unknown[]) => {
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

vi.mock("@/lib/os-document-artifacts", () => ({ createDocumentArtifacts: sideEffects.artifacts }));
vi.mock("@/lib/os-event-log", () => ({ emitTypedEvent: sideEffects.events }));
vi.mock("@/lib/blaze-documents", () => ({ renderQuotePdf: () => { throw new Error("provider_forbidden"); } }));
vi.mock("@/lib/blaze-handoff", () => ({ emitBlazeHandoff: () => { throw new Error("provider_forbidden"); } }));

import { createEstimateFromBrief } from "../os-commercial-pipeline";
import { buildEstimateDraftFromBrief } from "../os-production-scope";
import { normalizeCreativeBriefPayload, buildCreativeBriefHandoffEnvelope, EMPTY_CREATIVE_DIAGNOSTIC_INPUT } from "../creative-brief";

const BRIEF_ID = "77777777-7777-4777-8777-777777777777";
const current = {
  projectTypes: ["brand"], projectContext: "Synthetic scoped intake, not customer data",
  placements: ["Website"], deliverables: ["Main Film", "Social Cutdowns"],
  shootDayCount: "1.5", filmingLocations: "4+", timeline: "ASAP",
};
const legacy = { diagnostic: { main_video_count: "2", multiple_shoot_days: true, shoot_day_count: "2" } };

beforeEach(() => {
  fake = createFakeSupabase();
  allowedTables = new Set(["creative_briefs"]);
  accessed = [];
  writeAttempts = [];
  fallbackPayload = null;
  fallbackError = null;
  fallbackCalls = [];
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("network_forbidden"); }));
  sideEffects.artifacts.mockReset().mockResolvedValue({ artifacts: [] });
  sideEffects.events.mockReset().mockResolvedValue(null);
});

afterEach(() => {
  expect(writeAttempts).toEqual([]);
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

describe("canonical estimate scope admission before all side effects", () => {
  test.each([
    ["current project", { structured_intake: { project: current } }],
    ["unknown object", { structured_intake: { future_format: true } }],
    ["malformed project", { structured_intake: { project: null } }],
    ["malformed diagnostic", { structured_intake: { diagnostic: [] } }],
    ["current marker with legacy-looking fields", { data: { version: "cco.public-brief.v1" }, structured_intake: legacy }],
    ["conflicting envelopes", { structured_intake: legacy, intake_payload: { project: current } }],
    ["conflicting legacy copies", { structured_intake: legacy, intake_payload: { diagnostic: { main_video_count: "9" } } }],
    ["malformed legacy price input", { structured_intake: { ...legacy, quote_signal: { starting_range_low: {} } } }],
  ])("%s never reaches business/contact/counts or any write", async (_name, shape) => {
    fake.store.set("creative_briefs", [{ id: BRIEF_ID, company_account_id: "content-co-op", ...shape }]);
    const before = JSON.stringify([...fake.store]);
    await expect(createEstimateFromBrief({ briefId: BRIEF_ID })).resolves.toMatchObject({
      estimate: null, legacyQuote: null, error: "brief_scope_manual_review_required",
    });
    expect(accessed).toEqual(["creative_briefs"]);
    expect(JSON.stringify([...fake.store])).toBe(before);
    expect(sideEffects.artifacts).not.toHaveBeenCalled();
    expect(sideEffects.events).not.toHaveBeenCalled();
  });

  test.each([
    ["missing fallback", null, null, undefined],
    ["failed fallback", null, { message: "synthetic read failure" }, undefined],
    ["current fallback", { structured_intake: { project: current } }, null, undefined],
    ["malformed saved scope cannot be replaced by fallback", { structured_intake: legacy }, null, "malformed saved scope"],
  ])("%s remains write-free after the permitted event read", async (_name, payload, error, saved) => {
    allowedTables = new Set(["creative_briefs", "events"]);
    fallbackPayload = payload;
    fallbackError = error;
    fake.store.set("creative_briefs", [{ id: BRIEF_ID, company_account_id: "content-co-op", structured_intake: saved }]);
    const before = JSON.stringify([...fake.store]);
    await expect(createEstimateFromBrief({ briefId: BRIEF_ID })).resolves.toMatchObject({ estimate: null, legacyQuote: null, error: "brief_scope_manual_review_required" });
    expect(accessed).toEqual(["creative_briefs", "events"]);
    expect(fallbackCalls).toEqual([
      ["select", ["payload"]], ["eq", ["type", "brief_submitted"]],
      ["contains", ["payload", { brief_id: BRIEF_ID }]],
      ["order", ["created_at", { ascending: false }]], ["limit", [1]],
    ]);
    expect(JSON.stringify([...fake.store])).toBe(before);
    expect(sideEffects.artifacts).not.toHaveBeenCalled();
    expect(sideEffects.events).not.toHaveBeenCalled();
  });

  test("missing brief stops before fallback or side effects", async () => {
    const result = await createEstimateFromBrief({ briefId: BRIEF_ID });
    expect(result.estimate).toBeNull();
    expect(result.error).toBeTruthy();
    expect(accessed).toEqual(["creative_briefs"]);
    expect(sideEffects.artifacts).not.toHaveBeenCalled();
    expect(sideEffects.events).not.toHaveBeenCalled();
  });

  test("actual legacy writer can be recovered read-only before the unchanged create path", async () => {
    allowedTables = null;
    const payload = normalizeCreativeBriefPayload({ diagnostic: { ...EMPTY_CREATIVE_DIAGNOSTIC_INPUT, main_video_count: "2", multiple_shoot_days: false, need_cutdowns: false } });
    const handoff = buildCreativeBriefHandoffEnvelope({ briefId: BRIEF_ID, bookingUrl: "https://example.invalid", payload, portalUrl: "https://example.invalid" });
    fallbackPayload = { brief_id: BRIEF_ID, structured_intake: handoff.structured_intake, intake_payload: payload };
    fake.store.set("creative_briefs", [{ id: BRIEF_ID, company_account_id: "content-co-op", contact_name: "Synthetic Person", contact_email: "fixture@example.invalid" }]);
    const expected = buildEstimateDraftFromBrief({ structured_intake: handoff.structured_intake });
    const result = await createEstimateFromBrief({ briefId: BRIEF_ID });
    expect(result.error).toBeNull();
    expect(accessed.slice(0, 3)).toEqual(["creative_briefs", "events", "businesses"]);
    expect(result.estimate).toMatchObject({ total_cents: expected.totals.totalCents, scope_snapshot: expected.scopeSnapshot });
    expect(sideEffects.artifacts).toHaveBeenCalledOnce();
  });

  test("recognized legacy input retains its draft amounts and actual create path", async () => {
    allowedTables = null;
    const brief = { id: BRIEF_ID, company_account_id: "content-co-op", contact_name: "Synthetic Person", contact_email: "fixture@example.invalid", structured_intake: legacy };
    fake.store.set("creative_briefs", [brief]);
    const expected = buildEstimateDraftFromBrief(brief);
    const result = await createEstimateFromBrief({ briefId: BRIEF_ID });
    expect(result.error).toBeNull();
    expect(result.estimate).toMatchObject({ brief_id: BRIEF_ID, total_cents: expected.totals.totalCents, scope_snapshot: expected.scopeSnapshot });
    expect(fake.store.get("estimate_line_items")?.map((row) => Object.fromEntries(
      Object.entries(row).filter(([key]) => !["estimate_id", "id", "created_at", "updated_at"].includes(key)),
    ))).toEqual(expected.lineItems);
    expect(sideEffects.artifacts).toHaveBeenCalledOnce();
  });
});
