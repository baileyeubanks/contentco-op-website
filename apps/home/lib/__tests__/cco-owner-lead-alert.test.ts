import { afterEach, describe, expect, test, vi } from "vitest";
import {
  CCO_OWNER_ALERT_EMAIL,
  CCO_OWNER_CATCHUP_ID,
  CCO_OWNER_LEAD_ALERT_TEMPLATE,
  ownerAlertClaimId,
  ownerAlertDedupeId,
  assertOwnerOnlyRecipients,
  buildCcoOwnerCatchUpAlert,
  buildCcoOwnerLeadAlert,
  countsAsIntakeOwnerDelivery,
  notifyCcoOwnerCatchUp,
  notifyCcoOwnerOfStoredLead,
  notifyCcoOwnerOfStoredLeadSafely,
  resetCcoOwnerLeadAlertDedup,
} from "../cco-owner-lead-alert";
import type { CcoPublicIntakeDatabase } from "../cco-public-intake";
import {
  CCO_OWNER_ALERT_PHONE_E164,
  describeCcoOwnerSmsTransport,
  isCcoOwnerAlertPhone,
  sendCcoOwnerSms,
} from "../cco-owner-sms";

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
      const row = { id: `${this.table}-${rows.length + 1}`, ...(this.payload || {}) };
      if (row.id && rows.some((existing) => existing.id === row.id)) {
        return { data: null, error: { message: "notification_log_duplicate" } };
      }
      rows.push(row);
      return { data: row, error: null };
    }
    const matched = rows.filter((row) => this.filters.every((filter) => row[filter.column] === filter.value));
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

class FakeDatabase implements CcoPublicIntakeDatabase {
  readonly tables = new Map<string, Row[]>();

  from(table: string) {
    return new FakeQuery(this, table);
  }

  rows(table: string) {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table)!;
  }
}

const lead = {
  leadId: "contact-lead-1",
  name: "Avery Brooks",
  company: "Example Industrial",
  projectSummary: "Launch proof film",
  budget: "$10,000-$20,000",
  timeline: "2-4 weeks",
  sourceHost: "contentco-op.com",
  leadEmail: "avery@example.com",
  leadPhone: "+15015551234",
};

afterEach(() => {
  resetCcoOwnerLeadAlertDedup();
  vi.unstubAllGlobals();
});

function transports() {
  const emails: Array<Record<string, unknown>> = [];
  const texts: Array<Record<string, unknown>> = [];
  return {
    emails,
    texts,
    sendEmail: vi.fn(async (message: { to: string; subject: string; text: string; html: string }) => {
      emails.push(message);
      return { ok: true, id: `email-${emails.length}` };
    }),
    sendSms: vi.fn(async (message: { to?: string; body: string }) => {
      texts.push(message);
      return { ok: true, id: `sms-${texts.length}` };
    }),
  };
}

describe("CCO owner lead alert content", () => {
  test("includes name, company, summary, budget, timeline, and the CCO OS link", () => {
    const notice = buildCcoOwnerLeadAlert(lead);
    expect(notice.subject).toBe("New Content Co-op lead");
    expect(notice.text).toContain("Name: Avery Brooks");
    expect(notice.text).toContain("Company: Example Industrial");
    expect(notice.text).toContain("Project: Launch proof film");
    expect(notice.text).toContain("Budget: $10,000-$20,000");
    expect(notice.text).toContain("Timeline: 2-4 weeks");
    expect(notice.text).toContain("https://admin.contentco-op.com/os/contacts/contact-lead-1");
    expect(notice.sms).toContain("Avery Brooks");
    expect(notice.text).not.toContain(lead.leadEmail);
    expect(notice.text).not.toContain(lead.leadPhone);
    expect(notice.sms).not.toContain(lead.leadEmail);
    expect(notice.sms).not.toContain(lead.leadPhone);
  });

  test("catch-up lists stored leads for Bailey and does not copy lead phones or emails", () => {
    const notice = buildCcoOwnerCatchUpAlert([
      { leadId: "lead-viewz", name: "Viewz lead", company: "viewz.be", daysWaiting: 13 },
      { leadId: "lead-jlb", name: "JLB lead", company: "jlbmedia.com", daysWaiting: 6 },
    ]);
    expect(notice.leadId).toBe(CCO_OWNER_CATCHUP_ID);
    expect(notice.text).toContain("viewz.be");
    expect(notice.text).toContain("jlbmedia.com");
    expect(notice.text).toMatch(/Bailey only/i);
    expect(notice.text.toLowerCase()).not.toContain("@viewz");
    expect(notice.text).not.toMatch(/\+1\d{10}/);
  });
});

