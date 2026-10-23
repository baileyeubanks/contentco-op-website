import type { SupabaseClient } from "@supabase/supabase-js";
import type { CcoPublicIntakeDatabase } from "@/lib/cco-public-intake";
import { CCO_OWNER_ALERT_PHONE_E164 } from "@/lib/cco-owner-sms";

export type OwnerAlertDelivery = {
  ok: boolean;
  id?: string;
  error?: string;
  deliveryUnknown?: boolean;
  queued?: boolean;
  sentAt?: string;
  missing?: string[];
};

/** Enqueue/reconcile only. The existing Blaze sender owns delivery, consent and rate limits. */
export async function enqueueOwnerText(input: {
  db: CcoPublicIntakeDatabase;
  env: Record<string, string | undefined>;
  leadId: string;
  idempotencyKey: string;
  now: Date;
}): Promise<OwnerAlertDelivery> {
  const missing: string[] = [];
  if (input.env.CCO_OWNER_TEXT_ENABLED !== "true") missing.push("CCO_OWNER_TEXT_ENABLED");
  const recipient = input.env.CCO_OWNER_TEXT_USER_ID || "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recipient)) missing.push("CCO_OWNER_TEXT_USER_ID");
  if (missing.length) return { ok: false, error: "undeliverable: no channel", missing };
  try {
    const client = (input.db as unknown as SupabaseClient).schema("co_production");
    const read = () => client.from("notification_outbox_v1")
      .select("id,status,sent_at").eq("idempotency_key", input.idempotencyKey).maybeSingle();
    let row = await read();
    if (row.error) return { ok: false, error: "outbox_unavailable", deliveryUnknown: true };
    if (!row.data) {
      const enqueued = await client.rpc("enqueue_text_v1", {
        p_recipient_kind: "user", p_recipient_ref: recipient,
        p_channel: "imessage", p_destination: CCO_OWNER_ALERT_PHONE_E164,
        // Application-owned text only; never copy an untrusted brief into the sender queue.
        p_body: `Content Co-op: a new lead is ready. https://admin.contentco-op.com/os/contacts/${encodeURIComponent(input.leadId)}`,
        p_kind: "cco_owner_lead_alert", p_idempotency_key: input.idempotencyKey,
        p_project_id: null, p_send_after: input.now.toISOString(), p_expires_at: null,
        p_stop_token_hash: null,
      });
      if (enqueued.error) return { ok: false, error: "outbox_unavailable", deliveryUnknown: true };
      row = await read();
    }
    if (row.error || !row.data) return { ok: false, error: "outbox_unavailable", deliveryUnknown: true };
    const { id, status, sent_at: sentAt } = row.data;
    if (status === "sent" && typeof sentAt === "string" && Number.isFinite(Date.parse(sentAt))) {
      return { ok: true, id, sentAt };
    }
    if (status === "queued" || status === "sending") return { ok: false, id, queued: true, error: "outbox_pending" };
    if (status === "failed" || status === "suppressed") return { ok: false, error: `outbox_${status}` };
    return { ok: false, id, deliveryUnknown: true, error: "outbox_outcome_unknown" };
  } catch {
    // An enqueue timeout can have committed. Replay only the same idempotency key.
    return { ok: false, error: "outbox_unavailable", deliveryUnknown: true };
  }
}
