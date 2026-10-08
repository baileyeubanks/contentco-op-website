import { afterEach, describe, expect, test, vi } from "vitest";
import {
  CCO_BRIEF_EMAIL_DEDUPE_WINDOW_MS,
  CCO_BRIEF_EMAIL_MAX_SEND_ATTEMPTS,
  getCcoGeneratedBriefProposal,
  getCcoOsDatabase,
  getCcoPersistedProposalScope,
  persistCcoGeneratedBriefProposal,
  persistCcoBrief,
  persistCcoLead,
  resolveCcoAdminAlertRecipients,
  type CcoPublicIntakeDatabase,
} from "../cco-public-intake";

type Row = Record<string, unknown>;
type Filter =
  | { kind: "eq"; column: string; value: unknown }
  | { kind: "gte"; column: string; value: unknown }
  | { kind: "contains"; column: string; value: Record<string, unknown> | string[] };

class FakeQuery {
  private operation: "select" | "insert" | "update" = "select";
  private payload: Row | null = null;
  private filters: Filter[] = [];
  private ordering: { column: string; ascending: boolean } | null = null;
  private cap: number | null = null;

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

  gte(column: string, value: unknown) {
    this.db.queries.push({ table: this.table, op: "gte", column, value });
    this.filters.push({ kind: "gte", column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.ordering = { column, ascending: options?.ascending !== false };
    return this;
  }

  limit(count: number) {
    this.cap = count;
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
      if (this.db.insertThrowFor?.table === this.table) throw this.db.insertThrowFor.error;
      if (this.db.insertErrorFor === this.table) {
        return { data: null, error: { message: `${this.table}_insert_failed` } };
      }
      const row = {
        id: `${this.table}-${rows.length + 1}`,
        ...(this.db.stampCreatedAt ? { created_at: new Date().toISOString() } : {}),
        ...(this.payload || {}),
      };
      if (rows.some((existing) => existing.id === row.id)) {
        return { data: null, error: { code: "23505", message: "duplicate primary key" } };
      }
      rows.push(row);
      return { data: row, error: null };
    }

    if (this.db.gteErrorFor === this.table && this.filters.some((filter) => filter.kind === "gte")) {
      return { data: null, error: { message: "recent lookup failed: permission denied (SQLSTATE 42501)" } };
    }
    let matched = rows.filter((row) => this.filters.every((filter) => matches(row, filter)));
    if (this.ordering) {
      const { column, ascending } = this.ordering;
      matched = [...matched].sort((a, b) => String(a[column]).localeCompare(String(b[column])) * (ascending ? 1 : -1));
    }
    if (this.cap !== null) matched = matched.slice(0, this.cap);
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
  if (filter.kind === "gte") return typeof actual === "string" && actual >= String(filter.value);
  if (Array.isArray(filter.value)) {
    return Array.isArray(actual) && filter.value.every((item) => actual.includes(item));
  }
  if (!actual || typeof actual !== "object" || Array.isArray(actual)) return false;
  return Object.entries(filter.value).every(([key, value]) => (actual as Row)[key] === value);
}

class FakeDatabase implements CcoPublicIntakeDatabase {
  readonly tables = new Map<string, Row[]>();
  insertErrorFor: string | null = null;
  insertThrowFor: { table: string; error: Error } | null = null;
  /** Mirrors the creative_briefs.created_at default (now()) on insert. */
  stampCreatedAt = false;
  gteErrorFor: string | null = null;
  readonly queries: Array<{ table: string; op: string; column: string; value: unknown }> = [];

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

const proposal = {
  title: "Stored proposal",
  executiveSummary: "A stored executive summary.",
  creativeApproach: "A stored creative approach.",
  productionTimeline: "Week one.",
  investmentBreakdown: {
    lineItems: [{ item: "Production", description: "Production work", amount: 5000 }],
    totalLow: 5000,
    totalHigh: 7000,
    deposit: 2500,
  },
  teamAssignment: "Stored team assignment.",
  nextSteps: ["Review"],
  disclaimer: "Stored disclaimer.",
};

describe("CCO public intake persistence", () => {
  test("rejects a service client that is not bound to CCO-DB", () => {
    const binding = getCcoOsDatabase({
      CCO_SUPABASE_URL: "https://cviggizfmelffvpfzkmh.supabase.co",
      CCO_SUPABASE_SERVICE_KEY: "test-service-key",
    });

    expect(binding).toMatchObject({ ok: false, error: "cco_db_binding_invalid" });
  });

  test("requires HTTPS for the fixed CCO-DB binding", () => {
    const binding = getCcoOsDatabase({
      CCO_SUPABASE_URL: "http://briokwdoonawhxisbydy.supabase.co",
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
      notification: {
        admin: { status: "sent" },
        client: { status: "sent" },
      },
    });
    expect(db.rows("contacts")[0]).toMatchObject({
      business_unit: ["CC"],
      status: "lead",
      source: "contentco-op.com/brief",
    });
    // CCO-DB defines full_name as generated always from name. Supplying it in
    // an INSERT or UPDATE makes Postgres reject the entire contact receipt.
    expect(db.rows("contacts")[0]).not.toHaveProperty("full_name");
    // The database derives the canonical lookup key from email. Public input
    // must never be allowed to write or desynchronize that generated value.
    expect(db.rows("contacts")[0]).not.toHaveProperty("cco_public_email_key");
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
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "avery@example.com",
      businessUnit: "CC",
    }));
    expect(db.rows("notification_log")[0]).toMatchObject({
      status: "sent",
      recipient: "bailey@contentco-op.com",
      audience: "internal",
      related_entity_type: "creative_brief",
      related_entity_id: "creative_briefs-1",
    });
    expect(db.rows("notification_log")).toHaveLength(2);
    expect(db.rows("notification_log")[1]).toMatchObject({
      status: "sent",
      recipient: "avery@example.com",
      audience: "client",
      related_entity_type: "creative_brief",
      related_entity_id: "creative_briefs-1",
    });
  });

  test("reuses a mixed-case CC contact without overwriting operator-owned contact fields", async () => {
    const db = new FakeDatabase();
    db.rows("contacts").push({
      id: "existing-contact",
      name: "Operator Curated Name",
      email: "Avery@Example.com",
      phone: "+17135550199",
      company: "Authoritative Account",
      title: "Chief Marketing Officer",
      website: "https://authoritative.example",
      address: "Austin, TX",
      location: "Austin, TX",
      status: "active_client",
      contact_type: "client",
      source: "operator_import",
      cco_public_email_key: "avery@example.com",
      business_unit: ["CC"],
      metadata: { preserved: true },
    });

    const lead = await persistCcoLead({ contact }, { db });
    const brief = await persistCcoBrief(submission, {
      db,
      sendEmail: async () => ({ ok: true, id: "provider-message-1" }),
    });

    expect(lead).toMatchObject({ ok: true, contactId: "existing-contact", replayed: true });
    expect(brief).toMatchObject({ ok: true, contactId: "existing-contact" });
    expect(db.rows("contacts")).toHaveLength(1);
    expect(db.rows("contacts")[0]).toMatchObject({
      name: "Operator Curated Name",
      email: "Avery@Example.com",
      phone: "+17135550199",
      company: "Authoritative Account",
      title: "Chief Marketing Officer",
      website: "https://authoritative.example",
      address: "Austin, TX",
      location: "Austin, TX",
      status: "active_client",
      contact_type: "client",
      source: "operator_import",
      cco_public_email_key: "avery@example.com",
      metadata: expect.objectContaining({
        preserved: true,
        cco_public_intake: expect.objectContaining({
          source: "contentco-op.com/brief",
          contact: expect.objectContaining({
            name: "Avery Brooks",
            email: "avery@example.com",
            company: "Example Industrial",
          }),
        }),
      }),
    });
  });

  test("builds and serves a proposal only from the stored brief receipt", async () => {
    const db = new FakeDatabase();
    const saved = await persistCcoBrief(submission, {
      db,
      sendEmail: async () => ({ ok: true, id: "provider-message-1" }),
    });
    if (!saved.ok) throw new Error("fixture brief did not persist");

    const accessToken = "a".repeat(32);
    db.rows("creative_briefs")[0].access_token = accessToken;
    const scope = getCcoPersistedProposalScope(db.rows("creative_briefs")[0]);
    expect(scope).toMatchObject({
      contact: { name: "Avery Brooks", company: "Example Industrial" },
      project: { projectName: "Launch proof film" },
    });

    const first = await persistCcoGeneratedBriefProposal({
      briefId: saved.briefId,
      accessToken,
      proposal,
    }, { db });
    const replay = await persistCcoGeneratedBriefProposal({
      briefId: saved.briefId,
      accessToken,
      proposal,
    }, { db });

    expect(first).toEqual({ ok: true, replayed: false });
    expect(replay).toEqual({ ok: true, replayed: true });
    expect(getCcoGeneratedBriefProposal(db.rows("creative_briefs")[0])).toEqual(proposal);
  });

  test("refuses a malformed generated proposal before changing the durable brief", async () => {
    const db = new FakeDatabase();
    const saved = await persistCcoBrief(submission, {
      db,
      sendEmail: async () => ({ ok: true, id: "provider-message-1" }),
    });
    if (!saved.ok) throw new Error("fixture brief did not persist");

    const accessToken = "a".repeat(32);
    db.rows("creative_briefs")[0].access_token = accessToken;

    const result = await persistCcoGeneratedBriefProposal({
      briefId: saved.briefId,
      accessToken,
      proposal: {} as typeof proposal,
    }, { db });

    expect(result).toEqual({ ok: false, error: "proposal_invalid", retryable: false });
    expect(getCcoGeneratedBriefProposal(db.rows("creative_briefs")[0])).toBeNull();
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
      notification: {
        admin: { status: "failed" },
        client: { status: "failed" },
      },
    });
    expect(db.rows("notification_log")[0]).toMatchObject({
      status: "failed",
      error_message: "provider_unavailable",
    });
  });

  test("records client and admin delivery outcomes independently", async () => {
    const db = new FakeDatabase();
    const result = await persistCcoBrief(submission, {
      db,
      sendEmail: async (message) => (
        message.to === "bailey@contentco-op.com"
          ? { ok: true, id: "admin-provider-message" }
          : { ok: false, error: "client_provider_unavailable" }
      ),
    });

    expect(result).toMatchObject({
      ok: true,
      persisted: true,
      notification: {
        admin: { status: "sent" },
        client: { status: "failed" },
      },
    });
    expect(db.rows("notification_log")).toEqual(expect.arrayContaining([
      expect.objectContaining({ recipient: "bailey@contentco-op.com", status: "sent" }),
      expect.objectContaining({
        recipient: "avery@example.com",
        status: "failed",
        error_message: "client_provider_unavailable",
      }),
    ]));
  });

  test("records a thrown provider error as unknown and never resends it", async () => {
    const db = new FakeDatabase();
    const sendEmail = vi.fn(async () => {
      throw new Error("provider_timeout");
    });
    const result = await persistCcoBrief(submission, {
      db,
      sendEmail,
    });

    expect(result).toMatchObject({
      ok: true,
      persisted: true,
      notification: {
        admin: { status: "unknown" },
        client: { status: "unknown" },
      },
    });
    expect(db.rows("notification_log")[0]).toMatchObject({
      status: "unknown",
      error_message: "delivery_outcome_unknown",
      metadata: expect.objectContaining({ delivery_error: "provider_timeout" }),
    });

    const replay = await persistCcoBrief(submission, { db, sendEmail });
    expect(replay).toMatchObject({
      ok: true,
      replayed: true,
      notification: {
        admin: { status: "unknown" },
        client: { status: "unknown" },
      },
    });
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  test("records an explicitly ambiguous provider result as unknown", async () => {
    const db = new FakeDatabase();
    const result = await persistCcoBrief(submission, {
      db,
      sendEmail: async () => ({
        ok: false,
        error: "provider_acknowledgement_lost",
        deliveryUnknown: true,
      }),
    });

    expect(result).toMatchObject({
      ok: true,
      persisted: true,
      notification: {
        admin: { status: "unknown" },
        client: { status: "unknown" },
      },
    });
    expect(db.rows("notification_log")[0]).toMatchObject({
      status: "unknown",
      error_message: "delivery_outcome_unknown",
      metadata: expect.objectContaining({
        delivery_error: "provider_acknowledgement_lost",
      }),
    });
  });

  test("requires a provider message id before recording a sent notification", async () => {
    const db = new FakeDatabase();
    const sendEmail = vi.fn(async () => ({ ok: true }));

    const result = await persistCcoBrief(submission, { db, sendEmail });

    expect(result).toMatchObject({
      ok: true,
      persisted: true,
      notification: {
        admin: { status: "unknown" },
        client: { status: "unknown" },
      },
    });
    expect(db.rows("notification_log")[0]).toMatchObject({
      status: "unknown",
      error_message: "delivery_outcome_unknown",
      metadata: expect.objectContaining({
        provider_message_id: null,
        delivery_error: "provider_receipt_missing",
      }),
    });

    await persistCcoBrief(submission, { db, sendEmail });
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  test("treats a provider id paired with failure as an ambiguous handoff", async () => {
    const db = new FakeDatabase();
    const sendEmail = vi.fn(async () => ({
      ok: false,
      id: "provider-id-despite-failure",
      error: "provider_response_conflict",
    }));

    const result = await persistCcoBrief(submission, { db, sendEmail });

    expect(result).toMatchObject({
      ok: true,
      persisted: true,
      notification: {
        admin: { status: "unknown" },
        client: { status: "unknown" },
      },
    });
    expect(db.rows("notification_log")[0]).toMatchObject({
      status: "unknown",
      error_message: "delivery_outcome_unknown",
      metadata: expect.objectContaining({
        provider_message_id: "provider-id-despite-failure",
        delivery_error: "provider_response_conflict",
      }),
    });

    await persistCcoBrief(submission, { db, sendEmail });
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  test("retries only the failed leg when the other delivery outcome is unknown", async () => {
    const db = new FakeDatabase();
    const first = await persistCcoBrief(submission, {
      db,
      sendEmail: async (message) => {
        if (message.to === "bailey@contentco-op.com") {
          throw new Error("admin_provider_timeout");
        }
        return { ok: false, error: "client_rejected" };
      },
    });
    expect(first).toMatchObject({
      ok: true,
      notification: {
        admin: { status: "unknown" },
        client: { status: "failed" },
      },
    });

    const resend = vi.fn(async () => ({ ok: true, id: "client-retry-provider-id" }));
    const replay = await persistCcoBrief(submission, { db, sendEmail: resend });

    expect(replay).toMatchObject({
      ok: true,
      replayed: true,
      notification: {
        admin: { status: "unknown" },
        client: { status: "sent" },
      },
    });
    expect(resend).toHaveBeenCalledTimes(1);
    expect(resend).toHaveBeenCalledWith(expect.objectContaining({
      to: "avery@example.com",
    }));
    expect(db.rows("notification_log")).toHaveLength(2);
  });

  test("turns a stranded sending record into an explicit unknown outcome without resending", async () => {
    const db = new FakeDatabase();
    db.rows("creative_briefs").push({
      id: "creative_briefs-1",
      company_account_id: "content-co-op",
      contact_name: contact.name,
      contact_email: "avery@example.com",
      phone: contact.phone,
      company: contact.company,
      role: contact.role,
      location: contact.address,
      source_path: "/brief",
      booking_intent: "discovery_call_20",
      data: {
        public_submission_id: submission.submissionId,
        contact_id: "contacts-1",
        project,
      },
    });
    for (const [id, recipient, template_key] of [
      ["notification_log-1", "bailey@contentco-op.com", "cco_public_brief_admin_alert"],
      ["notification_log-2", "avery@example.com", "cco_public_brief_client_receipt"],
    ]) {
      db.rows("notification_log").push({
        id,
        recipient,
        template_key,
        related_entity_type: "creative_brief",
        related_entity_id: "creative_briefs-1",
        status: "sending",
        metadata: { delivery_attempted_at: new Date(Date.now() - (3 * 60 * 1000)).toISOString() },
      });
    }
    const sendEmail = vi.fn(async () => ({ ok: true, id: "should-not-send" }));

    const result = await persistCcoBrief(submission, { db, sendEmail });

    expect(result).toMatchObject({
      ok: true,
      persisted: true,
      replayed: true,
      notification: {
        admin: { status: "unknown" },
        client: { status: "unknown" },
      },
    });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(db.rows("notification_log")).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "unknown", error_message: "delivery_outcome_unknown" }),
    ]));
  });

  test("reuses the browser submission id without duplicating the brief or either delivery", async () => {
    const db = new FakeDatabase();
    const sendEmail = vi.fn(async () => ({ ok: true, id: "provider-message-1" }));

    const first = await persistCcoBrief(submission, { db, sendEmail });
    const replay = await persistCcoBrief(submission, { db, sendEmail });

    expect(first).toMatchObject({ ok: true, persisted: true, replayed: false });
    expect(replay).toMatchObject({ ok: true, persisted: true, replayed: true });
    expect(db.rows("creative_briefs")).toHaveLength(1);
    expect(db.rows("notification_log")).toHaveLength(2);
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  test("retries failed delivery from the persisted brief rather than altered replay input", async () => {
    const db = new FakeDatabase();
    const first = await persistCcoBrief(submission, {
      db,
      sendEmail: async () => ({ ok: false, error: "provider_unavailable" }),
    });
    expect(first).toMatchObject({
      ok: true,
      notification: {
        admin: { status: "failed" },
        client: { status: "failed" },
      },
    });

    const alteredReplay = {
      ...submission,
      contact: { ...contact, name: "Changed Caller", company: "Unpersisted Co" },
      project: {
        ...project,
        projectName: "Unpersisted Project",
        projectContext: "This scope was never stored and must never be sent in a retry email.",
      },
    };
    const resend = vi.fn(async () => ({ ok: true, id: "provider-message-retry" }));
    const replay = await persistCcoBrief(alteredReplay, { db, sendEmail: resend });

    expect(replay).toMatchObject({ ok: true, replayed: true });
    expect(resend).toHaveBeenCalledWith(expect.objectContaining({
      subject: "New Content Co-Op brief: Avery Brooks — Example Industrial",
      text: expect.stringContaining("Launch proof film"),
    }));
    expect(resend).not.toHaveBeenCalledWith(expect.objectContaining({
      subject: expect.stringContaining("Changed Caller"),
    }));
    expect(db.rows("notification_log")).toEqual(expect.arrayContaining([
      expect.objectContaining({
        template_key: "cco_public_brief_admin_alert",
        body_text: expect.stringContaining("Launch proof film"),
      }),
    ]));
  });

  test("does not disclose an existing proposal capability when a replay email differs", async () => {
    const db = new FakeDatabase();
    const first = await persistCcoBrief(submission, {
      db,
      sendEmail: async () => ({ ok: true, id: "provider-message-1" }),
    });
    if (!first.ok) throw new Error("fixture brief did not persist");

    const result = await persistCcoBrief({
      ...submission,
      contact: { ...contact, email: "other@example.com" },
    }, { db, sendEmail: async () => ({ ok: true, id: "should-not-send" }) });

    expect(result).toEqual({
      ok: false,
      persisted: false,
      error: "brief_submission_conflict",
      retryable: false,
    });
    expect(db.rows("creative_briefs")).toHaveLength(1);
    expect(db.rows("notification_log")).toHaveLength(2);
  });

  test("claims failed delivery records once when simultaneous retries arrive", async () => {
    const db = new FakeDatabase();
    await persistCcoBrief(submission, {
      db,
      sendEmail: async () => ({ ok: false, error: "first_attempt_failed" }),
    });
    const sendEmail = vi.fn(async () => ({ ok: true, id: "retry-provider-message" }));

    const retries = await Promise.all([
      persistCcoBrief(submission, { db, sendEmail }),
      persistCcoBrief(submission, { db, sendEmail }),
    ]);

    expect(retries.some((result) => result.ok)).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(db.rows("creative_briefs")).toHaveLength(1);
    expect(db.rows("notification_log")).toHaveLength(2);
    expect(db.rows("notification_log")).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "sent" }),
    ]));
  });

  test("lead capture itself requires a returned database receipt", async () => {
    const db = new FakeDatabase();
    db.insertErrorFor = "contacts";

    const result = await persistCcoLead({ contact }, { db });

    expect(result).toMatchObject({ ok: false, persisted: false, error: "contact_write_failed" });
  });

  test("reports a saved contact as a partial failure when the brief insert is rejected", async () => {
    const db = new FakeDatabase();
    db.insertErrorFor = "creative_briefs";

    const result = await persistCcoBrief(submission, { db, sendEmail: async () => ({ ok: true }) });

    expect(result).toMatchObject({
      ok: false,
      persisted: false,
      partial: true,
      contactId: "contacts-1",
      error: "brief_write_failed",
    });
  });
});

