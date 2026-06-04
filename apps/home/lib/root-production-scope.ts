import type { CanonicalEstimateLineItem } from "@/lib/root-estimates";
import { calculateEstimateTotals, roundCurrencyCents } from "@/lib/root-estimates";

export type ProductionScopeBucket =
  | "production_labor"
  | "equipment_packages"
  | "travel_logistics"
  | "post_production_deliverables"
  | "commercial_modifiers";

export type BriefScopeItem = {
  item_type: string;
  scope_bucket: ProductionScopeBucket;
  label: string;
  quantity: number;
  metadata: Record<string, unknown>;
  sort_order: number;
};

type BriefLike = Record<string, unknown>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string") {
    return value.split(/\n|,|•/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function parseCount(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
  const input = String(value || "").trim();
  if (!input) return fallback;
  const matches = input.match(/\d+/g);
  if (!matches?.length) return fallback;
  return Math.max(...matches.map((item) => Number(item)).filter(Number.isFinite));
}

function toBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  const input = String(value || "").trim().toLowerCase();
  return input === "true" || input === "yes";
}

function toTitle(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function getStructuredBrief(brief: BriefLike) {
  return asRecord(brief.structured_intake) || asRecord(brief.intake_payload) || {};
}

export function extractProductionScope(brief: BriefLike) {
  const structured = getStructuredBrief(brief);
  const diagnostic = asRecord(structured.diagnostic) || {};
  const recommendation = asRecord(structured.recommendation) || {};
  const quoteSignal = asRecord(structured.quote_signal) || {};
  const productionNeeds = asList(diagnostic.production_needs);

  const mainVideos = Math.max(1, parseCount(diagnostic.main_video_count, 1));
  const shootDays = toBoolean(diagnostic.multiple_shoot_days) ? Math.max(1, parseCount(diagnostic.shoot_day_count, 2)) : 1;
  const cutdowns = toBoolean(diagnostic.need_cutdowns) ? Math.max(0, parseCount(diagnostic.cutdown_volume, 2)) : 0;
  const locations = Math.max(1, parseCount(diagnostic.filming_locations, 1));
  const travelNeeded = toBoolean(diagnostic.travel_needed);
  const travelScope = String(diagnostic.travel_scope || "").trim();
  const rush = quoteSignal.rush === true || String(diagnostic.timeline || "").trim().toLowerCase() === "asap";
  const motionGraphics = productionNeeds.includes("Motion graphics") || String(diagnostic.editing_style || "").includes("motion");
  const verticalVersions = productionNeeds.includes("Vertical versions");
  const advancedPost = String(diagnostic.polish_level || "").includes("Cinematic") || String(diagnostic.editing_style || "").includes("advanced");

  const scopeItems: BriefScopeItem[] = [
    {
      item_type: "shoot_days",
      scope_bucket: "production_labor",
      label: "Shoot days",
      quantity: shootDays,
      metadata: { locations, recommendation: recommendation.recommended_video_type || null },
      sort_order: 10,
    },
    {
      item_type: "director_videographer_days",
      scope_bucket: "production_labor",
      label: "Director / videographer days",
      quantity: shootDays,
      metadata: { locations },
      sort_order: 20,
    },
    {
      item_type: "equipment_package_days",
      scope_bucket: "equipment_packages",
      label: "Camera, audio, and lighting package days",
      quantity: shootDays,
      metadata: { locations },
      sort_order: 30,
    },
    {
      item_type: "main_edits",
      scope_bucket: "post_production_deliverables",
      label: "Main edits",
      quantity: mainVideos,
      metadata: {
        target_runtime: diagnostic.target_runtime || null,
        polish_level: diagnostic.polish_level || null,
      },
      sort_order: 40,
    },
  ];

  if (cutdowns > 0) {
    scopeItems.push({
      item_type: verticalVersions ? "social_shorts" : "cutdowns",
      scope_bucket: "post_production_deliverables",
      label: verticalVersions ? "Vertical/social cutdowns" : "Cutdown edits",
      quantity: cutdowns,
      metadata: { vertical_versions: verticalVersions },
      sort_order: 50,
    });
  }

  if (motionGraphics) {
    scopeItems.push({
      item_type: "motion_graphics",
      scope_bucket: "post_production_deliverables",
      label: "Motion graphics passes",
      quantity: Math.max(1, Math.ceil(mainVideos / 2)),
      metadata: { advanced_post: advancedPost },
      sort_order: 60,
    });
  }

  if (travelNeeded) {
    scopeItems.push({
      item_type: "travel_logistics",
      scope_bucket: "travel_logistics",
      label: "Travel and logistics",
      quantity: 1,
      metadata: { travel_scope: travelScope || "custom" },
      sort_order: 70,
    });
  }

  if (rush) {
    scopeItems.push({
      item_type: "rush_fee",
      scope_bucket: "commercial_modifiers",
      label: "Rush / expediting fee",
      quantity: 1,
      metadata: { timeline: diagnostic.timeline || null },
      sort_order: 80,
    });
  }

  scopeItems.push({
    item_type: "project_admin",
    scope_bucket: "commercial_modifiers",
    label: "Project management and delivery administration",
    quantity: 1,
    metadata: { production_needs: productionNeeds },
    sort_order: 90,
  });

  return {
    structured,
    diagnostic,
    recommendation,
    quoteSignal,
    scopeItems,
  };
}

export function buildEstimateDraftFromBrief(brief: BriefLike) {
  const { diagnostic, recommendation, quoteSignal, scopeItems } = extractProductionScope(brief);
  const rangeLow = Number(quoteSignal.starting_range_low || recommendation.starting_range_low || 6500);
  const rangeHigh = Number(quoteSignal.starting_range_high || recommendation.starting_range_high || Math.max(rangeLow + 1500, 8500));
  const targetSubtotalCents = roundCurrencyCents(((rangeLow + rangeHigh) / 2) * 100);

  const baseUnitMap: Record<string, number> = {
    shoot_days: 0,
    director_videographer_days: 115000,
    equipment_package_days: 70000,
    main_edits: 145000,
    social_shorts: 35000,
    cutdowns: 32000,
    motion_graphics: 45000,
    travel_logistics: String(diagnostic.travel_scope || "").includes("Domestic") ? 220000 : 90000,
    rush_fee: 0,
    project_admin: 85000,
  };

  const preScale = scopeItems
    .filter((item) => item.item_type !== "rush_fee")
    .reduce((sum, item) => sum + (baseUnitMap[item.item_type] || 0) * item.quantity, 0);
  const scale = preScale > 0 ? targetSubtotalCents / preScale : 1;

  const lineItems: CanonicalEstimateLineItem[] = scopeItems.map((item, index) => {
    if (item.item_type === "rush_fee") {
      return {
        phase_name: "Commercial modifiers",
        line_type: item.item_type,
        description: item.label,
        quantity: 1,
        unit: "project",
        unit_price_cents: 0,
        line_total_cents: 0,
        metadata: item.metadata,
        sort_order: index * 10,
      };
    }

    const scaledUnitPrice = roundCurrencyCents((baseUnitMap[item.item_type] || 60000) * scale);
    return {
      phase_name: toTitle(item.scope_bucket),
      line_type: item.item_type,
      description: item.label,
      quantity: item.quantity,
      unit: item.item_type.includes("days") ? "day" : item.quantity === 1 ? "project" : "unit",
      unit_price_cents: scaledUnitPrice,
      line_total_cents: scaledUnitPrice * item.quantity,
      metadata: item.metadata,
      sort_order: index * 10,
    };
  });

  const subtotalWithoutRush = lineItems.reduce((sum, item) => sum + (item.line_total_cents || 0), 0);
  const rushIndex = lineItems.findIndex((item) => item.line_type === "rush_fee");
  if (rushIndex >= 0) {
    const rushCents = roundCurrencyCents(subtotalWithoutRush * 0.15);
    lineItems[rushIndex] = {
      ...lineItems[rushIndex],
      unit_price_cents: rushCents,
      line_total_cents: rushCents,
    };
  }

  const totals = calculateEstimateTotals(lineItems, 0, 50);
  const assumptions = [
    "Estimate pricing is based on the current structured brief and scoped deliverables.",
    "Scheduling remains subject to crew availability and final deposit receipt.",
    "Client approvals apply to scope, timing, and commercial terms before production handoff.",
  ];
  const exclusions = [
    "Unscoped change orders, extra revisions, and out-of-scope travel are excluded until explicitly approved.",
    "Scheduling is not committed until the deposit is paid or an approved waiver exists.",
  ];

  return {
    scopeItems,
    lineItems,
    totals,
    assumptions,
    exclusions,
    scopeSnapshot: {
      recommendation,
      diagnostic,
      scope_items: scopeItems,
    },
    pricingSnapshot: {
      target_subtotal_cents: targetSubtotalCents,
      line_items: lineItems,
      totals,
      source_range_low: rangeLow,
      source_range_high: rangeHigh,
    },
  };
}
