import { describe, expect, test } from "vitest";
import {
  RATE_CARD,
  buildBriefPricingInputs,
  calculateEstimate,
  estimateFromRateCard,
  scopeFromPricingInputs,
} from "../pricing";

/**
 * Accepted Schneider Electric quotes, July 2026 rate card. These totals are
 * contractual history; if a card value changes, update RATE_CARD and these
 * fixtures together.
 */
describe("rate card reproduces accepted precedents", () => {
  test("EPC Houston: 1 day, 2-person, full edits, no travel = $8,600", () => {
    const { total } = estimateFromRateCard({
      captureDays: 1,
      crewSize: 2,
      mainEdit: true,
      soundbitesPerDay: RATE_CARD.soundbitesPerCaptureDay,
      selectsPackage: true,
      preProduction: 250,
      admin: true,
      travel: { mode: "local" },
    });
    expect(total).toBe(8600);
  });

  test("Automation Days South: EPC scope + San Antonio drive, 2 rooms × 1 night = $9,425.80", () => {
    const { total } = estimateFromRateCard({
      captureDays: 1,
      crewSize: 2,
      mainEdit: true,
      soundbitesPerDay: RATE_CARD.soundbitesPerCaptureDay,
      selectsPackage: true,
      preProduction: 250,
      admin: true,
      travel: {
        mode: "texas_regional",
        roundTripMiles: RATE_CARD.roundTripMiles.sanAntonio,
        hotelNightly: RATE_CARD.hotelNightStandard,
        hotelNights: 1,
        rooms: 2,
      },
    });
    expect(total).toBe(9425.8);
  });

  test("WEFTEC 2026: 2 days, Dir + Alex, full edits, New Orleans drive, 2 rooms × 3 nights = $15,706.80", () => {
    const { total, lines } = estimateFromRateCard({
      captureDays: 2,
      crewSize: 2,
      mainEdit: true,
      soundbitesPerDay: RATE_CARD.soundbitesPerCaptureDay,
      selectsPackage: true,
      preProduction: 0,
      admin: true,
      travel: {
        mode: "domestic",
        roundTripMiles: RATE_CARD.roundTripMiles.newOrleans,
        hotelNightly: RATE_CARD.hotelNightStandard,
        hotelNights: 3,
        rooms: 2,
      },
    });
    expect(total).toBe(15706.8);
    expect(lines.find((l) => l.label.startsWith("Interview soundbite"))).toMatchObject({ quantity: 10, amount: 2000 });
  });

  test("El Paso VOC shoot #2: solo day, 2 travel days, drone, airfare, 2 hotel nights, shoot-only = $5,800", () => {
    const { total, notes } = estimateFromRateCard({
      captureDays: 1,
      crewSize: 1,
      mainEdit: false,
      drone: true,
      preProduction: 0,
      admin: false,
      travel: {
        mode: "domestic",
        airfarePerPerson: RATE_CARD.airfareCap,
        hotelNightly: RATE_CARD.hotelNightStandard,
        hotelNights: 2,
        rooms: 1,
        travelDays: 2,
      },
    });
    expect(total).toBe(5800);
    expect(notes.join(" ")).toContain("Shoot-only");
  });
});

describe("public brief maps onto the rate card", () => {
  const defaultDraftProject = {
    projectTypes: ["brand"],
    deliverables: ["Main Film"],
    enhancements: [],
    targetRuntime: "60-90 sec",
    shootDayCount: "1",
    filmingLocations: "1",
    travelScope: "Houston / local",
    productionNeeds: ["Interviews", "B-roll Capture", "Location Sound"],
    styleLevel: "Polished Commercial",
    revisionExpectation: "2 rounds",
    timeline: "2-4 weeks",
    companyScale: "Not sure",
    budgetRange: "$10,000-$20,000",
  };

  test("interviews + b-roll on one local day is a two-person crew with a main edit", () => {
    const scope = scopeFromPricingInputs(buildBriefPricingInputs(defaultDraftProject));
    expect(scope).toMatchObject({ captureDays: 1, crewSize: 2, mainEdit: true, finish: "polished", preProduction: 250 });
    const estimate = calculateEstimate(buildBriefPricingInputs(defaultDraftProject));
    // 2750 + 1250 + 2500 + 250 + 500 = 7250
    expect(estimate.low).toBe(7250);
    expect(estimate.high).toBeGreaterThan(estimate.low);
    expect(estimate.deposit).toBe(3650);
    expect(estimate.companyMultiplier).toBe(1);
  });

  test("an event-style brief lands on the EPC precedent", () => {
    const estimate = calculateEstimate(buildBriefPricingInputs({
      ...defaultDraftProject,
      deliverables: ["Main Film", "Interview Selects", "B-roll Stringout"],
    }));
    expect(estimate.low).toBe(8600);
  });

  test("a solo interview day stays solo and shoot-only drops the edit", () => {
    const scope = scopeFromPricingInputs(buildBriefPricingInputs({
      ...defaultDraftProject,
      productionNeeds: ["Interviews"],
      deliverables: ["Shoot-only RAW Footage"],
    }));
    expect(scope).toMatchObject({ crewSize: 1, mainEdit: false });
  });

  test("domestic travel adds airfare, lodging and discounted travel days per crew member", () => {
    const estimate = calculateEstimate(buildBriefPricingInputs({ ...defaultDraftProject, travelScope: "Domestic", shootDayCount: "2" }));
    const travel = (estimate.breakdown ?? []).filter((l) => l.phase === "travel");
    expect(travel.map((l) => l.label)).toEqual(expect.arrayContaining([
      expect.stringContaining("Airfare"),
      expect.stringContaining("Lodging"),
      expect.stringContaining("Travel days"),
    ]));
    expect(estimate.notes?.join(" ")).toContain("billed at actuals");
  });

  test("ASAP timeline applies the 15% rush to labor and post only", () => {
    const base = calculateEstimate(buildBriefPricingInputs(defaultDraftProject));
    const rush = calculateEstimate(buildBriefPricingInputs({ ...defaultDraftProject, timeline: "ASAP" }));
    const rushLine = (rush.breakdown ?? []).find((l) => l.phase === "modifier");
    expect(rushLine?.amount).toBe(Math.round((2750 + 1250 + 2500) * 0.15));
    expect(rush.low).toBeGreaterThan(base.low);
  });

  test("never estimates below the solo short day", () => {
    const estimate = calculateEstimate(buildBriefPricingInputs({
      ...defaultDraftProject,
      productionNeeds: ["B-roll Capture"],
      deliverables: ["Shoot-only RAW Footage"],
      shootDayCount: "0.5",
    }));
    expect(estimate.low).toBeGreaterThanOrEqual(2250);
  });
});
