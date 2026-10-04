import { describe, expect, test } from "vitest";
import { assessBriefScopeReadiness } from "../cco-brief-scope-readiness";
import { normalizeCreativeBriefPayload, buildCreativeBriefHandoffEnvelope } from "../creative-brief";

const project = {
  projectTypes: ["brand"], projectContext: "Synthetic source contract",
  deliverables: ["Main Film", "Social Cutdowns", "Custom unspecified lane"],
  placements: ["Website"], shootDayCount: "1.5", filmingLocations: "2",
  enhancements: ["motiongfx"], productionNeeds: ["Drone"], targetRuntime: "Not sure",
  travelScope: "Extended / custom", revisionExpectation: "3+ rounds", timeline: "ASAP",
  budgetRange: "$10,000", quoteConfidence: "High quote confidence", quoteMissingInputs: [],
};

describe("saved brief scope readiness without commercial inference", () => {
  test("admits the actual legacy writer with snake_case project, v3 marker and nullable choices", () => {
    const payload = normalizeCreativeBriefPayload({ diagnostic: { main_video_count: "2", multiple_shoot_days: false, need_cutdowns: false } });
    const handoff = buildCreativeBriefHandoffEnvelope({ briefId: "synthetic", bookingUrl: "https://example.invalid", payload, portalUrl: "https://example.invalid" });
    expect(payload.diagnostic.shoot_day_count).toBe("");
    expect(payload.diagnostic.travel_needed).toBeNull();
    const brief = { structured_intake: handoff.structured_intake, intake_payload: payload };
    const before = JSON.stringify(brief);
    expect(assessBriefScopeReadiness(brief).state).toBe("legacy_compatible");
    expect(JSON.stringify(brief)).toBe(before);
  });

  test("conflicting legacy diagnostic copies are held even if each is recognized", () => {
    expect(assessBriefScopeReadiness({ structured_intake: { diagnostic: { main_video_count: "2" } }, intake_payload: { diagnostic: { main_video_count: "3" } } }).state).toBe("manual_review_required");
  });

  test("retains all current raw scope and half-day facts but requires commercial review", () => {
    const brief = { structured_intake: { project } };
    const before = JSON.stringify(brief);
    const result = assessBriefScopeReadiness(brief);
    expect(result.state).toBe("manual_review_required");
    expect(result.format).toBe("public_project");
    expect(result.projects).toEqual([{
      source: "structured_intake.project", raw: project,
      shootDays: { raw: "1.5", exact: 1.5, minimum: null },
      filmingLocations: { raw: "2", exact: 2, minimum: null },
    }]);
    expect(result.reasons).toContain("commercial_scope_mapping_required");
    expect(JSON.stringify(brief)).toBe(before);
    expect(result).not.toHaveProperty("lineItems");
    expect(result).not.toHaveProperty("totals");
  });

  test.each(["0.5", "1", "1.5", "2", "2.5", "3", "3.5", "1.50"])("preserves explicit shoot days %s without rounding", (raw) => {
    const result = assessBriefScopeReadiness({ intake_payload: { project: { ...project, shootDayCount: raw } } });
    expect(result.projects[0].shootDays).toEqual({ raw, exact: Number(raw), minimum: null });
    expect(result.state).toBe("manual_review_required");
  });

  test("4+ is a lower bound, never exactly four", () => {
    const result = assessBriefScopeReadiness({ data: { version: "cco.public-brief.v1", project: { ...project, shootDayCount: "4+", filmingLocations: "4+" } } });
    expect(result.projects[0].shootDays).toEqual({ raw: "4+", exact: null, minimum: 4 });
    expect(result.projects[0].filmingLocations).toEqual({ raw: "4+", exact: null, minimum: 4 });
  });

  test.each([undefined, "", "Not sure", "0", "-1", "1e2", "Infinity", "NaN", "1 day", "1.0000000000000001", 2, null])("does not invent a count from %s", (raw) => {
    const result = assessBriefScopeReadiness({ structured_intake: { project: { ...project, shootDayCount: raw } } });
    expect(result.projects[0].shootDays).toEqual({ raw, exact: null, minimum: null });
    expect(result.state).toBe("manual_review_required");
  });

  test("fractional locations stay unknown while raw input survives", () => {
    const result = assessBriefScopeReadiness({ structured_intake: { project: { ...project, filmingLocations: "1.5" } } });
    expect(result.projects[0].filmingLocations).toEqual({ raw: "1.5", exact: null, minimum: null });
  });

  test("conflicting public copies and legacy-looking diagnostics cannot bypass review", () => {
    const first = { ...project, shootDayCount: "0.5" };
    const second = { ...project, shootDayCount: "3" };
    const result = assessBriefScopeReadiness({ structured_intake: { diagnostic: { main_video_count: "9" }, project: first }, data: { project: second } });
    expect(result.state).toBe("manual_review_required");
    expect(result.projects.map((entry) => entry.raw)).toEqual([first, second]);
    expect(result.projects.map((entry) => entry.shootDays.exact)).toEqual([0.5, 3]);
  });

  test.each([
    {}, { structured_intake: [] }, { structured_intake: { diagnostic: {} } },
    { structured_intake: { diagnostic: [] } }, { structured_intake: { diagnostic: { main_video_count: {} } } },
    { structured_intake: { diagnostic: { future_field: "something" } } },
    { data: { version: "cco.public-brief.v1" }, structured_intake: { diagnostic: { main_video_count: "2" } } },
    { data: { public_submission_id: "synthetic" }, structured_intake: { diagnostic: { main_video_count: "2" } } },
    { structured_intake: { project: null, diagnostic: { main_video_count: "2" } } },
    { structured_intake: { project: [], diagnostic: { main_video_count: "2" } } },
  ])("unknown, malformed or marked current input is never a legacy default: %j", (brief) => {
    expect(assessBriefScopeReadiness(brief).state).toBe("manual_review_required");
  });

  test.each(["structured_intake", "intake_payload"])("recognizes existing %s diagnostics without rewriting them", (key) => {
    const diagnostic = { main_video_count: "2", multiple_shoot_days: true, shoot_day_count: "2", need_cutdowns: true, cutdown_volume: "1-2", production_needs: ["Motion graphics"] };
    const brief = { [key]: { diagnostic, recommendation: { starting_range_low: 12000 }, quote_signal: { rush: true } } };
    const before = JSON.stringify(brief);
    expect(assessBriefScopeReadiness(brief)).toMatchObject({ state: "legacy_compatible", format: "legacy_diagnostic", reasons: [], projects: [] });
    expect(JSON.stringify(brief)).toBe(before);
  });
});