describe("CCO public intake operator alerting", () => {
  test("alerts the pinned operator address and every additive CCO_ADMIN_ALERT_EMAILS entry", async () => {
    const db = new FakeDatabase();
    const sendEmail = vi.fn(async () => ({ ok: true, id: "provider-message-1" }));

    const result = await persistCcoBrief(submission, {
      db,
      sendEmail,
      env: { CCO_ADMIN_ALERT_EMAILS: "baileyeubanks@gmail.com, ops@contentco-op.com;bailey@contentco-op.com" },
    });

    expect(result).toMatchObject({
      ok: true,
      notification: {
        admin: { status: "sent" },
        client: { status: "sent" },
      },
    });
    const adminRecipients = result.ok ? result.notification.admin_recipients.map((entry) => entry.recipient) : [];
    expect(adminRecipients).toEqual(["bailey@contentco-op.com", "baileyeubanks@gmail.com", "ops@contentco-op.com"]);
    expect(db.rows("notification_log").filter((row) => row.template_key === "cco_public_brief_admin_alert")).toHaveLength(3);
    expect(db.rows("notification_log").filter((row) => row.template_key === "cco_public_brief_client_receipt")).toHaveLength(1);
  });

  test("ignores malformed roster entries and never drops the pinned default", () => {
    expect(resolveCcoAdminAlertRecipients({ CCO_ADMIN_ALERT_EMAILS: "not-an-email,, ,x@y" })).toEqual([
      "bailey@contentco-op.com",
    ]);
    expect(resolveCcoAdminAlertRecipients({})).toEqual(["bailey@contentco-op.com"]);
  });

  test("admin alert is sent if any operator recipient succeeded", async () => {
    const db = new FakeDatabase();
    const result = await persistCcoBrief(submission, {
      db,
      env: { CCO_ADMIN_ALERT_EMAILS: "baileyeubanks@gmail.com" },
      sendEmail: async (message) => (
        message.to === "baileyeubanks@gmail.com"
          ? { ok: true, id: "gmail-provider-message" }
          : { ok: false, error: "provider_unavailable" }
      ),
    });

    expect(result).toMatchObject({ ok: true, notification: { admin: { status: "sent" } } });
    expect(result.ok ? result.notification.admin_recipients : []).toEqual([
      expect.objectContaining({ recipient: "bailey@contentco-op.com", status: "failed" }),
      expect.objectContaining({ recipient: "baileyeubanks@gmail.com", status: "sent" }),
    ]);
  });

  test("admin alert carries the CCO OS review link and the rule-based instant estimate", async () => {
    const db = new FakeDatabase();
    const sent: Array<{ to: string; text?: string }> = [];
    const sendEmail = async (message: { to: string; text?: string }) => {
      sent.push(message);
      return { ok: true, id: "provider-message-1" };
    };

    const result = await persistCcoBrief(submission, { db, sendEmail });
    const briefId = result.ok ? result.briefId : "";
    const adminCall = sent.find((message) => message.to === "bailey@contentco-op.com");

    expect(adminCall?.text).toContain(`https://admin.contentco-op.com/os/marketing/briefs/${briefId}`);
    expect(adminCall?.text).toMatch(/Instant estimate: \$[\d,]+ – \$[\d,]+/);
  });

  test("records one durable brief_submitted event per brief, even across a retry", async () => {
    const db = new FakeDatabase();
    const sendEmail = vi.fn(async () => ({ ok: false, error: "provider_unavailable" }));

    const first = await persistCcoBrief(submission, { db, sendEmail });
    expect(first).toMatchObject({ ok: true, event: { ok: true, replayed: false } });

    const briefId = first.ok ? first.briefId : "";
    const events = db.rows("events");
    expect(events).toHaveLength(1);
    // public.events has no idempotency_key or event_version columns
    // (20260317_root_ontology_core.sql). A row that includes them is rejected
    // by PostgREST and the durable event never lands.
    const eventsColumns = new Set([
      "id", "type", "business_id", "business_unit", "contact_id", "text",
      "payload", "metadata", "channel", "direction", "created_at",
      "object_type", "object_id", "event_category",
    ]);
    expect(Object.keys(events[0]).filter((key) => !eventsColumns.has(key))).toEqual([]);
    expect(events[0]).toMatchObject({
      type: "brief_submitted",
      business_unit: "CC",
      channel: "website",
      direction: "inbound",
      metadata: { idempotency_key: `brief_submitted:${briefId}`, event_version: "cco.public-brief-submitted.v1" },
    });
    const payload = events[0].payload as Record<string, unknown>;
    expect(payload.brief_id).toBe(briefId);
    expect(payload.idempotency_key).toBe(`brief_submitted:${briefId}`);
    expect(payload.public_submission_id).toBe(submission.submissionId);
    expect((payload.structured_intake as Record<string, unknown>).project).toMatchObject({ projectName: "Launch proof film" });

    const retry = await persistCcoBrief(submission, { db, sendEmail });
    expect(retry).toMatchObject({ ok: true, replayed: true, event: { ok: true, replayed: true } });
    expect(db.rows("events")).toHaveLength(1);
  });

  test("a failed handoff preserves the brief and retries without resending delivered emails", async () => {
    const db = new FakeDatabase();
    db.insertErrorFor = "events";

    const sendEmail = vi.fn(async () => ({ ok: true, id: "provider-message-1" }));
    const result = await persistCcoBrief(submission, { db, sendEmail });

    expect(result).toMatchObject({ ok: false, persisted: true, partial: true, retryable: true,
      briefId: "creative_briefs-1", submissionId: submission.submissionId,
      notification: { admin: { status: "sent" }, client: { status: "sent" } }, event: { ok: false } });
    expect(db.rows("creative_briefs")).toHaveLength(1);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    db.insertErrorFor = null;
    const retries = await Promise.all([
      persistCcoBrief(submission, { db, sendEmail }),
      persistCcoBrief(submission, { db, sendEmail }),
    ]);
    for (const retry of retries) expect(retry).toMatchObject({ ok: true, replayed: true,
      briefId: "creative_briefs-1", submissionId: submission.submissionId, event: { ok: true } });
    expect(db.rows("creative_briefs")).toHaveLength(1);
    expect(db.rows("events")).toHaveLength(1);
    expect(db.rows("notification_log")).toHaveLength(2);
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });
  test("Grader PR #4 SF1: a thrown event write returns a fixed code; the raw text goes to the server log", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const raw = "fetch failed: connect ECONNREFUSED 10.0.0.5:5432 for svc-writer@db.internal (relation \"events\")";
    const db = new FakeDatabase();
    db.insertThrowFor = { table: "events", error: new Error(raw) };
    const sendEmail = vi.fn(async () => ({ ok: true, id: "provider-message-1" }));

    const result = await persistCcoBrief(submission, { db, sendEmail });

    expect(result).toMatchObject({ ok: false, persisted: true, partial: true, retryable: true,
      error: "event_write_failed", event: { ok: false, replayed: false, error: "event_write_failed" } });
    const returned = JSON.stringify(result);
    for (const leaked of ["ECONNREFUSED", "10.0.0.5", "db.internal", "svc-writer", "fetch failed", "relation"]) {
      expect(returned).not.toContain(leaked);
    }
    expect(JSON.stringify(errorSpy.mock.calls)).toContain("ECONNREFUSED 10.0.0.5:5432");
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

describe("SF5 (Grader PR #4): email-window dedupe and the per-brief email send cap", () => {
  const NOW = new Date("2026-10-08T06:00:30.000Z");
  const OTHER_SUBMISSION_ID = "0d9f3c2a-6b1e-4f7a-9c8d-2e5b7a1c4f60";

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** Recipients of every provider call, in order. */
  function sentTo(sendEmail: { mock: { calls: unknown[][] } }) {
    return sendEmail.mock.calls.map((call) => (call[0] as { to: string }).to);
  }

  function seedRecentBrief(db: FakeDatabase, ageMs: number, email = "avery@example.com") {
    db.rows("creative_briefs").push({
      id: "creative_briefs-seed",
      company_account_id: "content-co-op",
      contact_name: contact.name,
      contact_email: email,
      company: contact.company,
      access_token: "seed-proposal-token-0123456789abcdef",
      created_at: new Date(NOW.getTime() - ageMs).toISOString(),
      data: { public_submission_id: OTHER_SUBMISSION_ID, contact_id: "contacts-seed", project },
    });
  }

  test("pins the constants: a 10 minute window and 3 provider attempts per notification", () => {
    expect(CCO_BRIEF_EMAIL_DEDUPE_WINDOW_MS).toBe(10 * 60 * 1000);
    expect(CCO_BRIEF_EMAIL_MAX_SEND_ATTEMPTS).toBe(3);
  });

  test("a fresh submission id for an email with a brief inside the window writes nothing and sends nothing", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const db = new FakeDatabase();
    seedRecentBrief(db, 2 * 60 * 1000);
    const sendEmail = vi.fn(async () => ({ ok: true, id: "should-not-send" }));

    const result = await persistCcoBrief(submission, { db, sendEmail, env: {} });

    expect(result).toEqual({ ok: false, persisted: false, error: "brief_recently_received", retryable: false });
    expect(JSON.stringify(result)).not.toContain("seed-proposal-token");
    expect(JSON.stringify(result)).not.toContain("creative_briefs-seed");
    expect(db.rows("creative_briefs")).toHaveLength(1);
    expect(db.rows("contacts")).toHaveLength(0);
    expect(db.rows("notification_log")).toHaveLength(0);
    expect(db.rows("events")).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(db.queries).toContainEqual({
      table: "creative_briefs",
      op: "gte",
      column: "created_at",
      value: new Date(NOW.getTime() - 10 * 60 * 1000).toISOString(),
    });
  });

  test("matches the stored address case-insensitively", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const db = new FakeDatabase();
    seedRecentBrief(db, 60 * 1000);
    const sendEmail = vi.fn(async () => ({ ok: true, id: "should-not-send" }));

    const result = await persistCcoBrief(
      { ...submission, contact: { ...contact, email: "  AVERY@Example.COM " } },
      { db, sendEmail, env: {} },
    );

    expect(result).toMatchObject({ ok: false, error: "brief_recently_received" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test.each([
    ["just inside the window", 10 * 60 * 1000 - 1000, true],
    ["just outside the window", 10 * 60 * 1000 + 1000, false],
    ["an hour old", 60 * 60 * 1000, false],
  ])("window boundary: a brief %s", async (_label, ageMs, deduped) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const db = new FakeDatabase();
    seedRecentBrief(db, ageMs);
    const sendEmail = vi.fn(async () => ({ ok: true, id: "provider-message" }));

    const result = await persistCcoBrief(submission, { db, sendEmail, env: {} });

    if (deduped) {
      expect(result).toMatchObject({ ok: false, error: "brief_recently_received" });
      expect(db.rows("creative_briefs")).toHaveLength(1);
      expect(sendEmail).not.toHaveBeenCalled();
    } else {
      expect(result).toMatchObject({ ok: true, persisted: true, replayed: false });
      expect(db.rows("creative_briefs")).toHaveLength(2);
      expect(sendEmail).toHaveBeenCalledTimes(2);
    }
  });

  test("only CCO briefs for the same address count", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    const db = new FakeDatabase();
    seedRecentBrief(db, 60 * 1000, "someone-else@example.com");
    db.rows("creative_briefs").push({
      id: "creative_briefs-other-account",
      company_account_id: "another-account",
      contact_email: "avery@example.com",
      created_at: new Date(NOW.getTime() - 60 * 1000).toISOString(),
      data: {},
    });
    const sendEmail = vi.fn(async () => ({ ok: true, id: "provider-message" }));

    const result = await persistCcoBrief(submission, { db, sendEmail, env: {} });

    expect(result).toMatchObject({ ok: true, persisted: true, replayed: false });
  });

  test("end to end: first brief saves, a fresh id 5 minutes later is deduped, 11 minutes later it saves", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const db = new FakeDatabase();
    db.stampCreatedAt = true;
    const sendEmail = vi.fn(async () => ({ ok: true, id: "provider-message" }));

    const first = await persistCcoBrief(submission, { db, sendEmail, env: {} });
    expect(first).toMatchObject({ ok: true, replayed: false });

    vi.setSystemTime(new Date(NOW.getTime() + 5 * 60 * 1000));
    const second = await persistCcoBrief({ ...submission, submissionId: OTHER_SUBMISSION_ID }, { db, sendEmail, env: {} });
    expect(second).toMatchObject({ ok: false, error: "brief_recently_received" });

    // The original id still replays inside the window (the id lookup runs first).
    const replay = await persistCcoBrief(submission, { db, sendEmail, env: {} });
    expect(replay).toMatchObject({ ok: true, replayed: true, briefId: "creative_briefs-1" });

    vi.setSystemTime(new Date(NOW.getTime() + 11 * 60 * 1000));
    const later = await persistCcoBrief({ ...submission, submissionId: OTHER_SUBMISSION_ID }, { db, sendEmail, env: {} });
    expect(later).toMatchObject({ ok: true, replayed: false, briefId: "creative_briefs-2" });

    expect(db.rows("creative_briefs")).toHaveLength(2);
    // One admin alert and one client receipt per saved brief; the dedupe and the replay sent nothing.
    expect(sendEmail).toHaveBeenCalledTimes(4);
    const adminAlerts = sentTo(sendEmail).filter((to) => to === "bailey@contentco-op.com");
    expect(adminAlerts).toHaveLength(2);
  });

  test("a failed recent-brief lookup fails closed with a fixed, retryable code and no insert", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    const db = new FakeDatabase();
    db.gteErrorFor = "creative_briefs";
    const sendEmail = vi.fn(async () => ({ ok: true, id: "should-not-send" }));

    const result = await persistCcoBrief(submission, { db, sendEmail, env: {} });

    expect(result).toEqual({ ok: false, persisted: false, error: "brief_recent_lookup_failed", retryable: true });
    expect(db.rows("creative_briefs")).toHaveLength(0);
    expect(db.rows("contacts")).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test("a failing notification reaches the provider at most CCO_BRIEF_EMAIL_MAX_SEND_ATTEMPTS times per brief", async () => {
    const db = new FakeDatabase();
    const sendEmail = vi.fn(async () => ({ ok: false, error: "provider_unavailable" }));

    await persistCcoBrief(submission, { db, sendEmail, env: {} });
    for (let retry = 0; retry < 4; retry += 1) {
      const replay = await persistCcoBrief(submission, { db, sendEmail, env: {} });
      expect(replay).toMatchObject({ ok: true, replayed: true,
        notification: { admin: { status: "failed" }, client: { status: "failed" } } });
    }

    // 2 notifications (operator alert + client receipt) x 3 attempts; retries 3 and 4 sent nothing.
    expect(sendEmail).toHaveBeenCalledTimes(2 * 3);
    const adminAttempts = sentTo(sendEmail).filter((to) => to === "bailey@contentco-op.com");
    expect(adminAttempts).toHaveLength(3);
    expect(db.rows("notification_log")).toHaveLength(2);
    for (const row of db.rows("notification_log")) {
      expect(row).toMatchObject({ status: "failed", metadata: expect.objectContaining({ delivery_attempts: 3 }) });
    }
  });

  test("the cap holds for every roster recipient", async () => {
    const db = new FakeDatabase();
    const sendEmail = vi.fn(async () => ({ ok: false, error: "provider_unavailable" }));
    const env = { CCO_ADMIN_ALERT_EMAILS: "ops-alerts@contentco-op.com" };

    for (let attempt = 0; attempt < 6; attempt += 1) await persistCcoBrief(submission, { db, sendEmail, env });

    for (const recipient of ["bailey@contentco-op.com", "ops-alerts@contentco-op.com", "avery@example.com"]) {
      const calls = sentTo(sendEmail).filter((to) => to === recipient);
      expect(calls).toHaveLength(CCO_BRIEF_EMAIL_MAX_SEND_ATTEMPTS);
    }
  });

  test("a legacy failed log row without a counter counts as one attempt", async () => {
    const db = new FakeDatabase();
    const first = await persistCcoBrief(submission, {
      db, sendEmail: async () => ({ ok: false, error: "provider_unavailable" }), env: {},
    });
    expect(first).toMatchObject({ ok: true });
    for (const row of db.rows("notification_log")) {
      const metadata = { ...(row.metadata as Record<string, unknown>) };
      delete metadata.delivery_attempts;
      row.metadata = metadata;
    }
    const sendEmail = vi.fn(async () => ({ ok: false, error: "provider_unavailable" }));

    for (let retry = 0; retry < 3; retry += 1) await persistCcoBrief(submission, { db, sendEmail, env: {} });

    // Attempts 2 and 3 for each of the two notifications, then nothing.
    expect(sendEmail).toHaveBeenCalledTimes(2 * 2);
  });

  test("a delivered operator alert is sent once per brief, across replays and the email window", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const db = new FakeDatabase();
    db.stampCreatedAt = true;
    const sendEmail = vi.fn(async () => ({ ok: true, id: "provider-message" }));

    await persistCcoBrief(submission, { db, sendEmail, env: {} });
    await persistCcoBrief(submission, { db, sendEmail, env: {} });
    await persistCcoBrief({ ...submission, submissionId: OTHER_SUBMISSION_ID }, { db, sendEmail, env: {} });

    const adminAlerts = sentTo(sendEmail).filter((to) => to === "bailey@contentco-op.com");
    expect(adminAlerts).toHaveLength(1);
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });
});