describe("owner-only recipients", () => {
  test("pins Bailey email and phone and rejects a lead address swap", () => {
    expect(isCcoOwnerAlertPhone(CCO_OWNER_ALERT_PHONE_E164)).toBe(true);
    expect(() => assertOwnerOnlyRecipients({
      emailTo: CCO_OWNER_ALERT_EMAIL,
      smsTo: CCO_OWNER_ALERT_PHONE_E164,
      leadEmail: lead.leadEmail,
      leadPhone: lead.leadPhone,
    })).not.toThrow();
    expect(() => assertOwnerOnlyRecipients({
      emailTo: lead.leadEmail!,
      smsTo: CCO_OWNER_ALERT_PHONE_E164,
      leadEmail: lead.leadEmail,
    })).toThrow(/recipient_not_owner|lead_must_not_receive_alert/);
  });

  test("SMS config reports the exact missing Twilio keys and never uses a lead number", () => {
    const described = describeCcoOwnerSmsTransport({});
    expect(described.configured).toBe(false);
    expect(described.to).toBe(CCO_OWNER_ALERT_PHONE_E164);
    expect(described.missing).toEqual([
      "TWILIO_ACCOUNT_SID",
      "TWILIO_AUTH_TOKEN",
      "TWILIO_FROM_NUMBER|CCO_TWILIO_FROM_NUMBER|TWILIO_PHONE_NUMBER",
    ]);
  });

  test("Twilio send refuses a non-owner To even when credentials exist", async () => {
    const fetchImpl = vi.fn();
    const result = await sendCcoOwnerSms({
      body: "test",
      to: lead.leadPhone,
      env: {
        TWILIO_ACCOUNT_SID: "ACtest",
        TWILIO_AUTH_TOKEN: "token",
        TWILIO_FROM_NUMBER: "+15015550000",
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: false, error: "recipient_not_owner" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("notifyCcoOwnerOfStoredLead", () => {
  test("fires email and SMS once per new lead and writes owner receipts health can count", async () => {
    const db = new FakeDatabase();
    const { emails, texts, sendEmail, sendSms } = transports();
    const first = await notifyCcoOwnerOfStoredLead(lead, { db: db as unknown as CcoPublicIntakeDatabase, sendEmail, sendSms });
    expect(first.email.delivered).toBe(true);
    expect(first.sms.delivered).toBe(true);
    expect(emails).toHaveLength(1);
    expect(texts).toHaveLength(1);
    expect(emails[0]?.to).toBe(CCO_OWNER_ALERT_EMAIL);
    expect(texts[0]?.to).toBe(CCO_OWNER_ALERT_PHONE_E164);

    const second = await notifyCcoOwnerOfStoredLead(lead, { db: db as unknown as CcoPublicIntakeDatabase, sendEmail, sendSms });
    expect(second.email.status).toBe("already_delivered");
    expect(second.sms.status).toBe("already_delivered");
    expect(emails).toHaveLength(1);
    expect(texts).toHaveLength(1);

    const rows = db.rows("notification_log");
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.channel === "email")?.id).toBe(
      ownerAlertClaimId(CCO_OWNER_LEAD_ALERT_TEMPLATE, lead.leadId, "email"),
    );
    expect(rows.find((row) => row.channel === "sms")?.id).toBe(
      ownerAlertClaimId(CCO_OWNER_LEAD_ALERT_TEMPLATE, lead.leadId, "sms"),
    );
    expect(rows.every((row) => row.recipient === CCO_OWNER_ALERT_EMAIL || row.recipient === CCO_OWNER_ALERT_PHONE_E164)).toBe(true);
    expect(rows.every((row) => row.audience === "internal")).toBe(true);
    expect(rows.every((row) => row.template_key === CCO_OWNER_LEAD_ALERT_TEMPLATE)).toBe(true);
    expect(rows.filter((row) => countsAsIntakeOwnerDelivery(row))).toHaveLength(2);
    expect(JSON.stringify(rows)).not.toContain(lead.leadEmail);
    expect(JSON.stringify(rows).includes(lead.leadPhone!)).toBe(false);
  });

  test("retries a failed SMS without sending a second email", async () => {
    const db = new FakeDatabase();
    const { emails, texts, sendEmail } = transports();
    const sendSms = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: "twilio_down" })
      .mockResolvedValueOnce({ ok: true, id: "sms-retry" });

    const first = await notifyCcoOwnerOfStoredLead(lead, { db: db as unknown as CcoPublicIntakeDatabase, sendEmail, sendSms });
    expect(first.email.delivered).toBe(true);
    expect(first.sms.delivered).toBe(false);
    resetCcoOwnerLeadAlertDedup();
    // Durable email row stays sent; in-process reset must not resend email.
    db.rows("notification_log").find((row) => row.channel === "email")!.status = "sent";

    const second = await notifyCcoOwnerOfStoredLead(lead, { db: db as unknown as CcoPublicIntakeDatabase, sendEmail, sendSms });
    expect(second.email.status).toBe("already_delivered");
    expect(second.sms.delivered).toBe(true);
    expect(emails).toHaveLength(1);
    expect(sendSms).toHaveBeenCalledTimes(2);
    expect(texts.length + (second.sms.delivered ? 0 : 0)).toBe(0);
  });

  test("submission helper never throws when both transports fail", async () => {
    const db = new FakeDatabase();
    const result = await notifyCcoOwnerOfStoredLeadSafely(lead, {
      db: db as unknown as CcoPublicIntakeDatabase,
      sendEmail: async () => ({ ok: false, error: "resend_down" }),
      sendSms: async () => ({ ok: false, error: "twilio_down" }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.blockedSubmission).toBe(false);
      expect(result.email.delivered).toBe(false);
      expect(result.sms.delivered).toBe(false);
    }
    expect(db.rows("notification_log").every((row) => row.status === "failed")).toBe(true);
  });

  test("default SMS path reports the missing Twilio keys and does not call a network send", async () => {
    const db = new FakeDatabase();
    const network = vi.fn(() => { throw new Error("network_forbidden"); });
    vi.stubGlobal("fetch", network);
    const { sendEmail } = transports();
    const result = await notifyCcoOwnerOfStoredLeadSafely(lead, {
      db: db as unknown as CcoPublicIntakeDatabase,
      sendEmail,
      env: {},
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.blockedSubmission).toBe(false);
      expect(result.sms.delivered).toBe(false);
      expect(result.sms.missing).toEqual([
        "TWILIO_ACCOUNT_SID",
        "TWILIO_AUTH_TOKEN",
        "TWILIO_FROM_NUMBER|CCO_TWILIO_FROM_NUMBER|TWILIO_PHONE_NUMBER",
      ]);
    }
    expect(network).not.toHaveBeenCalled();
  });

  test("a thrown notifier is absorbed by the safe wrapper", async () => {
    const result = await notifyCcoOwnerOfStoredLeadSafely({ ...lead, leadId: " " });
    expect(result).toEqual({ ok: false, blockedSubmission: false, error: "lead_id_required" });
  });

  test("concurrent retries share one send per channel", async () => {
    const db = new FakeDatabase();
    const { emails, texts, sendEmail, sendSms } = transports();
    const [a, b] = await Promise.all([
      notifyCcoOwnerOfStoredLead(lead, { db: db as unknown as CcoPublicIntakeDatabase, sendEmail, sendSms }),
      notifyCcoOwnerOfStoredLead(lead, { db: db as unknown as CcoPublicIntakeDatabase, sendEmail, sendSms }),
    ]);
    expect(a.leadId).toBe(b.leadId);
    expect(emails).toHaveLength(1);
    expect(texts).toHaveLength(1);
  });

  test("a later brief for the same contact still sends the project details", async () => {
    const db = new FakeDatabase();
    const { emails, texts, sendEmail, sendSms } = transports();
    await notifyCcoOwnerOfStoredLead(lead, { db: db as unknown as CcoPublicIntakeDatabase, sendEmail, sendSms });
    const brief = await notifyCcoOwnerOfStoredLead({
      ...lead,
      briefId: "brief-1",
      projectSummary: "Launch proof film with sales cutdowns",
      budget: "$18,000",
      timeline: "3 weeks",
    }, { db: db as unknown as CcoPublicIntakeDatabase, sendEmail, sendSms });
    expect(brief.email.delivered).toBe(true);
    expect(emails).toHaveLength(2);
    expect(texts).toHaveLength(2);
    expect(String(emails[1]?.text)).toContain("Launch proof film with sales cutdowns");
    expect(String(emails[1]?.text)).toContain("$18,000");
    expect(db.rows("notification_log").map((row) => row.related_entity_id).sort()).toEqual([
      "brief-1", "brief-1", "contact-lead-1", "contact-lead-1",
    ]);
  });

  test("catch-up is one Bailey-only bundle keyed separately from a live lead", async () => {
    const db = new FakeDatabase();
    const { emails, texts, sendEmail, sendSms } = transports();
    const result = await notifyCcoOwnerCatchUp([
      { leadId: "lead-viewz", name: "Viewz lead", company: "viewz.be", daysWaiting: 13 },
      { leadId: "lead-jlb", name: "JLB lead", company: "jlbmedia.com", daysWaiting: 6 },
    ], { db: db as unknown as CcoPublicIntakeDatabase, sendEmail, sendSms });
    expect(result.ok).toBe(true);
    expect(emails[0]?.to).toBe(CCO_OWNER_ALERT_EMAIL);
    expect(texts[0]?.to).toBe(CCO_OWNER_ALERT_PHONE_E164);
    expect(JSON.stringify(emails)).not.toContain("avery@example.com");
  });
});

type ScriptedCall = {
  operation: "select" | "insert" | "update";
  filters: Array<{ column: string; value: unknown }>;
  payload: Row | null;
};

function scriptedLog(
  handle: (call: ScriptedCall) => { data: Row | null; error: { message: string } | null },
): CcoPublicIntakeDatabase {
  return {
    from(table: string) {
      const call: ScriptedCall = { operation: "select", filters: [], payload: null };
      const api = {
        select() {
          return api;
        },
        eq(column: string, value: unknown) {
          call.filters.push({ column, value });
          return api;
        },
        contains() {
          return api;
        },
        insert(payload: Row) {
          call.operation = "insert";
          call.payload = payload;
          return api;
        },
        update(payload: Row) {
          call.operation = "update";
          call.payload = payload;
          return api;
        },
        async maybeSingle() {
          if (table !== "notification_log") return { data: null, error: { message: "unexpected_table" } };
          return handle({ operation: call.operation, filters: [...call.filters], payload: call.payload });
        },
        async single() {
          if (table !== "notification_log") return { data: null, error: { message: "unexpected_table" } };
          return handle({ operation: call.operation, filters: [...call.filters], payload: call.payload });
        },
      };
      return api;
    },
  };
}

function copyLogRow(row: Row): Row {
  const metadata = row.metadata;
  return {
    ...row,
    metadata: metadata && typeof metadata === "object" ? { ...(metadata as Row) } : metadata,
  };
}

describe("durable claim before provider send", () => {
  test("does not send when another worker records sent after this worker saw failed", async () => {
    const rows: Row[] = [
      {
        id: "log-email-1",
        template_key: CCO_OWNER_LEAD_ALERT_TEMPLATE,
        related_entity_id: lead.leadId,
        channel: "email",
        audience: "internal",
        status: "failed",
        recipient: CCO_OWNER_ALERT_EMAIL,
        metadata: {},
      },
      {
        id: "log-sms-1",
        template_key: CCO_OWNER_LEAD_ALERT_TEMPLATE,
        related_entity_id: lead.leadId,
        channel: "sms",
        audience: "internal",
        status: "sent",
        sent_at: "2026-10-09T04:00:00.000Z",
        recipient: CCO_OWNER_ALERT_PHONE_E164,
        metadata: { provider_message_id: "sms-winner" },
      },
    ];
    let emailSelects = 0;
    const db = scriptedLog((call) => {
      const channel = call.filters.find((filter) => filter.column === "channel")?.value;
      const matched = rows.filter((row) => call.filters.every((filter) => row[filter.column] === filter.value));
      if (call.operation === "select") {
        const row = matched[0];
        if (channel === "email") {
          emailSelects += 1;
          if (row && emailSelects === 1 && row.status === "failed") {
            const snapshot = copyLogRow(row);
            row.status = "sent";
            row.sent_at = "2026-10-09T05:00:00.000Z";
            row.metadata = { provider_message_id: "email-winner" };
            return { data: snapshot, error: null };
          }
        }
        return { data: row ? copyLogRow(row) : null, error: null };
      }
      if (call.operation === "update" || call.operation === "insert") {
        const row = matched[0];
        if (!row) return { data: null, error: { message: "notification_log_claim_miss" } };
        Object.assign(row, call.payload || {});
        return { data: copyLogRow(row), error: null };
      }
      return { data: null, error: { message: "notification_log_unavailable" } };
    });
    const { sendEmail, sendSms } = transports();
    const result = await notifyCcoOwnerOfStoredLead(lead, {
      db: db as unknown as CcoPublicIntakeDatabase,
      sendEmail,
      sendSms,
    });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendSms).not.toHaveBeenCalled();
    expect(result.email).toMatchObject({
      delivered: true,
      status: "already_delivered",
      logId: "log-email-1",
    });
    expect(result.sms.status).toBe("already_delivered");
    expect(rows.find((row) => row.channel === "email")).toMatchObject({
      status: "sent",
      metadata: { provider_message_id: "email-winner" },
    });
  });

  test("does not send when the failed-row claim no longer matches", async () => {
    const rows: Row[] = [
      {
        id: "log-email-1",
        template_key: CCO_OWNER_LEAD_ALERT_TEMPLATE,
        related_entity_id: lead.leadId,
        channel: "email",
        audience: "internal",
        status: "failed",
        recipient: CCO_OWNER_ALERT_EMAIL,
        metadata: {},
      },
      {
        id: "log-sms-1",
        template_key: CCO_OWNER_LEAD_ALERT_TEMPLATE,
        related_entity_id: lead.leadId,
        channel: "sms",
        audience: "internal",
        status: "sent",
        sent_at: "2026-10-09T04:00:00.000Z",
        recipient: CCO_OWNER_ALERT_PHONE_E164,
        metadata: { provider_message_id: "sms-winner" },
      },
    ];
    let emailSelects = 0;
    const db = scriptedLog((call) => {
      const channel = call.filters.find((filter) => filter.column === "channel")?.value;
      const matched = rows.filter((row) => call.filters.every((filter) => row[filter.column] === filter.value));
      if (call.operation === "select") {
        const row = matched[0];
        if (channel === "email" && row?.status === "failed") {
          emailSelects += 1;
          const snapshot = copyLogRow(row);
          if (emailSelects >= 2) {
            row.status = "sent";
            row.sent_at = "2026-10-09T05:00:00.000Z";
            row.metadata = { provider_message_id: "email-winner" };
          }
          return { data: snapshot, error: null };
        }
        return { data: row ? copyLogRow(row) : null, error: null };
      }
      if (!matched[0]) return { data: null, error: { message: "notification_log_claim_miss" } };
      Object.assign(matched[0], call.payload || {});
      return { data: copyLogRow(matched[0]), error: null };
    });
    const { sendEmail, sendSms } = transports();
    const result = await notifyCcoOwnerOfStoredLead(lead, {
      db: db as unknown as CcoPublicIntakeDatabase,
      sendEmail,
      sendSms,
    });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendSms).not.toHaveBeenCalled();
    expect(result.email).toMatchObject({ delivered: false, status: "failed", reason: "notification_claim_failed" });
    expect(result.sms.status).toBe("already_delivered");
    expect(rows.find((row) => row.channel === "email")?.status).toBe("sent");
  });

  test("does not send when notification log reads and writes fail, then still does not send on retry", async () => {
    const db = scriptedLog(() => ({ data: null, error: { message: "notification_log_unavailable" } }));
    const { sendEmail, sendSms } = transports();
    const deps = { db: db as unknown as CcoPublicIntakeDatabase, sendEmail, sendSms };
    const first = await notifyCcoOwnerOfStoredLead(lead, deps);
    expect(first.blockedSubmission).toBe(false);
    expect(first.email).toMatchObject({ delivered: false, status: "failed", reason: "notification_log_unavailable" });
    expect(first.sms).toMatchObject({ delivered: false, status: "failed", reason: "notification_log_unavailable" });
    expect(first.email.logId).toBeUndefined();
    expect(first.sms.logId).toBeUndefined();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendSms).not.toHaveBeenCalled();

    resetCcoOwnerLeadAlertDedup();
    const second = await notifyCcoOwnerOfStoredLead(lead, deps);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendSms).not.toHaveBeenCalled();
    expect(second.email.logId).toBeUndefined();
    expect(second.sms.delivered).toBe(false);
    expect(second.blockedSubmission).toBe(false);
  });

  test("does not send when the insert claim is rejected", async () => {
    const db = scriptedLog((call) => {
      if (call.operation === "select") return { data: null, error: null };
      return { data: null, error: { message: "notification_log_duplicate" } };
    });
    const { sendEmail, sendSms } = transports();
    const result = await notifyCcoOwnerOfStoredLead(lead, {
      db: db as unknown as CcoPublicIntakeDatabase,
      sendEmail,
      sendSms,
    });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendSms).not.toHaveBeenCalled();
    expect(result.email).toMatchObject({ delivered: false, status: "failed", reason: "notification_claim_failed" });
    expect(result.sms).toMatchObject({ delivered: false, status: "failed", reason: "notification_claim_failed" });
    expect(result.email.logId).toBeUndefined();
    expect(result.blockedSubmission).toBe(false);
  });

  test("a rejected first insert that later sees sent stays undelivered and does not send", async () => {
    const selects = { email: 0, sms: 0 };
    const db = scriptedLog((call) => {
      const channel = (call.filters.find((filter) => filter.column === "channel")?.value
        || call.payload?.channel) === "sms"
        ? "sms"
        : "email";
      if (call.operation === "select") {
        selects[channel] += 1;
        if (selects[channel] >= 3) {
          return {
            data: {
              id: ownerAlertClaimId(CCO_OWNER_LEAD_ALERT_TEMPLATE, lead.leadId, channel),
              status: "sent",
              sent_at: "2026-10-09T06:00:00.000Z",
              metadata: { provider_message_id: `${channel}-winner` },
            },
            error: null,
          };
        }
        return { data: null, error: null };
      }
      return { data: null, error: { message: "notification_log_duplicate" } };
    });
    const { sendEmail, sendSms } = transports();
    const result = await notifyCcoOwnerOfStoredLead(lead, {
      db: db as unknown as CcoPublicIntakeDatabase,
      sendEmail,
      sendSms,
    });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendSms).not.toHaveBeenCalled();
    expect(result.email).toMatchObject({ delivered: false, status: "failed", reason: "notification_claim_failed" });
    expect(result.sms).toMatchObject({ delivered: false, status: "failed", reason: "notification_claim_failed" });
    expect(result.blockedSubmission).toBe(false);
  });

  test("a lost failed-row update that later sees sent stays undelivered and does not send", async () => {
    const rows: Row[] = [
      {
        id: "log-email-failed",
        template_key: CCO_OWNER_LEAD_ALERT_TEMPLATE,
        related_entity_id: lead.leadId,
        channel: "email",
        audience: "internal",
        status: "failed",
        recipient: CCO_OWNER_ALERT_EMAIL,
        metadata: {},
      },
      {
        id: "log-sms-failed",
        template_key: CCO_OWNER_LEAD_ALERT_TEMPLATE,
        related_entity_id: lead.leadId,
        channel: "sms",
        audience: "internal",
        status: "failed",
        recipient: CCO_OWNER_ALERT_PHONE_E164,
        metadata: {},
      },
    ];
    const selects = { email: 0, sms: 0 };
    const db = scriptedLog((call) => {
      const channel = call.filters.find((filter) => filter.column === "channel")?.value === "sms" ? "sms" : "email";
      const matched = rows.filter((row) => call.filters.every((filter) => row[filter.column] === filter.value));
      if (call.operation === "select") {
        selects[channel] += 1;
        const row = matched[0];
        if (selects[channel] >= 3 && row) {
          return {
            data: copyLogRow({
              ...row,
              status: "sent",
              sent_at: "2026-10-09T06:01:00.000Z",
              metadata: { provider_message_id: `${channel}-winner` },
            }),
            error: null,
          };
        }
        return { data: row ? copyLogRow(row) : null, error: null };
      }
      return { data: null, error: { message: "notification_log_claim_miss" } };
    });
    const { sendEmail, sendSms } = transports();
    const result = await notifyCcoOwnerOfStoredLead(lead, {
      db: db as unknown as CcoPublicIntakeDatabase,
      sendEmail,
      sendSms,
    });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendSms).not.toHaveBeenCalled();
    expect(result.email).toMatchObject({ delivered: false, status: "failed", reason: "notification_claim_failed" });
    expect(result.sms.reason).toBe("notification_claim_failed");
    expect(result.blockedSubmission).toBe(false);
  });

  test("does not report sent when the outcome receipt write fails, and a retry does not send again", async () => {
    const rows: Row[] = [];
    const db = scriptedLog((call) => {
      const matched = rows.filter((row) => call.filters.every((filter) => row[filter.column] === filter.value));
      if (call.operation === "select") {
        return { data: matched[0] ? copyLogRow(matched[0]) : null, error: null };
      }
      if (call.operation === "insert") {
        const row = { id: `log-${call.payload?.channel || rows.length + 1}`, ...(call.payload || {}) };
        rows.push(row);
        return { data: copyLogRow(row), error: null };
      }
      const claimingFailed = call.filters.some((filter) => filter.column === "status" && filter.value === "failed");
      if (claimingFailed && matched[0]) {
        Object.assign(matched[0], call.payload || {});
        return { data: copyLogRow(matched[0]), error: null };
      }
      return { data: null, error: { message: "notification_log_update_failed" } };
    });
    const now = new Date("2026-10-09T05:10:00.000Z");
    const { sendEmail, sendSms } = transports();
    const deps = {
      db: db as unknown as CcoPublicIntakeDatabase,
      sendEmail,
      sendSms,
      now,
    };
    const first = await notifyCcoOwnerOfStoredLead(lead, deps);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendSms).toHaveBeenCalledTimes(1);
    expect(first.email).toMatchObject({ delivered: false, status: "unknown", reason: "delivery_outcome_unknown" });
    expect(first.sms.status).toBe("unknown");
    expect(rows.every((row) => row.status === "sending")).toBe(true);

    resetCcoOwnerLeadAlertDedup();
    const second = await notifyCcoOwnerOfStoredLead(lead, deps);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendSms).toHaveBeenCalledTimes(1);
    expect(second.email.status).toBe("skipped");
    expect(second.sms.reason).toBe("notification_delivery_in_progress");
    expect(second.blockedSubmission).toBe(false);
  });

  test("first-insert claim ids are deterministic per template, lead, and channel", () => {
    const emailId = ownerAlertClaimId(CCO_OWNER_LEAD_ALERT_TEMPLATE, ownerAlertDedupeId(lead), "email");
    const smsId = ownerAlertClaimId(CCO_OWNER_LEAD_ALERT_TEMPLATE, ownerAlertDedupeId(lead), "sms");
    expect(emailId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(smsId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(emailId).not.toBe(smsId);
    expect(emailId).toBe(ownerAlertClaimId(CCO_OWNER_LEAD_ALERT_TEMPLATE, lead.leadId, "email"));
  });

  test("does not send when a second worker inserts the same first-claim id", async () => {
    const claimed = {
      email: ownerAlertClaimId(CCO_OWNER_LEAD_ALERT_TEMPLATE, lead.leadId, "email"),
      sms: ownerAlertClaimId(CCO_OWNER_LEAD_ALERT_TEMPLATE, lead.leadId, "sms"),
    };
    const inserts: Array<{ channel: unknown; id: unknown }> = [];
    const db = scriptedLog((call) => {
      const channel = call.filters.find((filter) => filter.column === "channel")?.value
        || call.payload?.channel;
      if (call.operation === "select") return { data: null, error: null };
      if (call.operation === "insert") {
        inserts.push({ channel, id: call.payload?.id });
        const already = inserts.filter((row) => row.channel === channel).length > 1;
        if (already) return { data: null, error: { message: "notification_log_duplicate" } };
        return { data: { id: call.payload?.id || claimed.email }, error: null };
      }
      if (call.operation === "update") {
        const id = call.filters.find((filter) => filter.column === "id")?.value;
        return { data: { id }, error: null };
      }
      return { data: null, error: { message: "notification_log_unavailable" } };
    });
    const { sendEmail, sendSms } = transports();
    const deps = { db: db as unknown as CcoPublicIntakeDatabase, sendEmail, sendSms };
    const first = await notifyCcoOwnerOfStoredLead(lead, deps);
    resetCcoOwnerLeadAlertDedup();
    const second = await notifyCcoOwnerOfStoredLead(lead, deps);
    expect(inserts.map((row) => row.id).sort()).toEqual(
      [claimed.email, claimed.email, claimed.sms, claimed.sms].sort(),
    );
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendSms).toHaveBeenCalledTimes(1);
    expect(first.email.delivered).toBe(true);
    expect(first.sms.delivered).toBe(true);
    expect(second.email).toMatchObject({ delivered: false, status: "failed", reason: "notification_claim_failed" });
    expect(second.sms.reason).toBe("notification_claim_failed");
    expect(second.blockedSubmission).toBe(false);
  });
});
