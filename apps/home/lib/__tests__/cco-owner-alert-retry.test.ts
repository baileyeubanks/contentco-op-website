import { afterEach, expect, test, vi } from "vitest";
import { retryCcoOwnerLeadAlerts } from "../cco-owner-alert-retry";
import * as alerts from "../cco-owner-lead-alert";
import type { CcoPublicIntakeDatabase } from "../cco-public-intake";

type Row = Record<string, any>;
const leadId = "22222222-2222-4222-8222-222222222222";
const now = new Date("2026-10-23T12:00:00Z");
const lead = { leadId, name: "Private name", projectSummary: "Private brief" };
const attemptTemplate = "cco_owner_lead_alert_attempt";
class Database {
  rows: Row[] = [];
  from(table: string) { expect(table).toBe("notification_log"); return new Query(this); }
}
class Query {
  filters: Array<(row: Row) => boolean> = [];
  op = "select";
  payload: Row = {};
  cap = Infinity;
  constructor(public db: Database) {}
  select() { return this; }
  eq(key: string, value: unknown) { this.filters.push(r => r[key] === value); return this; }
  contains(key: string, value: Row) { this.filters.push(r => Object.entries(value).every(([k,v]) => r[key]?.[k] === v)); return this; }
  in(key: string, values: unknown[]) { this.filters.push(r => values.includes(r[key])); return this; }
  order() {
    this.db.rows.sort((a,b) => String(a.metadata?.next_retry_at || "").localeCompare(String(b.metadata?.next_retry_at || "")));
    return this;
  }
  or(expression: string) {
    if (expression === "metadata->>retry_exhausted.is.null,metadata->>retry_exhausted.neq.true") {
      this.filters.push(r => r.metadata?.retry_exhausted !== true);
    } else if (expression.startsWith("status.eq.failed,")) {
      this.filters.push(r => r.status === "failed" || (r.metadata?.transport === "cco_text_outbox" && ["queued","sending","unknown"].includes(r.status)));
    } else {
      const due = expression.split(".lte.")[1];
      expect(due).toBeTruthy();
      this.filters.push(r => !r.metadata?.next_retry_at || r.metadata.next_retry_at <= due);
    }
    return this;
  }
  limit(cap: number) { this.cap = cap; return this; }
  insert(payload: Row) { this.op = "insert"; this.payload = payload; return this; }
  update(payload: Row) { this.op = "update"; this.payload = payload; return this; }
  execute(single = false): { data: any; error: any } {
    if (this.op === "insert") {
      if (this.db.rows.some(r => r.id === this.payload.id)) return { data: null, error: { code: "23505" } };
      if (!["email", "imessage"].includes(this.payload.channel)) return { data: null, error: { code: "23514" } };
      if (this.payload.related_entity_id === leadId) return { data: null, error: { code: "23503" } };
      this.db.rows.push({ ...structuredClone(this.payload), created_at: now.toISOString() });
      return { data: structuredClone(this.payload), error: null };
    }
    const rows = this.db.rows.filter(r => this.filters.every(f => f(r))).slice(0, this.cap);
    if (this.op === "update") rows.forEach(r => Object.assign(r, structuredClone(this.payload)));
    return { data: structuredClone(single ? rows[0] ?? null : rows), error: null };
  }
  async single() { return this.execute(true); }
  async maybeSingle() { return this.execute(true); }
  then(resolve: (value: any) => unknown, reject?: (error: unknown) => unknown) { return Promise.resolve(this.execute()).then(resolve, reject); }
}
function deps(db: Database) { return { db: db as unknown as CcoPublicIntakeDatabase, now, env: {} }; }
afterEach(() => { alerts.resetCcoOwnerLeadAlertDedup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

test("lead-only alerts fit CCO-DB channel and brief-FK contracts and log each attempt without extra PII", async () => {
  const db = new Database();
  const result = await alerts.notifyCcoOwnerOfStoredLead(lead, { ...deps(db),
    sendEmail: async () => ({ ok: true, id: "email-receipt" }),
    sendSms: async () => ({ ok: true, id: "text-receipt" }),
  });
  expect(result.email.delivered).toBe(true);
  expect(result.sms.delivered).toBe(true);
  const attempts = db.rows.filter(r => r.template_key === attemptTemplate);
  expect(attempts).toHaveLength(2);
  expect(attempts.every(r => r.status === "sent" && r.related_entity_id === null)).toBe(true);
  expect(JSON.stringify(attempts)).not.toContain("Private");
});

test("a failed alert retains its attempt and retries after backoff without replaying delivered channels", async () => {
  const db = new Database();
  const sendEmail = vi.fn().mockResolvedValueOnce({ ok: false, error: "private@example.test secret-token" }).mockResolvedValue({ ok: true, id: "email-receipt" });
  const sendSms = vi.fn(async () => ({ ok: true, id: "text-receipt" }));
  const options = { ...deps(db), sendEmail, sendSms };
  await alerts.notifyCcoOwnerOfStoredLead(lead, options);
  alerts.resetCcoOwnerLeadAlertDedup();
  await retryCcoOwnerLeadAlerts({ ...options, now: new Date(now.getTime() + 60_000) });
  expect(sendEmail).toHaveBeenCalledTimes(1);
  await retryCcoOwnerLeadAlerts({ ...options, now: new Date(now.getTime() + 300_000) });
  expect(sendEmail).toHaveBeenCalledTimes(2);
  expect(sendSms).toHaveBeenCalledTimes(1);
  expect(db.rows.filter(r => r.template_key === attemptTemplate).map(r => r.status).sort()).toEqual(["failed", "sent", "sent"]);
  expect(JSON.stringify(db.rows)).not.toContain("secret-token");
});

test("no configured channel is durably undeliverable, never sent or a public submission failure", async () => {
  const db = new Database();
  const network = vi.fn(); vi.stubGlobal("fetch", network);
  const result = await alerts.notifyCcoOwnerOfStoredLead(lead, deps(db));
  expect(result.email.reason).toBe("undeliverable: no channel");
  expect(result.sms.reason).toBe("undeliverable: no channel");
  expect(db.rows.filter(r => r.template_key === attemptTemplate)).toHaveLength(2);
  expect(db.rows.every(r => r.status === "failed" && !r.sent_at)).toBe(true);
  expect(network).not.toHaveBeenCalled();
});

const textEnv = { CCO_OWNER_TEXT_ENABLED: "true", CCO_OWNER_TEXT_USER_ID: "11111111-1111-4111-8111-111111111111" };
function outboxDatabase() {
  const db = new Database();
  let row: Row | null = null;
  let throwAfterEnqueue = false;
  const rpc = vi.fn(async (_name: string, args: Row) => {
    expect(_name).toBe("enqueue_text_v1");
    expect(db.rows.some(r => r.template_key === attemptTemplate && r.status === "sending")).toBe(true);
    row ||= { id: "44444444-4444-4444-8444-444444444444", status: "queued", sent_at: null, ...args };
    if (throwAfterEnqueue) throw new Error("transport response lost after commit");
    return { data: row, error: null };
  });
  const extended = Object.assign(db, { schema: (name: string) => {
    expect(name).toBe("co_production");
    return { rpc, from: () => ({ select: () => ({ eq: (_key: string, value: string) => ({
      maybeSingle: async () => ({ data: row?.p_idempotency_key === value ? row : null, error: null }),
    }) }) }) };
  } });
  return { db: extended, rpc, get row() { return row!; }, loseEnqueueResponse() { throwAfterEnqueue = true; } };
}

test("cron reconciles a timed-out enqueue with the same key: one governed message, queued is not sent", async () => {
  const fixture = outboxDatabase();
  fixture.loseEnqueueResponse();
  const options = { ...deps(fixture.db), env: textEnv };
  const first = await alerts.notifyCcoOwnerOfStoredLead(lead, options);
  expect(first.sms.status).toBe("unknown");
  alerts.resetCcoOwnerLeadAlertDedup();
  await retryCcoOwnerLeadAlerts({ ...options, now: new Date(now.getTime() + 300_000) });
  const primary = fixture.db.rows.find(r => r.channel === "imessage" && r.template_key === alerts.CCO_OWNER_LEAD_ALERT_TEMPLATE)!;
  expect(primary.status).toBe("queued");
  expect(primary.sent_at).toBeNull();
  fixture.row.status = "sent";
  fixture.row.sent_at = "2026-10-23T12:06:00Z";
  await retryCcoOwnerLeadAlerts({ ...options, now: new Date(now.getTime() + 900_000) });
  expect(primary.status).toBe("sent");
  expect(primary.sent_at).toBe(fixture.row.sent_at);
  expect(fixture.rpc).toHaveBeenCalledTimes(1);
  expect(fixture.row.p_body).not.toContain("Private");
  expect(fixture.row.p_body).toContain(leadId);
  expect(fixture.row.p_idempotency_key).toBe(`cco-owner-lead:${alerts.ownerAlertClaimId(alerts.CCO_OWNER_LEAD_ALERT_TEMPLATE, leadId, "sms")}`);
  expect(fixture.db.rows.filter(r => r.template_key === attemptTemplate && r.channel === "imessage").map(r => r.status)).toEqual(["unknown", "queued", "sent"]);
});

test("confirmed outbox failure/suppression is honest and never bypasses the existing governor", async () => {
  for (const status of ["failed", "suppressed"]) {
    alerts.resetCcoOwnerLeadAlertDedup();
    const fixture = outboxDatabase();
    const options = { ...deps(fixture.db), env: textEnv };
    await alerts.notifyCcoOwnerOfStoredLead(lead, options);
    fixture.row.status = status;
    await retryCcoOwnerLeadAlerts({ ...options, now: new Date(now.getTime() + 300_000) });
    const primary = fixture.db.rows.find(r => r.channel === "imessage" && r.template_key === alerts.CCO_OWNER_LEAD_ALERT_TEMPLATE)!;
    expect(primary.status).toBe("failed");
    expect(primary.error_message).toBe(`outbox_${status}`);
    expect(primary.sent_at).toBeNull();
    expect(fixture.rpc).toHaveBeenCalledTimes(1);
  }
});

test("ambiguous direct email is held while governed text can continue; backoff is capped at one day", async () => {
  const db = new Database();
  const sendEmail = vi.fn(async () => ({ ok: false, deliveryUnknown: true, error: "provider secret" }));
  const options = { ...deps(db), sendEmail };
  await alerts.notifyCcoOwnerOfStoredLead(lead, options);
  alerts.resetCcoOwnerLeadAlertDedup();
  await retryCcoOwnerLeadAlerts({ ...options, now: new Date(now.getTime() + 300_000) });
  expect(sendEmail).toHaveBeenCalledTimes(1);
  expect(alerts.ownerAlertBackoffMs(1)).toBe(300_000);
  expect(alerts.ownerAlertBackoffMs(2)).toBe(600_000);
  expect(alerts.ownerAlertBackoffMs(1000)).toBe(86_400_000);
});

test("an audit insert failure prevents any provider call", async () => {
  const db = new Database();
  const from = db.from.bind(db);
  db.from = (table: string) => {
    const query = from(table);
    const original = query.execute.bind(query);
    query.execute = single => query.op === "insert" && query.payload.template_key === attemptTemplate
      ? { data: null, error: { code: "audit_unavailable" } } : original(single);
    return query;
  };
  const sendEmail = vi.fn(); const sendSms = vi.fn();
  await alerts.notifyCcoOwnerOfStoredLead(lead, { ...deps(db), sendEmail, sendSms });
  expect(sendEmail).not.toHaveBeenCalled(); expect(sendSms).not.toHaveBeenCalled();
  expect(db.rows.every(r => r.status === "failed")).toBe(true);
});

test("due work is bounded to 25 bundles, ordered by due time, without replaying an attempt row", async () => {
  const db = new Database();
  for (let n = 0; n < 30; n++) {
    db.rows.push({ id: `seed-${n}`, template_key: alerts.CCO_OWNER_LEAD_ALERT_TEMPLATE, audience: "internal", status: "failed", contact_id: `contact-${n}`, metadata: {} });
  }
  db.rows.push({ id: "audit-only", template_key: attemptTemplate, audience: "internal", status: "failed", contact_id: "audit-contact", metadata: {} });
  const sendEmail = vi.fn(async () => ({ ok: true, id: "email-receipt" }));
  const sendSms = vi.fn(async () => ({ ok: true, id: "sms-receipt" }));
  const result = await retryCcoOwnerLeadAlerts({ ...deps(db), sendEmail, sendSms });
  expect(result.evaluated).toBe(25);
  expect(sendEmail).toHaveBeenCalledTimes(25);
  expect(sendSms).toHaveBeenCalledTimes(25);
});

test("independent workers racing the same lead claim send each channel once", async () => {
  const db = new Database();
  let release!: () => void;
  let entered!: () => void;
  const called = new Promise<void>(resolve => { entered = resolve; });
  const sendSms = vi.fn(async () => { entered(); await new Promise<void>(resolve => { release = resolve; }); return { ok: true, id: "text-receipt" }; });
  const sendEmail = vi.fn(async () => ({ ok: true, id: "email-receipt" }));
  const options = { ...deps(db), sendSms, sendEmail };
  const first = alerts.notifyCcoOwnerOfStoredLead(lead, options);
  await called;
  alerts.resetCcoOwnerLeadAlertDedup(); // Another process has no memory of the first waiter.
  await alerts.notifyCcoOwnerOfStoredLead(lead, options);
  release(); await first;
  expect(sendSms).toHaveBeenCalledTimes(1);
  expect(sendEmail).toHaveBeenCalledTimes(1);
  expect(db.rows.filter(r => r.template_key === attemptTemplate)).toHaveLength(2);
});

test("the actual send deadline records unknown and the next cron reconciles instead of enqueueing twice", async () => {
  vi.useFakeTimers();
  const fixture = outboxDatabase();
  const original = fixture.rpc.getMockImplementation()!;
  fixture.rpc.mockImplementationOnce(async (...args) => {
    await original(...args);
    return new Promise(() => {});
  });
  const options = { ...deps(fixture.db), env: textEnv };
  const pending = alerts.notifyCcoOwnerOfStoredLead(lead, options);
  await vi.advanceTimersByTimeAsync(8_001);
  expect((await pending).sms.status).toBe("unknown");
  fixture.row.status = "sent"; fixture.row.sent_at = "2026-10-23T12:01:00Z";
  await retryCcoOwnerLeadAlerts({ ...options, now: new Date(now.getTime() + 300_000) });
  expect(fixture.rpc).toHaveBeenCalledTimes(1);
  expect(fixture.db.rows.find(r => r.channel === "imessage" && r.template_key === alerts.CCO_OWNER_LEAD_ALERT_TEMPLATE)?.status).toBe("sent");
});

test("permanent failure stops at five attempts across 120 daily runs and logs gave_up once per channel", async () => {
  const db = new Database();
  const sendEmail = vi.fn(async () => ({ ok: false, error: "undeliverable: no channel" }));
  const sendSms = vi.fn(async () => ({ ok: false, error: "outbox_failed" }));
  const options = { ...deps(db), sendEmail, sendSms };
  await alerts.notifyCcoOwnerOfStoredLead(lead, options);
  for (let day = 1; day <= 120; day++) {
    alerts.resetCcoOwnerLeadAlertDedup();
    await retryCcoOwnerLeadAlerts({ ...options, now: new Date(now.getTime() + day * 86_400_000) });
  }
  expect(sendEmail).toHaveBeenCalledTimes(5);
  expect(sendSms).toHaveBeenCalledTimes(5);
  const attempts = db.rows.filter(r => r.template_key === attemptTemplate);
  expect(attempts).toHaveLength(10);
  expect(attempts.filter(r => r.metadata.delivery_status === "gave_up")).toHaveLength(2);
  const primaries = db.rows.filter(r => r.template_key === alerts.CCO_OWNER_LEAD_ALERT_TEMPLATE);
  expect(primaries.every(r => r.status === "failed" && r.error_message === "gave_up" && r.metadata.retry_exhausted === true)).toBe(true);
  const last = await retryCcoOwnerLeadAlerts({ ...options, now: new Date(now.getTime() + 121 * 86_400_000) });
  expect(last.evaluated).toBe(0);
  const repeated = await alerts.notifyCcoOwnerOfStoredLead(lead, { ...options, now: new Date(now.getTime() + 122 * 86_400_000) });
  expect(repeated.email.status).toBe("gave_up");
  expect(db.rows).toHaveLength(12);
});

test("an already exhausted stored claim is terminalized without another transport attempt", async () => {
  const db = new Database();
  const sendEmail = vi.fn(async () => ({ ok: false, error: "undeliverable: no channel" }));
  const sendSms = vi.fn(async () => ({ ok: true, id: "sent-text" }));
  const options = { ...deps(db), sendEmail, sendSms };
  await alerts.notifyCcoOwnerOfStoredLead(lead, options);
  const primary = db.rows.find(r => r.channel === "email" && r.template_key === alerts.CCO_OWNER_LEAD_ALERT_TEMPLATE)!;
  primary.metadata.attempt_count = 121;
  await retryCcoOwnerLeadAlerts({ ...options, now: new Date(now.getTime() + 86_400_000) });
  expect(sendEmail).toHaveBeenCalledTimes(1);
  expect(primary.metadata.retry_exhausted).toBe(true);
  expect(primary.error_message).toBe("gave_up");
});
