import { createSign, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

/**
 * Gmail send through a Google service account with domain-wide delegation,
 * implemented in plain Node (no Python, no extra packages).
 *
 * Security notes:
 * - The token and Gmail endpoints are fixed constants. A `token_uri` inside the
 *   key file is never used.
 * - The only scope requested is gmail.send.
 * - The key file, the signed assertion and the access token are never logged
 *   and never appear in a returned error.
 */

export const GMAIL_DWD_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const REQUEST_TIMEOUT_MS = 20_000;

export interface GmailDwdAttachment {
  filename: string;
  /** Base64 content. */
  content: string;
  contentType?: string;
}

export interface GmailDwdMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: GmailDwdAttachment[];
}

export interface GmailDwdResult {
  ok: boolean;
  id?: string;
  error?: string;
  deliveryUnknown?: boolean;
}

const DEFAULT_KEY_CANDIDATES = [
  "~/.config/blaze/google/service_account.json",
  "~/.gemini/antigravity/playground/perihelion-armstrong/service_account.json",
];

function expandHome(candidate: string, env: Record<string, string | undefined>) {
  const home = env.HOME || "";
  return candidate.startsWith("~/") && home ? `${home}/${candidate.slice(2)}` : candidate;
}

/** Ordered key-file candidates, already home-expanded. */
export function gmailDwdKeyCandidates(env: Record<string, string | undefined> = process.env): string[] {
  const configured = [env.GOOGLE_DWD_SERVICE_ACCOUNT_FILE, env.GOOGLE_APPLICATION_CREDENTIALS]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => value.trim());
  return Array.from(new Set([...configured, ...DEFAULT_KEY_CANDIDATES].map((value) => expandHome(value, env))));
}

/** First candidate that exists, or null. */
export function findGmailDwdKeyPath(
  env: Record<string, string | undefined> = process.env,
  fileExists: (filePath: string) => boolean = (filePath) => existsSync(filePath),
): string | null {
  return gmailDwdKeyCandidates(env).find((candidate) => fileExists(candidate)) ?? null;
}

function b64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

export function buildGmailDwdAssertion(
  key: { client_email: string; private_key: string },
  subject: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: key.client_email,
    sub: subject,
    scope: GMAIL_SEND_SCOPE,
    aud: GMAIL_DWD_TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  }));
  const signingInput = `${header}.${claims}`;
  const signature = createSign("RSA-SHA256").update(signingInput).sign(key.private_key);
  return `${signingInput}.${b64url(signature)}`;
}

function headerValue(value: string) {
  // Header injection guard: a header value is one line.
  return value.replace(/[\r\n]+/g, " ").trim();
}

function encodeSubject(subject: string) {
  const clean = headerValue(subject);
  // eslint-disable-next-line no-control-regex
  return /^[\x20-\x7e]*$/.test(clean) ? clean : `=?UTF-8?B?${Buffer.from(clean, "utf8").toString("base64")}?=`;
}

function wrap76(base64: string) {
  return base64.replace(/(.{76})/g, "$1\r\n");
}

function textPart(contentType: string, body: string) {
  return [
    `Content-Type: ${contentType}; charset="UTF-8"`,
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(Buffer.from(body, "utf8").toString("base64")),
  ].join("\r\n");
}

function attachmentPart(attachment: GmailDwdAttachment) {
  const name = headerValue(attachment.filename || "attachment").replace(/["\\]/g, "_");
  // eslint-disable-next-line no-control-regex
  const ascii = /^[\x20-\x7e]*$/.test(name);
  const fallback = ascii ? name : name.replace(/[^\x20-\x7e]/g, "_");
  const disposition = ascii
    ? `attachment; filename="${fallback}"`
    : `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
  const type = headerValue(attachment.contentType || "application/octet-stream") || "application/octet-stream";
  return [
    `Content-Type: ${type}; name="${fallback}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: ${disposition}`,
    "",
    wrap76(attachment.content.replace(/\s+/g, "")),
  ].join("\r\n");
}

/** RFC 822 / MIME message: text + html alternative, optional attachments. */
export function buildMimeMessage(message: GmailDwdMessage, now: Date = new Date()): string {
  const mixed = `mixed_${randomBytes(12).toString("hex")}`;
  const alt = `alt_${randomBytes(12).toString("hex")}`;
  const headers = [
    `From: ${headerValue(message.from)}`,
    `To: ${headerValue(message.to)}`,
    ...(message.replyTo ? [`Reply-To: ${headerValue(message.replyTo)}`] : []),
    `Subject: ${encodeSubject(message.subject)}`,
    `Date: ${now.toUTCString().replace("GMT", "+0000")}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixed}"`,
  ];
  const body = [
    `--${mixed}`,
    `Content-Type: multipart/alternative; boundary="${alt}"`,
    "",
    `--${alt}`,
    textPart("text/plain", message.text || ""),
    `--${alt}`,
    textPart("text/html", message.html || ""),
    `--${alt}--`,
    ...(message.attachments || []).flatMap((attachment) => [`--${mixed}`, attachmentPart(attachment)]),
    `--${mixed}--`,
    "",
  ];
  return `${headers.join("\r\n")}\r\n\r\n${body.join("\r\n")}`;
}

function safeToken(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) : "";
  return text || fallback;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const body: unknown = await response.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
}

