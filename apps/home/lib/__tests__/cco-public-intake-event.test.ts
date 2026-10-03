import { describe, expect, test, vi } from "vitest";
import {
  BRIEF_SUBMITTED_EVENT_COLUMNS,
  BRIEF_SUBMITTED_EVENT_TYPE,
  BRIEF_SUBMITTED_EVENT_VERSION,
  briefSubmittedIdempotencyKey,
  persistCcoBrief,
  type CcoPublicIntakeDatabase,
} from "../cco-public-intake";

type Row = Record<string, unknown>;
type Filter =
  | { kind: "eq"; column: string; value: unknown }
  | { kind: "contains"; column: string; value: Record<string, unknown> | string[] };

/**
 * Columns that exist on live CCO-DB `public.events` (verified 2026-10-03,
 * read-only information_schema query) intersected with the columns declared by
 * infra/supabase/migrations/20261003000100_events_brief_submitted_contract.sql.
 * The fake database rejects any other column, the way PostgREST does.
 */
const LIVE_EVENTS_COLUMNS = new Set([
  "id", "contact_id", "business_id", "type", "payload", "created_at", "processed_at",
  "processed_by", "process_error", "attempts", "event_version", "business_unit", "channel",
  "direction", "external_thread_id", "text", "metadata", "received_at", "processing_state",
  "locked_by", "locked_at", "decision_id", "idempotency_key",
]);

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
      this.db.inserts.push({ table: this.table, payload: this.payload || {} });
      if (this.db.insertErrorFor === this.table) {
        return { data: null, error: { message: `${this.table}_insert_failed` } };
      }
      if (this.table === "events") {
        const unknown = Object.keys(this.payload || {}).filter((column) => !LIVE_EVENTS_COLUMNS.has(column));
        if (unknown.length) {
          return { data: null, error: { message: `column events.${unknown[0]} does not exist` } };
        }
        const key = (this.payload || {}).idempotency_key;
        if (key && rows.some((row) => row.idempotency_key === key)) {
          return { data: null, error: { message: "duplicate key value violates unique constraint" } };
        }
      }
      if (this.db.raceOnInsert === this.table) {
        // Another request committed the same row between lookup and insert.
        this.db.raceOnInsert = null;
        rows.push({ id: `${this.table}-raced`, ...(this.payload || {}) });
        return { data: null, error: { message: "duplicate key value violates unique constraint" } };
      }
      const row = { id: `${this.table}-${rows.length + 1}`, ...(this.payload || {}) };
      rows.push(row);
      return { data: row, error: null };
    }

    if (this.operation === "select" && this.db.selectErrorFor === this.table) {
      return { data: null, error: { message: `${this.table}_select_failed` } };
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
  readonly inserts: Array<{ table: string; payload: Row }> = [];
  insertErrorFor: string | null = null;
  selectErrorFor: string | null = null;
  raceOnInsert: string | null = null;

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
};

const project = {
  projectTypes: ["Brand film"],
  projectName: "Launch proof film",
  projectContext: "We need a credible launch film that proves the work and supports sales conversations.",
  placements: ["Website"],
  deliverables: ["Main film"],
  timeline: "2-4 weeks",
  budgetRange: "$10,000-$20,000",
};

const submission = {
  sourcePath: "/brief",
  contact,
  project,
  bookingPreference: "20" as const,
  submissionId: "b4a6bb35-0062-4b95-9de0-3b12976465bb",
};

const sentEmail = async () => ({ ok: true, id: "provider-message-1" });

