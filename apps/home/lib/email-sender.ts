import { spawn } from "node:child_process";

const PYTHON_SAFE_CWD = process.env.HOME || "/tmp";
const DEFAULT_BLAZE_GMAIL_TOKEN_PATH = "~/.config/blaze/google/blaze_contentcoop.json";
const DEFAULT_BLAZE_GMAIL_SERVICE_TOKEN_PATH = "~/.config/blaze/google/bailey_contentcoop_service.json";

interface SendEmailAttachment {
  filename: string;
  content: string;
  contentType?: string;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  businessUnit?: string;
  senderSub?: string;
  attachments?: SendEmailAttachment[];
}

interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
  /** The provider handoff may have succeeded, so automatic resend is unsafe. */
  deliveryUnknown?: boolean;
}

const GMAIL_DWD_PYTHON = String.raw`
import base64
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email import encoders
from pathlib import Path

payload = json.load(sys.stdin)
service_account_path = os.path.expanduser(
    next(
        (
            path
            for path in (
                payload.get("service_account_path"),
                os.environ.get("GOOGLE_DWD_SERVICE_ACCOUNT_FILE"),
                os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"),
                "~/.config/blaze/google/service_account.json",
                "~/.gemini/antigravity/playground/perihelion-armstrong/service_account.json",
            )
            if path
        ),
        "~/.gemini/antigravity/playground/perihelion-armstrong/service_account.json",
    )
)
sender_sub = payload.get("sender_sub") or os.environ.get("GOOGLE_DWD_IMPERSONATION_SUBJECT") or "blaze@contentco-op.com"

with open(service_account_path, "r", encoding="utf-8") as handle:
    service_account = json.load(handle)

message = MIMEMultipart("mixed")
message["To"] = payload["to"]
message["From"] = payload["from"]
message["Subject"] = payload["subject"]
if payload.get("reply_to"):
    message["Reply-To"] = payload["reply_to"]

alternative = MIMEMultipart("alternative")
alternative.attach(MIMEText(payload.get("text") or "", "plain", "utf-8"))
alternative.attach(MIMEText(payload.get("html") or "", "html", "utf-8"))
message.attach(alternative)

for attachment in payload.get("attachments") or []:
    part = MIMEBase("application", "octet-stream")
    part.set_payload(base64.b64decode(attachment["content"]))
    encoders.encode_base64(part)
    content_type = attachment.get("content_type") or "application/octet-stream"
    part.add_header("Content-Type", content_type)
    part.add_header("Content-Disposition", f'attachment; filename="{attachment["filename"]}"')
    message.attach(part)

raw = base64.urlsafe_b64encode(message.as_bytes()).decode()

header = base64.urlsafe_b64encode(json.dumps({"alg": "RS256", "typ": "JWT"}).encode()).rstrip(b"=").decode()
claims = base64.urlsafe_b64encode(json.dumps({
    "iss": service_account["client_email"],
    "scope": "https://www.googleapis.com/auth/gmail.send",
    "aud": "https://oauth2.googleapis.com/token",
    "sub": sender_sub,
    "iat": int(time.time()),
    "exp": int(time.time()) + 3600,
}).encode()).rstrip(b"=").decode()

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

private_key = serialization.load_pem_private_key(service_account["private_key"].encode(), password=None)
signing_input = f"{header}.{claims}".encode()
signature = base64.urlsafe_b64encode(private_key.sign(signing_input, padding.PKCS1v15(), hashes.SHA256())).rstrip(b"=").decode()
jwt_token = f"{header}.{claims}.{signature}"

token_request = urllib.request.Request(
    "https://oauth2.googleapis.com/token",
    data=urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": jwt_token,
    }).encode(),
    headers={"Content-Type": "application/x-www-form-urlencoded"},
)
with urllib.request.urlopen(token_request, timeout=20) as response:
    access_token = json.loads(response.read())["access_token"]

send_request = urllib.request.Request(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    data=json.dumps({"raw": raw}).encode(),
    headers={
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    },
)
try:
    with urllib.request.urlopen(send_request, timeout=20) as response:
        result = json.loads(response.read() or b"{}")
except Exception as error:
    # Authentication and message construction completed. A transport failure
    # here may occur after Gmail accepted the message, so callers must not
    # automatically retry it through another provider.
    sys.stderr.write(f"DELIVERY_UNKNOWN:{type(error).__name__}:{error}")
    sys.exit(70)

sys.stdout.write(json.dumps({"ok": True, "id": result.get("id")}))
`;

