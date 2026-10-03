import { beforeEach, describe, expect, test, vi } from "vitest";

type Row = Record<string, any>;
const state = vi.hoisted(() => ({ db: null as any }));
vi.mock("@/lib/supabase", () => ({
  getSupabase: () => state.db,
  supabase: { from: (table: string) => state.db.from(table) },
}));
vi.mock("@/lib/os-auth", () => ({ resolveRootAuthorityForHost: () => "cco" }));
import { createProjectFromBrief } from "../os-projects-engine";
import { ccoRecordId } from "../cco-record-id";

const briefId = "d2d31c2d-78a6-4923-809d-c713379ad405";
const copy = <T>(row: T): T => JSON.parse(JSON.stringify(row));
const field = (row: Row, key: string) => key.split("->").reduce((value, part) => value?.[part], row);

/** Models primary keys, conditional updates and row snapshots. Whole conversions
 * are intentionally not serialized, so simultaneous requests race on inserts. */
class Database {
  beforeUpdate?: (table: string) => void;
  tables = new Map<string, Row[]>();
  failures: Array<{ table: string; operation: string; matches?: (row: Row) => boolean; mode?: "empty" | "throw" }> = [];
  rows(table: string) { if (!this.tables.has(table)) this.tables.set(table, []); return this.tables.get(table)!; }
  from(table: string) { return new Query(this, table); }
  fail(table: string, operation: string, matches?: (row: Row) => boolean, mode?: "empty" | "throw") {
    this.failures.push({ table, operation, matches, mode });
  }
}
class Query {
  operation = "select";
  payload: Row = {};
  filters: Array<(row: Row) => boolean> = [];
  cap = Infinity;
  constructor(public db: Database, public table: string) {}
  select() { return this; }
  eq(key: string, value: unknown) {
    this.filters.push((row) => key === "metadata" ? JSON.stringify(row.metadata) === value : field(row, key) === value);
    return this;
  }
  is(key: string, value: unknown) { this.filters.push((row) => (field(row, key) ?? null) === value); return this; }
  contains(key: string, value: Row | string[]) {
    this.filters.push((row) => Array.isArray(value)
      ? value.every((item) => row[key]?.includes(item))
      : Object.entries(value).every(([k, v]) => row[key]?.[k] === v)); return this;
  }
  order() { return this; }
  limit(count: number) { this.cap = count; return this; }
  insert(payload: Row) { this.operation = "insert"; this.payload = payload; return this; }
  update(payload: Row) { this.operation = "update"; this.payload = payload; return this; }
  maybeSingle() { return this.execute(true, false); }
  single() { return this.execute(true, true); }
  then(resolve: (result: any) => unknown, reject: (reason: any) => unknown) { return this.execute(false, false).then(resolve, reject); }
  async execute(single: boolean, required: boolean) {
    const index = this.db.failures.findIndex((failure) => failure.table === this.table && failure.operation === this.operation &&
      (!failure.matches || failure.matches(this.payload)));
    if (index >= 0) {
      const failure = this.db.failures.splice(index, 1)[0];
      if (failure.mode === "throw") throw new Error("network lost");
      return { data: null, error: failure.mode === "empty" ? null : { message: `${this.table}_${this.operation}_failed` } };
    }
    const rows = this.db.rows(this.table);
    if (this.operation === "insert") {
      const row = copy({ id: `${this.table}-${rows.length + 1}`, ...this.payload });
      if (rows.some((prior) => prior.id === row.id)) return { data: null, error: { code: "23505", message: "duplicate primary key" } };
      rows.push(row);
      return { data: single ? copy(row) : [copy(row)], error: null };
    }
    if (this.operation === "update") this.db.beforeUpdate?.(this.table);
    const matched = rows.filter((row) => this.filters.every((filter) => filter(row))).slice(0, this.cap);
    if (this.operation === "update") matched.forEach((row) => Object.assign(row, copy(this.payload)));
    if (single && (matched.length > 1 || (required && matched.length !== 1))) return { data: null, error: { message: "unexpected row count" } };
    return { data: single ? matched.length ? copy(matched[0]) : null : copy(matched), error: null };
  }
}

let db: Database;
beforeEach(() => {
  db = new Database(); state.db = db;
  db.rows("creative_briefs").push({ id: briefId, company_account_id: "content-co-op", status: "submitted",
    contact_name: "Avery", contact_email: "avery@example.test", company: "Example",
    data: { contact_id: "contact-1", project: { projectName: "Launch", deliverables: ["Main film", "Social cut"], timeline: "2-4 weeks" } },
  });
  db.rows("contacts").push({ id: "contact-1", email: "Avery@Example.Test", cco_public_email_key: "avery@example.test", business_unit: ["CC"] });
});

