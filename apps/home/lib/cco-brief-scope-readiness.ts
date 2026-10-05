type RawRecord = Record<string, unknown>;

export type BriefScopeCount = { raw: unknown; exact: number | null; minimum: number | null };
export type BriefScopeReadiness = {
  state: "manual_review_required" | "legacy_compatible";
  format: "public_project" | "legacy_diagnostic" | "unknown";
  reasons: string[];
  projects: Array<{
    source: string;
    raw: unknown;
    shootDays: BriefScopeCount;
    filmingLocations: BriefScopeCount;
  }>;
};

function asRecord(value: unknown): RawRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as RawRecord : null;
}

function has(record: RawRecord, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

// These are source facts only, never quantities for priced line items. The public
// form's open-ended choice is not an exact count. Preserve unparsed input too.
function explicitCount(raw: unknown, whole: boolean): BriefScopeCount {
  const unknown = { raw, exact: null, minimum: null };
  if (typeof raw !== "string") return unknown;
  const text = raw.trim();
  if (text === "4+") return { raw, exact: null, minimum: 4 };
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text)) return unknown;
  const value = Number(text);
  const normalized = text.includes(".") ? text.replace(/0+$/, "").replace(/\.$/, "") : text;
  if (!Number.isFinite(value) || value <= 0 || value > Number.MAX_SAFE_INTEGER || String(value) !== normalized) return unknown;
  if (whole && !Number.isSafeInteger(value)) return unknown;
  return { raw, exact: value, minimum: null };
}

const countKeys = ["main_video_count", "shoot_day_count", "cutdown_volume", "filming_locations"];
const booleanKeys = ["multiple_shoot_days", "need_cutdowns", "travel_needed"];
const textKeys = ["travel_scope", "timeline", "target_runtime", "polish_level", "editing_style"];

function validLegacy(envelope: RawRecord) {
  const diagnostic = asRecord(envelope.diagnostic);
  if (!diagnostic) return false;
  const recognized = [...countKeys, ...booleanKeys, ...textKeys, "production_needs"];
  if (!recognized.some((key) => has(diagnostic, key))) return false;
  for (const key of countKeys) {
    if (!has(diagnostic, key)) continue;
    const value = diagnostic[key];
    // Empty choices are part of the existing diagnostic contract; its defaults
    // remain the responsibility of the unchanged legacy draft builder.
    if (typeof value !== "string" && !(typeof value === "number" && Number.isFinite(value))) return false;
  }
  for (const key of booleanKeys) {
    if (has(diagnostic, key) && diagnostic[key] !== null && typeof diagnostic[key] !== "boolean" && typeof diagnostic[key] !== "string") return false;
  }
  for (const key of textKeys) {
    if (has(diagnostic, key) && typeof diagnostic[key] !== "string") return false;
  }
  if (has(diagnostic, "production_needs")) {
    const needs = diagnostic.production_needs;
    if (typeof needs !== "string" && !(Array.isArray(needs) && needs.every((item) => typeof item === "string"))) return false;
  }
  for (const key of ["recommendation", "quote_signal"]) {
    if (envelope[key] == null) continue;
    const record = asRecord(envelope[key]);
    if (!record) return false;
    for (const range of ["starting_range_low", "starting_range_high"]) {
      if (record[range] != null && !(typeof record[range] === "number" && Number.isFinite(record[range]))) return false;
    }
  }
  return true;
}

function legacyProject(envelope: RawRecord, project: RawRecord | null) {
  if (!validLegacy(envelope) || !project || typeof project.content_type !== "string" || !Array.isArray(project.deliverables)) return false;
  if (!project.deliverables.every((item) => typeof item === "string")) return false;
  const text = ["content_type", "audience", "tone", "deadline", "objective", "key_messages", "references", "constraints"];
  return Object.entries(project).every(([key, value]) => key === "deliverables" || (text.includes(key) && (value === null || typeof value === "string")));
}

function legacyScope(envelope: RawRecord | null) {
  return [envelope?.diagnostic, envelope?.recommendation ?? null, envelope?.quote_signal ?? null];
}

function sameValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((value, i) => sameValue(value, right[i]));
  const a = asRecord(left);
  const b = asRecord(right);
  return !!a && !!b && Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((key) => has(b, key) && sameValue(a[key], b[key]));
}

/** Only the existing diagnostic contract is admitted to the legacy draft builder.
 * Public projects have no canonical deliverable quantities or pricing mapping.
 * Keep every raw copy for review instead of choosing or merging conflicting scope.
 */
export function assessBriefScopeReadiness(brief: RawRecord): BriefScopeReadiness {
  const sources = ["structured_intake", "intake_payload", "data"] as const;
  const projects: BriefScopeReadiness["projects"] = [];
  let marked = brief.source === "public_brief_form";
  for (const source of sources) {
    const record = asRecord(brief[source]);
    if (!record) continue;
    marked ||= (has(record, "version") && record.version !== "cco.home.creative-brief.v3") || has(record, "public_submission_id");
    if (!has(record, "project")) continue;
    const project = asRecord(record.project);
    // The legacy writer also emits a snake_case descriptive project. Only that
    // recognized shape alongside diagnostics may retain legacy pricing behavior.
    if (source !== "data" && legacyProject(record, project)) continue;
    projects.push({
      source: `${source}.project`, raw: record.project,
      shootDays: explicitCount(project?.shootDayCount, false),
      filmingLocations: explicitCount(project?.filmingLocations, true),
    });
  }
  if (projects.length || marked) {
    return { state: "manual_review_required", format: "public_project", reasons: ["commercial_scope_mapping_required"], projects };
  }

  const envelopes = [brief.structured_intake, brief.intake_payload].filter((value) => value != null);
  const records = envelopes.map(asRecord);
  if (!records.length || records.some((record) => !record || !validLegacy(record))) {
    return { state: "manual_review_required", format: "unknown", reasons: ["scope_input_unknown_or_malformed"], projects };
  }
  if (records.length > 1 && !sameValue(legacyScope(records[0]), legacyScope(records[1]))) {
    return { state: "manual_review_required", format: "legacy_diagnostic", reasons: ["scope_input_conflict"], projects };
  }
  return { state: "legacy_compatible", format: "legacy_diagnostic", reasons: [], projects };
}