const GMAIL_OAUTH_PYTHON = String.raw`
import base64
import json
import os
import sys
import urllib.parse
import urllib.request
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email import encoders

payload = json.load(sys.stdin)
token_path = os.path.expanduser(payload.get("token_path") or os.environ.get("GOOGLE_OAUTH_TOKEN_FILE_BLAZE") or "~/.config/blaze/google/blaze_contentcoop.json")

with open(token_path, "r", encoding="utf-8") as handle:
    token_data = json.load(handle)

refresh_request = urllib.request.Request(
    "https://oauth2.googleapis.com/token",
    data=urllib.parse.urlencode({
        "client_id": token_data["client_id"],
        "client_secret": token_data["client_secret"],
        "refresh_token": token_data["refresh_token"],
        "grant_type": "refresh_token",
    }).encode(),
    headers={"Content-Type": "application/x-www-form-urlencoded"},
)
with urllib.request.urlopen(refresh_request, timeout=20) as response:
    access_token = json.loads(response.read())["access_token"]

message = MIMEMultipart("mixed")
message["To"] = payload["to"]
message["From"] = payload["from"]
message["Subject"] = payload["subject"]
if payload.get("reply_to"):
    message["Reply-To"] = payload["reply_to"]

alternative = MIMEMultipart("alternative")
alternative.attach(MIMEText(payload.get("text") or "", "plain", "utf-8"))
alternative.attach(MIMEText(payload.get("html") or "", "html", "utf-8"))
message.attach(alternative)

for attachment in payload.get("attachments") or []:
    part = MIMEBase("application", "octet-stream")
    part.set_payload(base64.b64decode(attachment["content"]))
    encoders.encode_base64(part)
    content_type = attachment.get("content_type") or "application/octet-stream"
    part.add_header("Content-Type", content_type)
    part.add_header("Content-Disposition", f'attachment; filename="{attachment["filename"]}"')
    message.attach(part)

raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
send_request = urllib.request.Request(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    data=json.dumps({"raw": raw}).encode(),
    headers={
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    },
)
try:
    with urllib.request.urlopen(send_request, timeout=20) as response:
        result = json.loads(response.read() or b"{}")
except Exception as error:
    # Token refresh completed and the send request was handed to Gmail. The
    # absence of a response is an ambiguous outcome, not a confirmed failure.
    sys.stderr.write(f"DELIVERY_UNKNOWN:{type(error).__name__}:{error}")
    sys.exit(70)

sys.stdout.write(json.dumps({"ok": True, "id": result.get("id")}))
`;

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getFromAddress(businessUnit?: string): string {
  const bu = String(businessUnit || "ACS").toUpperCase();
  if (bu === "CC") return "Content Co-Op <blaze@contentco-op.com>";
  return `Astro Cleaning Services <${process.env.ACS_EMAIL_FROM_ADDRESS || "noreply@astrocleanings.com"}>`;
}

function getReplyToAddress(businessUnit?: string): string | undefined {
  const bu = String(businessUnit || "ACS").toUpperCase();
  if (bu === "CC") return undefined;
  return process.env.ACS_EMAIL_REPLY_TO || "service@astrocleanings.com";
}

function getSenderSub(options: SendEmailOptions): string {
  if (options.senderSub?.trim()) return options.senderSub.trim();
  const bu = String(options.businessUnit || "ACS").toUpperCase();
  if (bu === "CC") {
    return (
      process.env.CCO_GMAIL_SENDER_SUB ||
      process.env.GOOGLE_DWD_IMPERSONATION_SUBJECT ||
      "blaze@contentco-op.com"
    );
  }
  return (
    process.env.ACS_GMAIL_SENDER_SUB ||
    process.env.GOOGLE_DWD_IMPERSONATION_SUBJECT_ACS ||
    process.env.ACS_EMAIL_FROM_ADDRESS ||
    process.env.GOOGLE_DWD_IMPERSONATION_SUBJECT ||
    "noreply@astrocleanings.com"
  );
}

