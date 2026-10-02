import { describe, expect, test } from "vitest";
import { hydrateStructuredCreativeBriefIntake, isPublicBriefProjectShape } from "../creative-brief";

/** Shape written by the public /brief since 2026-08 (see lib/cco-public-intake.ts). */
const publicBriefRecord = {
  id: "c0fdfe49-12c6-4f8e-a59b-a99e37f6cbeb",
  contact_name: "Avery Brooks",
  contact_email: "avery@example.com",
  phone: "+15015551234",
  company: "Example Industrial",
  role: "Marketing Director",
  location: "Houston, TX",
  content_type: "brand, social",
  deliverables: "Main Film, Social Cutdowns",
  booking_intent: "discovery_call_20",
  source_surface: "cco_home",
  source_path: "/brief",
  submission_mode: "form",
  structured_intake: {
    contact: {
      name: "Avery Brooks",
      email: "avery@example.com",
      phone: "+15015551234",
      company: "Example Industrial",
      website: "https://example.com",
    },
    project: {
      projectTypes: ["brand", "social"],
      projectName: "Launch proof film",
      placements: ["Website", "Social"],
      deliverables: ["Main Film", "Social Cutdowns"],
      enhancements: ["subtitles"],
      targetRuntime: "2-3 min",
      shootDayCount: "2",
      filmingLocations: "2",
      travelScope: "Texas regional",
      productionNeeds: ["Interviews", "B-roll Capture", "Drone"],
      styleLevel: "Cinematic Campaign",
      revisionExpectation: "2 rounds",
      timeline: "2-4 weeks",
      budgetRange: "$10,000-$20,000",
      projectContext: "We need a credible launch film that proves the work.",
      audience: "Prospects and existing customers",
      companyScale: "Mid-market company",
    },
    booking_preference: "20",
  },
  data: { version: "cco.public-brief.v1" },
};

describe("public brief shape hydrates into a full structured intake", () => {
  test("recognises the public project shape", () => {
    expect(isPublicBriefProjectShape(publicBriefRecord.structured_intake.project)).toBe(true);
    expect(isPublicBriefProjectShape({ content_type: "brand" })).toBe(false);
  });

  test("never returns the raw public object (which has no readiness block)", () => {
    const structured = hydrateStructuredCreativeBriefIntake(publicBriefRecord, "https://calendar.example/book");
    expect(structured.readiness).toBeDefined();
    expect(typeof structured.readiness.quote_ready).toBe("boolean");
    expect(Array.isArray(structured.readiness.blockers)).toBe(true);
    expect(structured.recommendation).toBeDefined();
    expect(structured.routing?.booking_url).toBe("https://calendar.example/book");
  });

  test("maps public fields onto the diagnostic and the legacy project view", () => {
    const structured = hydrateStructuredCreativeBriefIntake(publicBriefRecord, "https://calendar.example/book");
    expect(structured.contact).toMatchObject({ name: "Avery Brooks", company: "Example Industrial" });
    expect(structured.project.content_type).toBe("Launch proof film");
    expect(structured.project.deliverables).toEqual(["Main Film", "Social Cutdowns"]);
    expect(structured.diagnostic).toMatchObject({
      goal: "Build trust",
      placement: "Multiple places",
      primary_placement: "Website",
      target_runtime: "2-3 min",
      multiple_shoot_days: true,
      shoot_day_count: "2",
      filming_locations: "2",
      travel_needed: true,
      travel_scope: "Texas regional",
      timeline: "2-4 weeks",
      polish_level: "Cinematic and premium",
      budget_comfort: "$10,000-$20,000",
      need_cutdowns: true,
    });
    expect(structured.diagnostic?.audiences).toEqual(expect.arrayContaining(["Prospects", "Customers"]));
    expect(structured.diagnostic?.production_needs).toEqual(expect.arrayContaining(["Interviews", "Drone", "Subtitles"]));
  });

  test("falls back to flat columns and data.project when structured_intake is absent", () => {
    const { structured_intake, ...flat } = publicBriefRecord;
    const structured = hydrateStructuredCreativeBriefIntake(
      { ...flat, data: { project: structured_intake.project } },
      "https://calendar.example/book",
    );
    expect(structured.readiness).toBeDefined();
    expect(structured.contact.email).toBe("avery@example.com");
    expect(structured.project.content_type).toBe("Launch proof film");
  });

  test("a legacy v3 structured intake with readiness still passes through untouched", () => {
    const legacy = {
      structured_intake: {
        contact: { name: "Legacy", email: "legacy@example.com" },
        project: { content_type: "Brand film", deliverables: ["Main"] },
        readiness: { quote_ready: true, blockers: [], missing_fields: [] },
        marker: "untouched",
      },
    };
    const structured = hydrateStructuredCreativeBriefIntake(legacy, "https://calendar.example/book") as unknown as Record<string, unknown>;
    expect(structured.marker).toBe("untouched");
  });
});
