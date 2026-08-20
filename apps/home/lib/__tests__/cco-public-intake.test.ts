import { describe, expect, test, vi } from "vitest";
import {
  getCcoOsDatabase,
  persistCcoBrief,
  persistCcoLead,
  type CcoPublicIntakeDatabase,
} from "../cco-public-intake";

type Row = Record<string, unknown>;
type Filter =
  | { kind: "eq"; column: string; value: unknown }
  | { kind: "contains"; column: string; value: Record<string, unknown> | string[] };

class FakeQuery {
  private operation: "select" | "insert" | "update" = "select";
  private payload: Row | null = null;
  private filters: Filter[] = [];

  constructor(private readonly db: FakeDatabase, private readonly table: string) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ kind: "eq", column, value });
    return this;
  }

  contains(column: string, value: Record<string, unknown> | string[]) {
    this.filters.push({ kind: "contains", column, value });
    return this;
  }

  insert(payload: Row) {
    this.operation = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: Row) {
    this.operation = "update";
    this.payload = payload;
    return this;
  }

  async maybeSingle() {
    return this.execute(false);
  }

  async single() {
    return this.execute(true);
  }

  private async execute(requireRow: boolean) {
    const rows = this.db.rows(this.table);
    if (this.operation === "insert") {
      if (this.db.insertErrorFor === this.table) {
        return { data: null, error: { message: `${this.table}_insert_failed` } };
      }
      const row = { id: `${this.table}-${rows.length + 1}`, ...(this.payload || {}) };
      rows.push(row);
      return { data: row, error: null };
    }

    const matched = rows.filter((row) => this.filters.every((filter) => matches(row, filter)));
    if (this.operation === "update") {
      const row = matched[0];
      if (!row) return { data: null, error: { message: `${this.table}_update_missing` } };
      Object.assign(row, this.payload || {});
      return { data: row, error: null };
    }

    const row = matched[0] || null;
    return requireRow && !row
      ? { data: null, error: { message: `${this.table}_not_found` } }
      : { data: row, error: null };
  }
}

function matches(row: Row, filter: Filter) {
  const actual = row[filter.column];
  if (filter.kind === "eq") return actual === filter.value;
  if (Array.isArray(filter.value)) {
    return Array.isArray(actual) && filter.value.every((item) => actual.includes(item));
  }
  if (!actual || typeof actual !== "object" || Array.isArray(actual)) return false;
  return Object.entries(filter.value).every(([key, value]) => (actual as Row)[key] === value);
}

class FakeDatabase implements CcoPublicIntakeDatabase {
  readonly tables = new Map<string, Row[]>();
  insertErrorFor: string | null = null;

  from(table: string) {
    return new FakeQuery(this, table);
  }

  rows(table: string) {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table)!;
  }
}

const contact = {
  name: "Avery Brooks",
  email: "avery@example.com",
  phone: "+15015551234",
  company: "Example Industrial",
  role: "Marketing Director",
  website: "https://example.com",
  address: "Houston, TX",
};

const project = {
  projectTypes: ["Brand film"],
  projectName: "Launch proof film",
  audience: "Prospective industrial clients",
  projectContext: "We need a credible launch film that proves the work and supports sales conversations.",
  placements: ["Website"],
  deliverables: ["Main film"],
  timeline: "2-4 weeks",
  budgetRange: "$10,000-$20,000",
  successDefinition: "A clear proposal and production plan.",
};

const submission = {
  sourcePath: "/brief",
  contact,
  project,
  bookingPreference: "20" as const,
  submissionId: "b4a6bb35-0062-4b95-9de0-3b12976465bb",
};

describe("CCO public intake persistence", () => {
  test("rejects a service client that is not bound to CCO-DB", () => {
    const binding = getCcoOsDatabase({
      CCO_SUPABASE_URL: "https://cviggizfmelffvpfzkmh.supabase.co",
      CCO_SUPABASE_SERVICE_KEY: "test-service-key",
    });

    expect(binding).toMatchObject({ ok: false, error: "cco_db_binding_invalid" });
  });

  test("writes a CC contact and brief before reporting success", async () => {
    const db = new FakeDatabase();
    const sendEmail = vi.fn(async () => ({ ok: true, id: "provider-message-1" }));

    const result = await persistCcoBrief(submission, { db, sendEmail });

    expect(result).toMatchObject({
      ok: true,
      persisted: true,
      replayed: false,
      contactId: "contacts-1",
      briefId: "creative_briefs-1",
      notification: { status: "sent" },
    });
    expect(db.rows("contacts")[0]).toMatchObject({
      business_unit: ["CC"],
      status: "lead",
      source: "contentco-op.com/brief",
    });
    expect(db.rows("creative_briefs")[0]).toMatchObject({
      company_account_id: "content-co-op",
      contact_email: "avery@example.com",
      data: {
        public_submission_id: submission.submissionId,
        contact_id: "contacts-1",
      },
    });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "bailey@contentco-op.com",
      businessUnit: "CC",
    }));
    expect(db.rows("notification_log")[0]).toMatchObject({
      status: "sent",
      recipient: "bailey@contentco-op.com",
      related_entity_type: "creative_brief",
      related_entity_id: "creative_briefs-1",
    });
  });

  test("records a provider failure without pretending that the persisted brief failed", async () => {
    const db = new FakeDatabase();
    const result = await persistCcoBrief(submission, {
      db,
      sendEmail: async () => ({ ok: false, error: "provider_unavailable" }),
    });

    expect(result).toMatchObject({
      ok: true,
      persisted: true,
      notification: { status: "failed" },
    });
    expect(db.rows("notification_log")[0]).toMatchObject({
      status: "failed",
      error_message: "provider_unavailable",
    });
  });

  test("records a thrown provider error as a failed delivery", async () => {
    const db = new FakeDatabase();
    const result = await persistCcoBrief(submission, {
      db,
      sendEmail: async () => {
        throw new Error("provider_timeout");
      },
    });

    expect(result).toMatchObject({ ok: true, persisted: true, notification: { status: "failed" } });
    expect(db.rows("notification_log")[0]).toMatchObject({
      status: "failed",
      error_message: "provider_timeout",
    });
  });

  test("reuses the browser submission id without duplicating the brief or admin alert", async () => {
    const db = new FakeDatabase();
    const sendEmail = vi.fn(async () => ({ ok: true, id: "provider-message-1" }));

    const first = await persistCcoBrief(submission, { db, sendEmail });
    const replay = await persistCcoBrief(submission, { db, sendEmail });

    expect(first).toMatchObject({ ok: true, persisted: true, replayed: false });
    expect(replay).toMatchObject({ ok: true, persisted: true, replayed: true });
    expect(db.rows("creative_briefs")).toHaveLength(1);
    expect(db.rows("notification_log")).toHaveLength(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  test("lead capture itself requires a returned database receipt", async () => {
    const db = new FakeDatabase();
    db.insertErrorFor = "contacts";

    const result = await persistCcoLead({ contact }, { db });

    expect(result).toMatchObject({ ok: false, persisted: false, error: "contact_write_failed" });
  });
});
