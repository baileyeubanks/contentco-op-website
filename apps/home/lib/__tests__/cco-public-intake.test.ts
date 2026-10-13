import { describe, expect, test, vi } from "vitest";
import {
  getCcoGeneratedBriefProposal,
  getCcoOsDatabase,
  getCcoPersistedProposalScope,
  persistCcoGeneratedBriefProposal,
  persistCcoBrief,
  persistCcoLead,
  cleanCcoLeadBasics,
  resolveCcoAdminAlertRecipients,
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
    if (this.db.rejectedOperation?.table === this.table && this.db.rejectedOperation.operation === this.operation) {
      throw new Error("synthetic private database failure");
    }
    if (this.db.missingOutcomeId && this.table === "notification_log" && this.operation === "update") {
      return { data: null, error: null };
    }
    const rows = this.db.rows(this.table);
    if (this.operation === "insert") {
      if (this.db.insertErrorFor === this.table) {
        return { data: null, error: { message: `${this.table}_insert_failed` } };
      }
      const row = { id: `${this.table}-${rows.length + 1}`, ...(this.payload || {}) };
      if (rows.some((existing) => existing.id === row.id)) {
        return { data: null, error: { code: "23505", message: "duplicate primary key" } };
      }
      rows.push(row);
      return { data: row, error: null };
    }

    const matched = rows.filter((row) => this.filters.every((filter) => matches(row, filter)));
    if (this.operation === "update") {
      const row = matched[0];
      if (!row) return { data: null, error: { message: `${this.table}_update_missing` } };
      Object.assign(row, this.payload || {});
      if (this.table === "notification_log" && this.payload?.status === this.db.wrongNotificationReceiptStatus) {
        return { data: { ...row, id: "wrong-notification-row" }, error: null };
      }
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
  rejectedOperation: { table: string; operation: "select" | "insert" | "update" } | null = null;
  missingOutcomeId = false;
  wrongNotificationReceiptStatus: "sending" | "sent" | "unknown" | null = null;

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
  test.each(["failed", "unknown"] as const)("reports Bailey's %s leg when an additive operator and client succeed", async (ownerStatus) => {
    const db = new FakeDatabase();
    const result = await persistCcoBrief(submission, {
      db,
      env: { CCO_ADMIN_ALERT_EMAILS: "operator@example.test" },
      sendEmail: async (message) => message.to === "bailey@contentco-op.com"
        ? { ok: false, error: "synthetic_failure", deliveryUnknown: ownerStatus === "unknown" }
        : { ok: true, id: "synthetic-provider-id" },
    });
    expect(result).toMatchObject({
      ok: true, persisted: true,
      notification: {
        admin: { status: "sent" },
        owner: { status: ownerStatus, logId: expect.any(String), providerReceiptPresent: false },
        client: { status: "sent" },
      },
    });
    expect(db.rows("creative_briefs")).toHaveLength(1);
  });

  test.each([undefined, "", "   ", 42, {}, []].map((providerId) => ({ providerId })))("a replayed sent Bailey log with malformed provider receipt %j stays unknown without sending", async ({ providerId }) => {
    const db = new FakeDatabase();
    const sendEmail = vi.fn(async () => ({ ok: true, id: "synthetic-provider-id" }));
    await persistCcoBrief(submission, { db, env: {}, sendEmail });
    const owner = db.rows("notification_log").find((row) => row.recipient === "bailey@contentco-op.com")!;
    owner.metadata = { ...(owner.metadata as Row), provider_message_id: providerId };
    sendEmail.mockClear();

    const replay = await persistCcoBrief(submission, { db, env: {}, sendEmail });
    expect(replay).toMatchObject({ ok: true, persisted: true, replayed: true,
      notification: { owner: { status: "unknown", providerReceiptPresent: false } } });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(db.rows("creative_briefs")).toHaveLength(1);
  });

  test("a contradictory failed Bailey log with a provider receipt is not resent", async () => {
    const db = new FakeDatabase();
    const sendEmail = vi.fn(async () => ({ ok: true, id: "synthetic-provider-id" }));
    await persistCcoBrief(submission, { db, env: {}, sendEmail });
    db.rows("notification_log").find((row) => row.recipient === "bailey@contentco-op.com")!.status = "failed";
    sendEmail.mockClear();
    expect(await persistCcoBrief(submission, { db, env: {}, sendEmail })).toMatchObject({
      ok: true, notification: { owner: { status: "unknown", providerReceiptPresent: true } },
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test.each([42, true, false, 0, {}, [], "", "   "].map((providerId) => ({ providerId })))(
    "a retained failed Bailey log with non-null malformed provider evidence %j is unknown without sending", async ({ providerId }) => {
      const db = new FakeDatabase();
      const sendEmail = vi.fn(async () => ({ ok: true, id: "synthetic-provider-id" }));
      const first = await persistCcoBrief(submission, { db, env: {}, sendEmail });
      if (!first.ok) throw new Error("Synthetic brief did not persist");
      const owner = db.rows("notification_log").find((row) => row.recipient === "bailey@contentco-op.com")!;
      owner.status = "failed";
      owner.metadata = { ...(owner.metadata as Row), provider_message_id: providerId };
      sendEmail.mockClear();

      const replay = await persistCcoBrief(submission, { db, env: {}, sendEmail });
      expect(replay).toMatchObject({ ok: true, persisted: true, replayed: true, briefId: first.briefId,
        notification: { owner: { status: "unknown", logId: owner.id, providerReceiptPresent: false } } });
      expect(sendEmail).not.toHaveBeenCalled();
      expect(db.rows("creative_briefs")).toHaveLength(1);
    },
  );

  test.each(["absent", "null"] as const)("a legitimate failed Bailey row with %s provider evidence can retry its same claim", async (evidence) => {
    const db = new FakeDatabase();
    const sendEmail = vi.fn(async () => ({ ok: true, id: "synthetic-provider-id" }));
    const first = await persistCcoBrief(submission, { db, env: {}, sendEmail });
    if (!first.ok) throw new Error("Synthetic brief did not persist");
    const owner = db.rows("notification_log").find((row) => row.recipient === "bailey@contentco-op.com")!;
    owner.status = "failed";
    const metadata = { ...(owner.metadata as Row) };
    if (evidence === "absent") delete metadata.provider_message_id;
    else metadata.provider_message_id = null;
    owner.metadata = metadata;
    sendEmail.mockClear();

    expect(await persistCcoBrief(submission, { db, env: {}, sendEmail })).toMatchObject({
      ok: true, replayed: true, briefId: first.briefId,
      notification: { owner: { status: "sent", logId: owner.id, providerReceiptPresent: true } },
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "bailey@contentco-op.com" }));
    expect(db.rows("creative_briefs")).toHaveLength(1);
  });

  test("a different final outcome row ID retains the brief without certifying acceptance or resending", async () => {
    const db = new FakeDatabase();
    db.wrongNotificationReceiptStatus = "sent";
    const sendEmail = vi.fn(async () => ({ ok: true, id: "synthetic-provider-id" }));
    const result = await persistCcoBrief(submission, { db, env: {}, sendEmail });
    expect(result).toMatchObject({ ok: false, persisted: true, partial: true,
      briefId: "creative_briefs-1", submissionId: submission.submissionId, error: "notification_log_update_failed" });
    expect(JSON.stringify(result)).not.toContain("wrong-notification-row");
    expect(db.rows("creative_briefs")).toHaveLength(1);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    db.wrongNotificationReceiptStatus = null;
    sendEmail.mockClear();
    expect(await persistCcoBrief(submission, { db, env: {}, sendEmail })).toMatchObject({ ok: true, replayed: true, briefId: "creative_briefs-1" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test("a different failed-row claim ID retains the brief and never invokes the provider", async () => {
    const db = new FakeDatabase();
    await persistCcoBrief(submission, { db, env: {}, sendEmail: async () => ({ ok: false, error: "synthetic_failure" }) });
    db.wrongNotificationReceiptStatus = "sending";
    const sendEmail = vi.fn(async () => ({ ok: true, id: "synthetic-provider-id" }));
    const result = await persistCcoBrief(submission, { db, env: {}, sendEmail });
    expect(result).toMatchObject({ ok: false, persisted: true, partial: true,
      briefId: "creative_briefs-1", submissionId: submission.submissionId, error: "notification_log_write_failed" });
    expect(JSON.stringify(result)).not.toContain("wrong-notification-row");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(db.rows("creative_briefs")).toHaveLength(1);
  });

  test("a different stale-recovery row ID cannot replace the known claim or trigger a resend", async () => {
    const db = new FakeDatabase();
    const sendEmail = vi.fn(async () => ({ ok: true, id: "synthetic-provider-id" }));
    await persistCcoBrief(submission, { db, env: {}, sendEmail });
    const owner = db.rows("notification_log").find((row) => row.recipient === "bailey@contentco-op.com")!;
    owner.status = "sending";
    owner.metadata = { ...(owner.metadata as Row), delivery_attempted_at: "2000-01-01T00:00:00.000Z" };
    db.wrongNotificationReceiptStatus = "unknown";
    sendEmail.mockClear();
    const result = await persistCcoBrief(submission, { db, env: {}, sendEmail });
    expect(result).toMatchObject({ ok: false, persisted: true, partial: true,
      briefId: "creative_briefs-1", submissionId: submission.submissionId, error: "notification_recovery_failed" });
    expect(JSON.stringify(result)).not.toContain("wrong-notification-row");
    expect(sendEmail).not.toHaveBeenCalled();
    db.wrongNotificationReceiptStatus = null;
    expect(await persistCcoBrief(submission, { db, env: {}, sendEmail })).toMatchObject({ ok: true, replayed: true,
      notification: { owner: { status: "unknown", logId: owner.id } } });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test.each(["select", "insert", "update"] as const)("a thrown notification %s after a new save retains the canonical brief receipt", async (operation) => {
    const db = new FakeDatabase();
    db.rejectedOperation = { table: "notification_log", operation };
    const sendEmail = vi.fn(async () => ({ ok: true, id: "synthetic-provider-id" }));
    const result = await persistCcoBrief(submission, { db, env: {}, sendEmail });
    expect(result).toMatchObject({ ok: false, persisted: true, partial: true, retryable: true,
      briefId: "creative_briefs-1", contactId: "contacts-1", submissionId: submission.submissionId,
      error: "notification_delivery_request_failed", event: { ok: true } });
    expect(JSON.stringify(result)).not.toContain("private database");
    expect(db.rows("creative_briefs")).toHaveLength(1);
    if (operation !== "update") expect(sendEmail).not.toHaveBeenCalled();
  });

  test("a thrown notification lookup on replay retains the same canonical brief receipt", async () => {
    const db = new FakeDatabase();
    const sendEmail = vi.fn(async () => ({ ok: true, id: "synthetic-provider-id" }));
    await persistCcoBrief(submission, { db, env: {}, sendEmail });
    sendEmail.mockClear();
    db.rejectedOperation = { table: "notification_log", operation: "select" };
    const result = await persistCcoBrief(submission, { db, env: {}, sendEmail });
    expect(result).toMatchObject({ ok: false, persisted: true, partial: true,
      briefId: "creative_briefs-1", contactId: "contacts-1", submissionId: submission.submissionId,
      error: "notification_delivery_request_failed", event: { ok: true, replayed: true } });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(db.rows("creative_briefs")).toHaveLength(1);
  });

  test("a missing final notification outcome ID cannot claim a durable acceptance", async () => {
    const db = new FakeDatabase();
    db.missingOutcomeId = true;
    const result = await persistCcoBrief(submission, { db, env: {}, sendEmail: async () => ({ ok: true, id: "synthetic-provider-id" }) });
    expect(result).toMatchObject({ ok: false, persisted: true, partial: true, briefId: "creative_briefs-1" });
  });

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
});

describe("step-1 quote basics travel with the lead", () => {
  test("a lead who stops after step 1 still leaves quotable basics on the contact", async () => {
    const db = new FakeDatabase();
    const lead = await persistCcoLead(
      { contact, basics: { projectTypes: ["training", "brand"], summary: "  Safety video for our plant  ", timeline: "1-2 months" } },
      { db },
    );
    expect(lead).toMatchObject({ ok: true, persisted: true });
    const intake = (db.rows("contacts")[0].metadata as Row).cco_public_intake as Row;
    expect(intake.basics).toEqual({
      project_types: ["training", "brand"],
      summary: "Safety video for our plant",
      timeline: "1-2 months",
    });
  });

  test("the final brief submit keeps the basics captured on step 1", async () => {
    const db = new FakeDatabase();
    await persistCcoLead({ contact, basics: { projectTypes: ["executive"], timeline: "ASAP" } }, { db });
    // CCO-DB derives this lookup key on insert; the fake database does not, so seed it.
    db.rows("contacts")[0].cco_public_email_key = String(contact.email).toLowerCase();
    await persistCcoBrief(submission, { db, sendEmail: async () => ({ ok: true, id: "provider-message-1" }) });
    expect(db.rows("contacts")).toHaveLength(1);
    const intake = (db.rows("contacts")[0].metadata as Row).cco_public_intake as Row;
    expect(intake.basics).toMatchObject({ project_types: ["executive"], timeline: "ASAP" });
  });

  test("nothing answered stores no basics, and long answers are bounded", () => {
    expect(cleanCcoLeadBasics({ projectTypes: [], summary: "  ", timeline: "" })).toBeNull();
    expect(cleanCcoLeadBasics(undefined)).toBeNull();
    const long = cleanCcoLeadBasics({ summary: "x".repeat(5000), projectTypes: Array(40).fill("brand") });
    expect(long?.summary).toHaveLength(1000);
    expect(long?.project_types).toHaveLength(12);
  });
});
