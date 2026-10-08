import { beforeEach, describe, expect, test, vi } from "vitest";
import { createFakeSupabase, type FakeSupabase } from "./helpers/fake-supabase";
const mocks = vi.hoisted(() => ({ handoff: vi.fn() }));
vi.mock("@/lib/cvp-handoff", () => ({ handoffEstimateToCoVideoPro: mocks.handoff }));
import { handoffBriefToProduction } from "../cco-brief-production-handoff";
const briefId = "d2d31c2d-78a6-4923-809d-c713379ad405";
let fake: FakeSupabase;
function estimate(id = "estimate-1", overrides = {}) { return { id, brief_id: briefId, business_unit: "CC",
  internal_status: "approved", client_status: "approved", active_version_id: "version-1", ...overrides }; }
const run = (scope = "CC") => handoffBriefToProduction(briefId, scope, { sb: fake.client as never });
beforeEach(() => {
  fake = createFakeSupabase({ creative_briefs: [{ id: briefId, company_account_id: "content-co-op", status: "submitted" }] });
  vi.clearAllMocks();
  mocks.handoff.mockResolvedValue({ receipt: { cvpProjectId: "production-project", replayed: true, commercialRef: { estimate_id: "estimate-1" } },
    error: null, partial: false, retryable: false, stage: "complete", progress: { cvpProjectId: "production-project" } });
});

describe("public brief resolves approved commercial authority before production handoff", () => {
  test("missing estimate is a non-retryable, actionable block without writes", async () => {
    const before = JSON.stringify([...fake.store]);
    expect(await run()).toMatchObject({ error: "approved_estimate_required", retryable: false, partial: false });
    expect(JSON.stringify([...fake.store])).toBe(before); expect(mocks.handoff).not.toHaveBeenCalled();
  });
  test.each([
    { internal_status: "draft" }, { client_status: "not_sent" }, { active_version_id: null },
    { superseded_by_estimate_id: "replacement" }, { business_unit: "ACS" },
  ])("cannot bypass commercial prerequisites %j", async (override) => {
    fake.store.set("estimates", [estimate("estimate-1", override)]);
    expect(await run()).toMatchObject({ error: "approved_estimate_required", retryable: false });
    expect(mocks.handoff).not.toHaveBeenCalled();
  });
  test("multiple approved links require reconciliation, even with a normalized scope hint", async () => {
    fake.store.set("estimates", [estimate(), estimate("estimate-2")]);
    fake.store.get("creative_briefs")![0].normalized_scope_metadata = { estimate_id: "estimate-1" };
    expect(await run()).toMatchObject({ error: "brief_estimate_ambiguous", retryable: false });
    expect(mocks.handoff).not.toHaveBeenCalled();
  });
  test("a mismatched persisted estimate hint cannot redirect the handoff", async () => {
    fake.store.set("estimates", [estimate()]);
    fake.store.get("creative_briefs")![0].normalized_scope_metadata = { estimate_id: "wrong-estimate" };
    expect(await run()).toMatchObject({ error: "brief_estimate_link_conflict", retryable: false });
    expect(mocks.handoff).not.toHaveBeenCalled();
  });
  test("delegates the canonical stored IDs and exposes only the production link", async () => {
    fake.store.set("estimates", [estimate()]);
    expect(await run()).toMatchObject({ error: null, briefId, project: { id: "production-project", schema: "co_production" }, replayed: true });
    expect(mocks.handoff).toHaveBeenCalledWith({ estimateId: "estimate-1", briefId }, expect.objectContaining({ sb: fake.client }));
    expect(fake.store.get("creative_briefs")![0].status).toBe("submitted");
    expect(fake.store.has("projects")).toBe(false); expect(fake.store.has("deliverables")).toBe(false);
  });
  test("a partial production handoff stays incomplete and preserves the same project link", async () => {
    fake.store.set("estimates", [estimate()]);
    mocks.handoff.mockResolvedValue({ receipt: null, error: "receipt_write_failed", partial: true, retryable: true,
      stage: "receipt", progress: { cvpProjectId: "production-project" } });
    expect(await run()).toMatchObject({ error: "receipt_write_failed", partial: true, retryable: true,
      project: { id: "production-project", schema: "co_production" } });
  });
  test("rejects cross-company scope before invoking a production writer", async () => {
    expect(await run("ACS")).toMatchObject({ error: "brief_scope_mismatch", retryable: false });
    expect(mocks.handoff).not.toHaveBeenCalled();
  });
});
