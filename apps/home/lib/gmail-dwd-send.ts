import { createPrivateKey, createSign, randomBytes } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
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
/**
 * Total budget for token exchange plus send. It must stay below the owner
 * alert wrapper's 8 s race so an abandoned send is cancelled, not left running.
 */
export const GMAIL_DWD_TOTAL_TIMEOUT_MS = 7_000;

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

export type GmailDwdKeyCheck =
  | "key_file_missing"
  | "not_a_regular_file"
  | "unreadable"
  | "not_json"
  | "not_service_account"
  | "missing_client_email"
  | "missing_private_key"
  | "private_key_unusable";

export type GmailDwdKeyState =
  | { state: "not_configured" }
  | { state: "invalid"; check: GmailDwdKeyCheck }
  | { state: "valid"; path: string };

/** Local checks only: never returns or logs file contents. Not proof that Google accepts the key. */
function checkKeyFile(filePath: string): GmailDwdKeyCheck | null {
  let stat;
  try {
    stat = statSync(filePath);
  } catch (error) {
    return (error as NodeJS.ErrnoException | null)?.code === "ENOENT" ? "key_file_missing" : "unreadable";
  }
  if (!stat.isFile()) return "not_a_regular_file";
  if (stat.size > 64 * 1024) return "not_json";
  let parsed: unknown;
  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    return "unreadable";
  }
  try {
    parsed = JSON.parse(text);
  } catch {
    return "not_json";
  }
  const record = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  if (!record || record.type !== "service_account") return "not_service_account";
  if (typeof record.client_email !== "string" || !record.client_email.trim()) return "missing_client_email";
  if (typeof record.private_key !== "string" || !record.private_key.trim()) return "missing_private_key";
  try {
    if (createPrivateKey(record.private_key).asymmetricKeyType !== "rsa") return "private_key_unusable";
  } catch {
    return "private_key_unusable";
  }
  return null;
}

/** not configured / configured but invalid (which check failed) / locally valid. */
export function inspectGmailDwdKey(env: Record<string, string | undefined> = process.env): GmailDwdKeyState {
  const explicit = [env.GOOGLE_DWD_SERVICE_ACCOUNT_FILE, env.GOOGLE_APPLICATION_CREDENTIALS]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => expandHome(value.trim(), env));
  let firstFailure: GmailDwdKeyCheck | null = null;
  for (const candidate of gmailDwdKeyCandidates(env)) {
    const failure = checkKeyFile(candidate);
    if (!failure) return { state: "valid", path: candidate };
    // An absent default location is simply "not configured"; an explicit path is a promise.
    if (!firstFailure && (failure !== "key_file_missing" || explicit.includes(candidate))) firstFailure = failure;
  }
  return firstFailure ? { state: "invalid", check: firstFailure } : { state: "not_configured" };
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

// eslint-disable-next-line no-control-regex
const PRINTABLE_ASCII = /^[\x20-\x7e]*$/;
/** An RFC 2047 encoded-word must be at most 75 characters: 10 + base64 + 2. */
const MAX_ENCODED_WORD_BYTES = 45;

/** Split text into RFC 2047 B-encoded words, never cutting a UTF-8 character. */
export function encodeWords(text: string): string[] {
  const words: string[] = [];
  let chunk: Buffer[] = [];
  let size = 0;
  const flush = () => {
    if (chunk.length) words.push(`=?UTF-8?B?${Buffer.concat(chunk).toString("base64")}?=`);
    chunk = [];
    size = 0;
  };
  for (const char of text) {
    const bytes = Buffer.from(char, "utf8");
    if (size + bytes.length > MAX_ENCODED_WORD_BYTES) flush();
    chunk.push(bytes);
    size += bytes.length;
  }
  flush();
  return words;
}

/** Fold ASCII text at spaces so no line exceeds `limit` (long tokens are left whole). */
function foldAscii(text: string, firstLineUsed: number, limit = 76): string {
  const lines: string[] = [];
  let line = "";
  let used = firstLineUsed;
  for (const token of text.split(" ")) {
    if (line && used + line.length + 1 + token.length > limit) {
      lines.push(line);
      line = token;
      used = 0;
    } else {
      line = line ? `${line} ${token}` : token;
    }
  }
  lines.push(line);
  return lines.join("\r\n ");
}

/** Unstructured header (Subject): ASCII folds at spaces, anything else becomes encoded-words. */
function unstructuredHeader(name: string, value: string): string {
  const clean = headerValue(value);
  const used = name.length + 2;
  if (PRINTABLE_ASCII.test(clean)) {
    // A single ASCII token that would overflow the hard line limit is encoded.
    return clean.split(" ").some((token) => token.length > 900)
      ? `${name}: ${encodeWords(clean).join("\r\n ")}`
      : `${name}: ${foldAscii(clean, used)}`;
  }
  return `${name}: ${encodeWords(clean).join("\r\n ")}`;
}