function runPythonJson(script: string, payload: unknown): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("python3", ["-c", script], {
      cwd: PYTHON_SAFE_CWD,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(stderr.trim() || stdout.trim() || `python exited with code ${code}`));
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

function getGoogleOauthTokenPaths(options: SendEmailOptions) {
  const bu = String(options.businessUnit || "").toUpperCase();
  if (bu === "ACS") {
    const candidates = [
      process.env.GOOGLE_OAUTH_TOKEN_FILE_ACS,
      process.env.ACS_GMAIL_OAUTH_TOKEN_FILE,
    ].filter((value): value is string => Boolean(value && value.trim()));
    return Array.from(new Set(candidates));
  }
  if (bu !== "CC") return [];

  const configured = process.env.GOOGLE_OAUTH_TOKEN_FILE_BLAZE;
  const candidates = [
    configured,
    DEFAULT_BLAZE_GMAIL_TOKEN_PATH,
    DEFAULT_BLAZE_GMAIL_SERVICE_TOKEN_PATH,
  ].filter((value): value is string => Boolean(value && value.trim()));

  return Array.from(new Set(candidates));
}

async function sendViaGmailOauth(options: SendEmailOptions): Promise<SendResult> {
  const tokenPaths = getGoogleOauthTokenPaths(options);
  if (tokenPaths.length === 0) return { ok: false, error: "gmail_oauth_not_configured" };
  const replyTo = options.replyTo || getReplyToAddress(options.businessUnit);

  let lastError = "gmail_oauth_send_failed";
  for (const tokenPath of tokenPaths) {
    try {
      const stdout = await runPythonJson(GMAIL_OAUTH_PYTHON, {
        to: options.to,
        from: options.from || getFromAddress(options.businessUnit),
        subject: options.subject,
        html: options.html,
        text: options.text || stripHtml(options.html),
        reply_to: replyTo || undefined,
        attachments: (options.attachments || []).map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content,
          content_type: attachment.contentType || "application/octet-stream",
        })),
        token_path: tokenPath,
      });
      let parsed: { ok?: boolean; id?: string; error?: string };
      try {
        parsed = JSON.parse(stdout) as { ok?: boolean; id?: string; error?: string };
      } catch {
        // The child exits successfully only after the Gmail send request
        // returns. A missing receipt is therefore not safe to retry.
        return { ok: false, error: "gmail_provider_receipt_invalid", deliveryUnknown: true };
      }
      if (parsed.ok) {
        return parsed.id
          ? { ok: true, id: parsed.id }
          : { ok: false, error: "gmail_provider_receipt_missing", deliveryUnknown: true };
      }
      lastError = parsed.error || lastError;
    } catch (error) {
      const message = error instanceof Error ? error.message : "gmail_oauth_send_failed";
      if (message.startsWith("DELIVERY_UNKNOWN:")) {
        return { ok: false, error: message.slice("DELIVERY_UNKNOWN:".length), deliveryUnknown: true };
      }
      lastError = message;
    }
  }

  return { ok: false, error: lastError };
}

async function sendViaGmailDwd(options: SendEmailOptions): Promise<SendResult> {
  const replyTo = options.replyTo || getReplyToAddress(options.businessUnit);
  try {
    const stdout = await runPythonJson(GMAIL_DWD_PYTHON, {
      to: options.to,
      from: options.from || getFromAddress(options.businessUnit),
      subject: options.subject,
      html: options.html,
      text: options.text || stripHtml(options.html),
      reply_to: replyTo || undefined,
      attachments: (options.attachments || []).map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        content_type: attachment.contentType || "application/octet-stream",
      })),
      sender_sub: getSenderSub(options),
      service_account_path: process.env.GOOGLE_DWD_SERVICE_ACCOUNT_FILE || undefined,
    });
    let parsed: { ok?: boolean; id?: string; error?: string };
    try {
      parsed = JSON.parse(stdout) as { ok?: boolean; id?: string; error?: string };
    } catch {
      return { ok: false, error: "gmail_provider_receipt_invalid", deliveryUnknown: true };
    }
    if (!parsed.ok) {
      return { ok: false, error: parsed.error || "gmail_dwd_send_failed" };
    }
    return parsed.id
      ? { ok: true, id: parsed.id }
      : { ok: false, error: "gmail_provider_receipt_missing", deliveryUnknown: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "gmail_dwd_send_failed";
    return message.startsWith("DELIVERY_UNKNOWN:")
      ? { ok: false, error: message.slice("DELIVERY_UNKNOWN:".length), deliveryUnknown: true }
      : { ok: false, error: message };
  }
}