function tokenFailure(status: number, body: Record<string, unknown>): GmailDwdResult {
  const code = safeToken(body.error, "unknown");
  if (code === "unauthorized_client") {
    return { ok: false, error: "gmail_dwd_unauthorized: Google refused this sender (domain-wide delegation or scope not authorized)" };
  }
  if (code === "invalid_grant") {
    return { ok: false, error: "gmail_dwd_invalid_grant: Google rejected the sender mailbox or key (mailbox missing, key disabled or clock skew)" };
  }
  return { ok: false, error: `gmail_dwd_token_failed: HTTP ${status} ${code}` };
}

function sendFailure(status: number, body: Record<string, unknown>): GmailDwdResult {
  const err = body.error && typeof body.error === "object" ? body.error as Record<string, unknown> : {};
  const first = Array.isArray(err.errors) && err.errors[0] && typeof err.errors[0] === "object"
    ? err.errors[0] as Record<string, unknown>
    : {};
  const reason = safeToken(first.reason ?? err.status, "unknown");
  if (status === 408 || status >= 500) {
    return { ok: false, error: `gmail_dwd_send_unknown: Gmail answered HTTP ${status}; delivery not confirmed`, deliveryUnknown: true };
  }
  if (status === 429 || /ratelimit|quota|limit_exceeded|resource_exhausted/.test(reason)) {
    return { ok: false, error: `gmail_dwd_quota: Gmail sending limit reached (${reason})` };
  }
  if (status === 401) {
    return { ok: false, error: "gmail_dwd_unauthorized: Google refused this sender (token not accepted by Gmail)" };
  }
  if (status === 403) {
    return { ok: false, error: `gmail_dwd_forbidden: Gmail refused the send (${reason})` };
  }
  return { ok: false, error: `gmail_dwd_send_failed: HTTP ${status} ${reason}` };
}

/**
 * Send one message. Contract:
 * - `ok: true` always carries the Gmail message id.
 * - Failures before the message is handed to Gmail (key, token) are definite.
 * - A timeout, network error, 408 or 5xx on the send call is `deliveryUnknown`.
 */
export async function sendGmailViaServiceAccount(
  message: GmailDwdMessage,
  config: { subject: string; keyPath: string | null },
): Promise<GmailDwdResult> {
  if (!config.keyPath) return { ok: false, error: "gmail_dwd_key_missing: no service account key file is configured on this host" };

  let key: { client_email: string; private_key: string };
  try {
    const parsed: unknown = JSON.parse(await readFile(config.keyPath, "utf8"));
    const record = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
    if (typeof record.client_email !== "string" || typeof record.private_key !== "string" || !record.client_email || !record.private_key) {
      return { ok: false, error: "gmail_dwd_key_invalid: service account key file is missing client_email or private_key" };
    }
    key = { client_email: record.client_email, private_key: record.private_key };
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException | null)?.code === "ENOENT";
    return missing
      ? { ok: false, error: "gmail_dwd_key_missing: service account key file not found" }
      : { ok: false, error: "gmail_dwd_key_invalid: service account key file could not be read" };
  }

  let assertion: string;
  let raw: string;
  try {
    assertion = buildGmailDwdAssertion(key, config.subject);
    raw = Buffer.from(buildMimeMessage(message), "utf8").toString("base64url");
  } catch {
    return { ok: false, error: "gmail_dwd_key_invalid: service account private key could not sign" };
  }

  let accessToken = "";
  try {
    const tokenResponse = await fetch(GMAIL_DWD_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }).toString(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const tokenBody = await readJson(tokenResponse);
    if (!tokenResponse.ok) return tokenFailure(tokenResponse.status, tokenBody);
    accessToken = typeof tokenBody.access_token === "string" ? tokenBody.access_token : "";
    if (!accessToken) return { ok: false, error: "gmail_dwd_token_failed: Google returned no access token" };
  } catch {
    // Nothing has been handed to Gmail yet, so this is a definite failure.
    return { ok: false, error: "gmail_dwd_token_unreachable: could not reach Google to request a sending token" };
  }

  try {
    const sendResponse = await fetch(GMAIL_SEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!sendResponse.ok) return sendFailure(sendResponse.status, await readJson(sendResponse));
    const body: unknown = await sendResponse.json().catch(() => undefined);
    if (body === undefined) {
      return { ok: false, error: "gmail_provider_receipt_invalid", deliveryUnknown: true };
    }
    const id = body && typeof body === "object" && typeof (body as Record<string, unknown>).id === "string"
      ? ((body as Record<string, unknown>).id as string).trim()
      : "";
    return id
      ? { ok: true, id }
      : { ok: false, error: "gmail_provider_receipt_missing", deliveryUnknown: true };
  } catch {
    // The request may have reached Gmail. Never auto-resend.
    return { ok: false, error: "gmail_dwd_send_unknown: no answer from Gmail; delivery not confirmed", deliveryUnknown: true };
  }
}