/** Address header: only the display name is encoded; the addr-spec stays as is. */
function addressHeader(name: string, value: string): string {
  const clean = headerValue(value);
  const match = /^(.*?)\s*<([^<>]+)>$/.exec(clean);
  if (!match || !match[1].trim()) return `${name}: ${clean}`;
  const display = match[1].trim().replace(/^"(.*)"$/, "$1");
  const addr = match[2].trim();
  if (!PRINTABLE_ASCII.test(display)) return `${name}: ${encodeWords(display).join("\r\n ")} <${addr}>`;
  return /[()<>\[\]:;@\\,."]/.test(display)
    ? `${name}: "${display.replace(/["\\]/g, "\\$&")}" <${addr}>`
    : `${name}: ${display} <${addr}>`;
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

/** RFC 2231 parameter: continuation segments keep every line short. */
function encodedParam(name: string, value: string): string[] {
  const segments: string[] = [];
  let current = "";
  for (const char of value) {
    const piece = Array.from(Buffer.from(char, "utf8"))
      .map((byte) => `%${byte.toString(16).toUpperCase().padStart(2, "0")}`)
      .join("");
    const safe = /^[A-Za-z0-9.\-_~]$/.test(char) ? char : piece;
    if (current.length + safe.length > 40) {
      segments.push(current);
      current = "";
    }
    current += safe;
  }
  segments.push(current);
  if (segments.length === 1) return [`${name}*=UTF-8''${segments[0]}`];
  return segments.map((segment, index) => `${name}*${index}*=${index === 0 ? "UTF-8''" : ""}${segment}`);
}

function attachmentPart(attachment: GmailDwdAttachment) {
  const name = headerValue(attachment.filename || "attachment");
  const fallback = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_").slice(0, 60);
  const type = headerValue(attachment.contentType || "application/octet-stream").replace(/[^\x21-\x7e]/g, "") || "application/octet-stream";
  const params = PRINTABLE_ASCII.test(name) && !/["\\]/.test(name) && name.length <= 60
    ? [`filename="${name}"`]
    : [`filename="${fallback}"`, ...encodedParam("filename", name)];
  return [
    `Content-Type: ${type};\r\n name="${fallback}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment;\r\n ${params.join(";\r\n ")}`,
    "",
    wrap76(attachment.content.replace(/\s+/g, "")),
  ].join("\r\n");
}

/** RFC 822 / MIME message: text + html alternative, optional attachments. */
export function buildMimeMessage(message: GmailDwdMessage, now: Date = new Date()): string {
  const mixed = `mixed_${randomBytes(12).toString("hex")}`;
  const alt = `alt_${randomBytes(12).toString("hex")}`;
  const headers = [
    addressHeader("From", message.from),
    addressHeader("To", message.to),
    ...(message.replyTo ? [addressHeader("Reply-To", message.replyTo)] : []),
    unstructuredHeader("Subject", message.subject),
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

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const body: unknown = await response.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
}

/**
 * Provider strings never reach callers. Each known value maps to a fixed
 * application code; anything else becomes `unknown_reason`.
 */
const QUOTA_REASONS = new Set(["ratelimitexceeded", "userratelimitexceeded", "dailylimitexceeded", "quotaexceeded", "resource_exhausted", "rate_limit_exceeded"]);
const SEND_REASON_CODES: Record<string, string> = {
  insufficientpermissions: "insufficient_permissions",
  permission_denied: "insufficient_permissions",
  forbidden: "forbidden",
  invalid_argument: "invalid_argument",
  badrequest: "bad_request",
  invalid: "invalid_message",
  failed_precondition: "failed_precondition",
  notfound: "not_found",
  not_found: "not_found",
  unauthenticated: "unauthenticated",
  autherror: "auth_error",
};
const TOKEN_REASON_CODES: Record<string, string> = {
  invalid_request: "invalid_request",
  invalid_client: "invalid_client",
  invalid_scope: "invalid_scope",
  access_denied: "access_denied",
};

function providerKey(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase().slice(0, 64) : "";
}

function tokenFailure(status: number, body: Record<string, unknown>): GmailDwdResult {
  const code = providerKey(body.error);
  if (code === "unauthorized_client") {
    return { ok: false, error: "gmail_dwd_unauthorized: Google refused this sender (domain-wide delegation or scope not authorized)" };
  }
  if (code === "invalid_grant") {
    return { ok: false, error: "gmail_dwd_invalid_grant: Google rejected the sender mailbox or key (mailbox missing, key disabled or clock skew)" };
  }
  return { ok: false, error: `gmail_dwd_token_failed: HTTP ${status} ${TOKEN_REASON_CODES[code] || "unknown_reason"}` };
}

function sendFailure(status: number, body: Record<string, unknown>): GmailDwdResult {
  const err = body.error && typeof body.error === "object" ? body.error as Record<string, unknown> : {};
  const first = Array.isArray(err.errors) && err.errors[0] && typeof err.errors[0] === "object"
    ? err.errors[0] as Record<string, unknown>
    : {};
  const reasons = [providerKey(first.reason), providerKey(err.status)];
  const reason = reasons.map((key) => SEND_REASON_CODES[key]).find(Boolean) || "unknown_reason";
  if (status === 408 || status >= 500) {
    return { ok: false, error: `gmail_dwd_send_unknown: Gmail answered HTTP ${status}; delivery not confirmed`, deliveryUnknown: true };
  }
  if (status === 429 || reasons.some((key) => QUOTA_REASONS.has(key))) {
    return { ok: false, error: `gmail_dwd_quota: Gmail sending limit reached (HTTP ${status})` };
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
  config: { subject: string; keyPath: string | null; signal?: AbortSignal },
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

  const budget = AbortSignal.timeout(GMAIL_DWD_TOTAL_TIMEOUT_MS);
  const signal = config.signal ? AbortSignal.any([budget, config.signal]) : budget;
  let accessToken = "";
  try {
    const tokenResponse = await fetch(GMAIL_DWD_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }).toString(),
      signal,
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
      signal,
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