describe("public brief durable brief_submitted event", () => {
  test("success requires contact, brief and event; the event uses only live columns", async () => {
    const db = new FakeDatabase();
    const sendEmail = vi.fn(sentEmail);

    const result = await persistCcoBrief(submission, { db, sendEmail });

    expect(result).toMatchObject({
      ok: true,
      persisted: true,
      briefId: "creative_briefs-1",
      event: {
        eventId: "events-1",
        replayed: false,
        idempotencyKey: briefSubmittedIdempotencyKey("creative_briefs-1"),
      },
    });

    const [event] = db.rows("events");
    expect(event).toMatchObject({
      type: BRIEF_SUBMITTED_EVENT_TYPE,
      business_unit: "CC",
      channel: "website",
      direction: "inbound",
      contact_id: "contacts-1",
      idempotency_key: briefSubmittedIdempotencyKey("creative_briefs-1"),
      event_version: BRIEF_SUBMITTED_EVENT_VERSION,
      payload: {
        brief_id: "creative_briefs-1",
        contact_id: "contacts-1",
        public_submission_id: submission.submissionId,
        source: "contentco-op.com/brief",
        structured_intake: { project, booking_preference: "20" },
      },
    });
    // The OS hydrators read these keys (os-marketing.ts, creative-brief-quote-draft.ts).
    expect(event.payload).toHaveProperty("intake_payload");
    expect(event.payload).not.toHaveProperty("access_token");

    const written = db.inserts.find((insert) => insert.table === "events")!;
    for (const column of Object.keys(written.payload)) {
      expect(BRIEF_SUBMITTED_EVENT_COLUMNS).toContain(column);
    }
    // Repo-declared ontology columns that live CCO-DB does not have must never be written.
    expect(written.payload).not.toHaveProperty("object_type");
    expect(written.payload).not.toHaveProperty("event_category");
    // The event lands before any email is attempted.
    expect(db.inserts.map((insert) => insert.table)).toEqual([
      "contacts",
      "creative_briefs",
      "events",
      "notification_log",
      "notification_log",
    ]);
  });

  test("an event write failure is an honest retryable state, never a success", async () => {
    const db = new FakeDatabase();
    db.insertErrorFor = "events";
    const sendEmail = vi.fn(sentEmail);

    const result = await persistCcoBrief(submission, { db, sendEmail });

    expect(result).toMatchObject({
      ok: false,
      persisted: true,
      retryable: true,
      error: "brief_event_write_failed",
      contactId: "contacts-1",
      briefId: "creative_briefs-1",
    });
    expect(db.rows("creative_briefs")).toHaveLength(1);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(db.rows("notification_log")).toHaveLength(0);

    // The browser keeps its submission id and retries: the stored brief is
    // replayed, the event is written, and only then do the emails go out.
    db.insertErrorFor = null;
    const retry = await persistCcoBrief(submission, { db, sendEmail });

    expect(retry).toMatchObject({
      ok: true,
      replayed: true,
      briefId: "creative_briefs-1",
      event: { eventId: "events-1", replayed: false },
    });
    expect(db.rows("creative_briefs")).toHaveLength(1);
    expect(db.rows("events")).toHaveLength(1);
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  test("a replayed brief never duplicates its event", async () => {
    const db = new FakeDatabase();
    const first = await persistCcoBrief(submission, { db, sendEmail: sentEmail });
    const second = await persistCcoBrief(submission, { db, sendEmail: sentEmail });

    expect(first).toMatchObject({ ok: true, event: { replayed: false } });
    expect(second).toMatchObject({ ok: true, replayed: true, event: { eventId: "events-1", replayed: true } });
    expect(db.rows("events")).toHaveLength(1);
  });

  test("a concurrent retry that loses the unique-index race resolves to the stored event", async () => {
    const db = new FakeDatabase();
    db.raceOnInsert = "events";

    const result = await persistCcoBrief(submission, { db, sendEmail: sentEmail });

    expect(result).toMatchObject({ ok: true, event: { eventId: "events-raced", replayed: true } });
    expect(db.rows("events")).toHaveLength(1);
  });

  test("an event lookup failure stops before any write", async () => {
    const db = new FakeDatabase();
    db.rows("contacts").push({
      id: "existing-contact",
      email: "avery@example.com",
      cco_public_email_key: "avery@example.com",
      business_unit: ["CC"],
      metadata: {},
    });
    db.rows("creative_briefs").push({
      id: "existing-brief",
      access_token: "a".repeat(32),
      status: "submitted",
      contact_name: contact.name,
      contact_email: contact.email,
      company: contact.company,
      company_account_id: "content-co-op",
      data: { public_submission_id: submission.submissionId, contact_id: "existing-contact", project },
    });
    db.selectErrorFor = "events";
    const sendEmail = vi.fn(sentEmail);

    const result = await persistCcoBrief(submission, { db, sendEmail });

    expect(result).toMatchObject({
      ok: false,
      persisted: true,
      retryable: true,
      error: "brief_event_lookup_failed",
      briefId: "existing-brief",
    });
    expect(db.inserts).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test("operator alert state is logged separately and never withdraws the brief or event", async () => {
    const db = new FakeDatabase();
    const sendEmail = vi.fn(async () => ({ ok: false, error: "FileNotFoundError: no gmail token" }));

    const result = await persistCcoBrief(submission, { db, sendEmail });

    expect(result).toMatchObject({
      ok: true,
      persisted: true,
      event: { replayed: false },
      notification: {
        admin: { status: "failed" },
        client: { status: "failed" },
      },
    });
    expect(db.rows("creative_briefs")).toHaveLength(1);
    expect(db.rows("events")).toHaveLength(1);
    const adminLog = db.rows("notification_log").find((row) => row.recipient === "bailey@contentco-op.com");
    expect(adminLog).toMatchObject({
      status: "failed",
      template_key: "cco_public_brief_admin_alert",
      related_entity_id: "creative_briefs-1",
      error_message: "FileNotFoundError: no gmail token",
    });
  });
});
