/**
 * CCO owner SMS for new-lead alerts. Bailey only.
 *
 * ACS texts go through Messages.app on the ACS host; that outbox is
 * cross-company and is not used here. Hermes currently exposes Telegram, not
 * SMS. This module uses the existing Twilio REST shape behind CCO env only.
 * It never creates credentials and never texts a lead.
 */

export const CCO_OWNER_ALERT_PHONE_E164 = "+15013515927";

const OWNER_PHONE_DIGITS = new Set(["15013515927", "5013515927"]);

export type CcoOwnerSmsConfig = {
  configured: boolean;
  to: string;
  from?: string;
  accountSid?: string;
  missing: string[];
  reason?: string;
};

export type CcoOwnerSmsSendResult =
  | { ok: true; id: string }
  | { ok: false; error: string; deliveryUnknown?: boolean; missing?: string[] };

export function normalizePhoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function isCcoOwnerAlertPhone(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return OWNER_PHONE_DIGITS.has(normalizePhoneDigits(value));
}

export function resolveCcoOwnerAlertPhone(
  env: Record<string, string | undefined> = process.env,
): { ok: true; phone: string } | { ok: false; reason: string; configured?: string } {
  const configured = String(env.CCO_OWNER_ALERT_PHONE || env.BAILEY_PHONE || CCO_OWNER_ALERT_PHONE_E164).trim();
  if (!isCcoOwnerAlertPhone(configured)) {
    return { ok: false, reason: "owner_phone_not_bailey", configured };
  }
  return { ok: true, phone: CCO_OWNER_ALERT_PHONE_E164 };
}

export function describeCcoOwnerSmsTransport(
  env: Record<string, string | undefined> = process.env,
): CcoOwnerSmsConfig {
  const owner = resolveCcoOwnerAlertPhone(env);
  const to = owner.ok ? owner.phone : CCO_OWNER_ALERT_PHONE_E164;
  const missing: string[] = [];
  if (!String(env.TWILIO_ACCOUNT_SID || "").trim()) missing.push("TWILIO_ACCOUNT_SID");
  if (!String(env.TWILIO_AUTH_TOKEN || "").trim()) missing.push("TWILIO_AUTH_TOKEN");
  const from = String(
    env.CCO_TWILIO_FROM_NUMBER || env.TWILIO_FROM_NUMBER || env.TWILIO_PHONE_NUMBER || "",
  ).trim();
  if (!from) missing.push("TWILIO_FROM_NUMBER|CCO_TWILIO_FROM_NUMBER|TWILIO_PHONE_NUMBER");

  if (!owner.ok) {
    return { configured: false, to, from: from || undefined, missing, reason: owner.reason };
  }
  if (missing.length) {
    return {
      configured: false,
      to,
      from: from || undefined,
      missing,
      reason: `sms_transport_unconfigured: missing ${missing.join(", ")}`,
    };
  }
  return {
    configured: true,
    to,
    from,
    accountSid: String(env.TWILIO_ACCOUNT_SID).trim(),
    missing: [],
  };
}

export async function sendCcoOwnerSms(input: {
  body: string;
  /** Ignored unless it is Bailey's number. Lead phones are rejected. */
  to?: string;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}): Promise<CcoOwnerSmsSendResult> {
  const env = input.env || process.env;
  const config = describeCcoOwnerSmsTransport(env);
  const requested = String(input.to || config.to).trim();
  if (!isCcoOwnerAlertPhone(requested)) {
    return { ok: false, error: "recipient_not_owner" };
  }
  if (!config.configured || !config.from || !config.accountSid) {
    return {
      ok: false,
      error: config.reason || "sms_transport_unconfigured",
      missing: config.missing,
    };
  }

  const token = String(env.TWILIO_AUTH_TOKEN || "").trim();
  if (!token) {
    return { ok: false, error: "sms_transport_unconfigured", missing: ["TWILIO_AUTH_TOKEN"] };
  }

  const fetchImpl = input.fetchImpl || fetch;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`;
  const authorization = `Basic ${Buffer.from(`${config.accountSid}:${token}`).toString("base64")}`;
  const body = new URLSearchParams({
    To: CCO_OWNER_ALERT_PHONE_E164,
    From: config.from,
    Body: input.body,
  });

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const payload = (await response.json().catch(() => null)) as { sid?: unknown; message?: unknown } | null;
    const providerId = typeof payload?.sid === "string" ? payload.sid.trim() : "";
    if (!response.ok) {
      return {
        ok: false,
        error: typeof payload?.message === "string" && payload.message.trim()
          ? payload.message.trim()
          : `twilio_http_${response.status}`,
        deliveryUnknown: response.status === 408 || response.status >= 500,
      };
    }
    return providerId
      ? { ok: true, id: providerId }
      : { ok: false, error: "twilio_provider_receipt_missing", deliveryUnknown: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "twilio_send_failed",
      deliveryUnknown: true,
    };
  }
}