export async function sendTransactionalEmail(options: SendEmailOptions): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = options.from || getFromAddress(options.businessUnit);
  const replyTo = options.replyTo || getReplyToAddress(options.businessUnit);

  if (!apiKey) {
    const gmailOauth = await sendViaGmailOauth({ ...options, from });
    if (gmailOauth.ok) {
      return gmailOauth;
    }
    if (gmailOauth.deliveryUnknown) {
      return gmailOauth;
    }
    const gmailFallback = await sendViaGmailDwd({ ...options, from });
    if (gmailFallback.ok) {
      return gmailFallback;
    }
    console.log(`[email-sender] RESEND_API_KEY not set and Gmail fallbacks failed. Would send:\n  To: ${options.to}\n  From: ${from}\n  Subject: ${options.subject}\n  OAuth error: ${gmailOauth.error || "unknown"}\n  DWD error: ${gmailFallback.error || "unknown"}`);
    return gmailFallback.error ? { ok: false, error: gmailFallback.error } : gmailOauth;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text || stripHtml(options.html),
        reply_to: replyTo || undefined,
        attachments: (options.attachments || []).map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content,
          content_type: attachment.contentType || "application/octet-stream",
        })),
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[email-sender] Resend API error:", err);
      return {
        ok: false,
        error: err.message || `HTTP ${res.status}`,
        deliveryUnknown: res.status === 408 || res.status >= 500,
      };
    }

    const data = await res.json().catch(() => null) as { id?: unknown } | null;
    const providerId = typeof data?.id === "string" ? data.id.trim() : "";
    return providerId
      ? { ok: true, id: providerId }
      : { ok: false, error: "resend_provider_receipt_missing", deliveryUnknown: true };
  } catch (err) {
    console.error("[email-sender] Failed to send:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unknown",
      deliveryUnknown: true,
    };
  }
}

export async function sendInvoiceReminder(invoice: {
  id: string;
  invoice_number: string;
  client_name: string;
  client_email: string;
  total: number;
  balance_due: number;
  due_date: string;
  business_unit: string;
}, stage: "pre_due" | "due" | "overdue_7" | "overdue_14" | "overdue_30" | "overdue_60"): Promise<SendResult> {
  const bu = String(invoice.business_unit || "ACS").toUpperCase();
  const brandName = bu === "ACS" ? "Astro Cleanings" : "Content Co-Op";
  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:4100"}/share/invoice/${invoice.id}`;
  const amount = invoice.balance_due.toLocaleString("en-US", { style: "currency", currency: "USD" });
  const dueDate = new Date(invoice.due_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const subjectMap: Record<string, string> = {
    pre_due: `Invoice ${invoice.invoice_number} - Payment Due Soon`,
    due: `Invoice ${invoice.invoice_number} - Payment Due Today`,
    overdue_7: `Invoice ${invoice.invoice_number} - Payment Overdue`,
    overdue_14: `Invoice ${invoice.invoice_number} - Second Reminder`,
    overdue_30: `Invoice ${invoice.invoice_number} - Payment Required`,
    overdue_60: `Invoice ${invoice.invoice_number} - Final Notice`,
  };

  const toneMap: Record<string, string> = {
    pre_due: `This is a friendly reminder that your invoice is due on ${dueDate}.`,
    due: `Your invoice is due today (${dueDate}).`,
    overdue_7: `Your invoice was due on ${dueDate} and is now past due.`,
    overdue_14: `This is a second reminder that your invoice from ${dueDate} remains unpaid.`,
    overdue_30: `Your invoice has been outstanding for 30 days. Please arrange payment at your earliest convenience.`,
    overdue_60: `This is a final notice regarding your overdue invoice. Please contact us immediately to arrange payment.`,
  };

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; color: #333;">
      <div style="padding: 24px 0; border-bottom: 2px solid #e5e7eb;">
        <div style="font-size: 18px; font-weight: 700; color: #111;">${brandName}</div>
      </div>
      <div style="padding: 24px 0;">
        <p>Hi ${invoice.client_name || "there"},</p>
        <p>${toneMap[stage] || toneMap.due}</p>
        <div style="margin: 20px 0; padding: 16px 20px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
          <div style="font-size: 13px; color: #666;">Invoice ${invoice.invoice_number}</div>
          <div style="font-size: 22px; font-weight: 700; color: #111; margin-top: 4px;">${amount}</div>
          <div style="font-size: 12px; color: #888; margin-top: 4px;">Due: ${dueDate}</div>
        </div>
        <a href="${shareUrl}" style="display: inline-block; padding: 12px 28px; background: ${bu === "ACS" ? "#1B4F72" : "#1a3a5c"}; color: #fff; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 14px;">
          View & Pay Invoice
        </a>
        <p style="margin-top: 20px; font-size: 13px; color: #888;">
          If you've already made this payment, please disregard this notice.
        </p>
      </div>
      <div style="padding: 16px 0; border-top: 1px solid #e5e7eb; font-size: 11px; color: #aaa;">
        ${brandName} - Sent automatically
      </div>
    </div>
  `;

  return sendTransactionalEmail({
    to: invoice.client_email,
    subject: subjectMap[stage] || subjectMap.due,
    html,
    businessUnit: invoice.business_unit,
  });
}