function expectCompleteCounts() {
  expect(db.rows("projects")).toHaveLength(1);
  expect(db.rows("deliverables")).toHaveLength(2);
  expect(db.rows("events").filter((event) => event.type === "deliverable.created")).toHaveLength(2);
  expect(db.rows("events").filter((event) => event.type === "brief.converted")).toHaveLength(1);
}

describe("brief conversion resumes persisted progress", () => {
  test("concurrent conversions create one project, one set of deliverables and one handoff", async () => {
    const results = await Promise.all([createProjectFromBrief(briefId), createProjectFromBrief(briefId), createProjectFromBrief(briefId)]);
    results.forEach((result) => expect(result).toMatchObject({ error: null, stage: "complete" }));
    expect(new Set(results.map((result) => result.project?.id)).size).toBe(1);
    expect(results.filter((result) => result.replayed)).toHaveLength(2);
    expectCompleteCounts();
    expect(db.rows("deliverables").every((row) => row.due_date === null)).toBe(true);
    expect(db.rows("projects")[0].metadata.deadline).toBe("2-4 weeks");
  });

  test("resumes after a deliverable failure without duplicating or resetting work, even if the brief changes", async () => {
    db.fail("deliverables", "insert", (row) => row.title === "Social cut");
    expect(await createProjectFromBrief(briefId)).toMatchObject({ partial: true, retryable: true, stage: "deliverable_write" });
    expect(db.rows("creative_briefs")[0].status).toBe("submitted");
    const first = db.rows("deliverables")[0];
    first.status = "in_review"; first.title = "Operator revised title";
    db.rows("creative_briefs")[0].data.project.deliverables = ["Different film", "Extra work", "More work"];
    expect(await createProjectFromBrief(briefId)).toMatchObject({ error: null, replayed: true });
    expectCompleteCounts();
    expect(db.rows("deliverables")[0]).toMatchObject({ id: first.id, status: "in_review", title: "Operator revised title" });
    expect(db.rows("deliverables")[1].title).toBe("Social cut");
  });

  test.each([undefined, "empty"] as const)("reports a failed or zero-row status update and safely retries (%s)", async (mode) => {
    db.fail("creative_briefs", "update", undefined, mode);
    const failure = await createProjectFromBrief(briefId);
    expect(failure).toMatchObject({ partial: true, retryable: true, stage: "brief_status" });
    expect(failure.error).toBeTruthy();
    expect(db.rows("events").some((event) => event.type === "brief.converted")).toBe(false);
    expect(await createProjectFromBrief(briefId)).toMatchObject({ error: null, replayed: true });
    expectCompleteCounts();
  });

  test.each(["deliverable.created", "brief.converted"])("retries a failed %s event without repeating completed records", async (type) => {
    db.fail("events", "insert", (row) => row.type === type);
    expect(await createProjectFromBrief(briefId)).toMatchObject({ partial: true, retryable: true,
      stage: type === "brief.converted" ? "conversion_event" : "deliverable_event" });
    expect(await createProjectFromBrief(briefId)).toMatchObject({ error: null, replayed: true });
    expectCompleteCounts();
  });

  test("resumes legacy random-ID project and deliverables and keeps their existing event", async () => {
    db.rows("projects").push({ id: "legacy-project", business_unit: "CC", title: "Existing project",
      metadata: { source_brief_id: briefId, operator_note: "Keep this" } });
    db.rows("deliverables").push({ id: "legacy-film", project_id: "legacy-project", title: "Main film", status: "approved" });
    db.rows("events").push({ id: "legacy-event", business_unit: "CC", type: "deliverable.created", object_type: "deliverable", object_id: "legacy-film" });
    expect(await createProjectFromBrief(briefId)).toMatchObject({ error: null, replayed: true, project: { id: "legacy-project" } });
    expect(await createProjectFromBrief(briefId)).toMatchObject({ error: null });
    expectCompleteCounts();
    expect(db.rows("deliverables")[0]).toMatchObject({ id: "legacy-film", status: "approved" });
    expect(db.rows("projects")[0].metadata.operator_note).toBe("Keep this");
  });

  test("does not pick a winner or create another project when legacy links are ambiguous", async () => {
    db.rows("projects").push(...["first", "second"].map((id) => ({ id, business_unit: "CC", metadata: { source_brief_id: briefId } })));
    expect(await createProjectFromBrief(briefId)).toMatchObject({ project: null, stage: "project_lookup" });
    expect(db.rows("projects")).toHaveLength(2);
    expect(db.rows("deliverables")).toHaveLength(0);
  });

  test.each(["submitted", "converted"])("preserves renamed approved legacy work and requires reconciliation on every retry (%s)", async (status) => {
    db.rows("creative_briefs")[0].status = status;
    db.rows("projects").push({ id: "legacy-project", business_unit: "CC", title: "Existing project",
      metadata: { source_brief_id: briefId, operator_note: "Approved scope" } });
    db.rows("deliverables").push({ id: "legacy-film", project_id: "legacy-project", title: "Approved launch film", status: "approved" });
    db.rows("events").push({ id: "legacy-event", business_unit: "CC", type: "deliverable.created", object_type: "deliverable", object_id: "legacy-film" });
    if (status === "converted") db.rows("events").push({ id: "legacy-converted", business_unit: "CC",
      type: "brief.converted", object_type: "project", object_id: "legacy-project", payload: { brief_id: briefId } });
    const before = copy(Object.fromEntries(db.tables));

    for (let attempt = 0; attempt < 2; attempt++) {
      expect(await createProjectFromBrief(briefId)).toMatchObject({ project: { id: "legacy-project" },
        partial: true, replayed: true, retryable: false, stage: "legacy_deliverable_reconciliation",
        error: expect.stringContaining("no work has been changed") });
      expect(Object.fromEntries(db.tables)).toEqual(before);
    }
    expect(db.rows("deliverables")).toHaveLength(1);
    expect(db.rows("projects")[0].metadata).not.toHaveProperty("brief_conversion");
  });

  test("does not overwrite an operator's simultaneous metadata edit when adopting a legacy project", async () => {
    db.rows("projects").push({ id: "legacy-project", business_unit: "CC", title: "Existing project",
      metadata: { source_brief_id: briefId } });
    db.beforeUpdate = (table) => {
      if (table === "projects") {
        db.rows("projects")[0].metadata.operator_note = "Added during conversion";
        db.beforeUpdate = undefined;
      }
    };
    expect(await createProjectFromBrief(briefId)).toMatchObject({ partial: true, retryable: true, stage: "manifest" });
    expect(db.rows("projects")[0].metadata.operator_note).toBe("Added during conversion");
    expect(await createProjectFromBrief(briefId)).toMatchObject({ error: null, replayed: true });
    expect(db.rows("projects")[0].metadata.operator_note).toBe("Added during conversion");
    expectCompleteCounts();
  });

  test("refuses a deterministic primary-key collision with an unrelated project", async () => {
    db.rows("projects").push({ id: ccoRecordId("brief-project", briefId), business_unit: "CC", metadata: { source_brief_id: "another-brief" } });
    expect(await createProjectFromBrief(briefId)).toMatchObject({ project: null, stage: "project_write" });
    expect(db.rows("projects")).toHaveLength(1);
    expect(db.rows("deliverables")).toHaveLength(0);
  });

  test.each([true, false])("keeps a curated mixed-case contact linked (saved contact ID: %s)", async (saved) => {
    if (!saved) delete db.rows("creative_briefs")[0].data.contact_id;
    expect(await createProjectFromBrief(briefId)).toMatchObject({ error: null, project: { contact_id: "contact-1" } });
    expect(db.rows("contacts")).toHaveLength(1);
  });

  test("rejects a saved contact outside CCO instead of losing its linkage", async () => {
    db.rows("contacts")[0].business_unit = ["ACS"];
    expect(await createProjectFromBrief(briefId)).toMatchObject({ retryable: false, stage: "contact_lookup" });
    expect(db.rows("projects")).toHaveLength(0);
  });

  test("rejects cross-company conversion before any writes", async () => {
    expect(await createProjectFromBrief(briefId, "ACS")).toMatchObject({ retryable: false, stage: "scope" });
    expect(db.rows("projects")).toHaveLength(0);
  });

  test("keeps an in-progress project receipt when a later request throws", async () => {
    db.fail("deliverables", "insert", undefined, "throw");
    expect(await createProjectFromBrief(briefId)).toMatchObject({ partial: true, retryable: true, stage: "request" });
    expect(await createProjectFromBrief(briefId)).toMatchObject({ error: null, replayed: true });
    expectCompleteCounts();
  });
});
