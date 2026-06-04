/**
 * Mac Mini PDF renderer client.
 *
 * Proxies to the FastAPI document engine at BLAZE_API_URL.
 * Two operations:
 *   - renderQuotePdf  → POST /api/documents/render  → PDF binary (Buffer)
 *   - previewQuotePdf → POST /api/documents/preview → { pdf_base64, total, phase_count, pdf_size_bytes }
 */
import { spawn } from "node:child_process";

const PYTHON_SAFE_CWD = process.env.HOME || "/tmp";

const BLAZE_ENV_ALIASES = ["BLAZE_API_URL", "BLAZE_API_BASE_URL"] as const;
const DEFAULT_TIMEOUT_MS = 12000;
const LOCAL_PDF_CONTENT_TYPE = "application/pdf";

const LOCAL_QUOTE_RENDERER_PYTHON = String.raw`
import base64
import io
import json
import sys
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

payload = json.load(sys.stdin)
seller = payload.get("seller") or {}
buyer = payload.get("buyer") or {}
summary = payload.get("summary") or {}
terms = ((payload.get("terms") or {}).get("sections") or {})
notes = payload.get("notes") or []
acceptance = payload.get("acceptance") or {}
phases = payload.get("phases") or []

buf = io.BytesIO()
pdf = canvas.Canvas(buf, pagesize=letter)
width, height = letter
margin = 54
cursor = height - 54

navy = HexColor("#0b1928")
blue = HexColor("#174196")
ink = HexColor("#1f2937")
muted = HexColor("#5b6470")
line = HexColor("#d6dde8")

def new_page():
    pdf.showPage()
    return height - 54

def ensure(y, needed=90):
    return y if y > needed else new_page()

def rule(y):
    pdf.setStrokeColor(line)
    pdf.setLineWidth(1)
    pdf.line(margin, y, width - margin, y)

def heading(text, y):
    pdf.setFillColor(blue)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(margin, y, str(text).upper())

def paragraph(text, y, font_name="Helvetica", font_size=10.5, color=ink, leading=15):
    pdf.setFillColor(color)
    pdf.setFont(font_name, font_size)
    max_width = width - margin * 2
    words = str(text or "").split()
    if not words:
        return y
    lines = []
    current = ""
    for word in words:
        candidate = (current + " " + word).strip()
        if stringWidth(candidate, font_name, font_size) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    for line_text in lines:
        pdf.drawString(margin, y, line_text)
        y -= leading
    return y

def money(value):
    try:
        return f"\${float(value):,.2f}"
    except Exception:
        return "$0.00"

project_ref = payload.get("ref_name") or buyer.get("company") or buyer.get("name") or "Quote"
quote_no = payload.get("quote_number") or "Draft"
issue_date = payload.get("issue_date") or ""
valid_until = payload.get("valid_until") or ""
total = 0.0
for phase in phases:
    for item in phase.get("line_items") or []:
        total += float(item.get("quantity") or 0) * float(item.get("price") or 0)

pdf.setTitle(f"Quote {quote_no}")
pdf.setAuthor("Content Co-op")

pdf.setFillColor(navy)
pdf.setFont("Helvetica-Bold", 12)
pdf.drawString(margin, cursor, str(seller.get("legal_name") or "Quote"))
cursor -= 20
pdf.setFont("Helvetica-Bold", 26)
pdf.drawString(margin, cursor, str(project_ref))
cursor -= 18
pdf.setFillColor(muted)
pdf.setFont("Helvetica", 10.5)
meta = " | ".join([part for part in [f"Quote #{quote_no}", issue_date, f"Valid until {valid_until}" if valid_until else ""] if part])
pdf.drawString(margin, cursor, meta)
cursor -= 20
rule(cursor)
cursor -= 22

for title, body in [
    ("Seller", " | ".join([part for part in [seller.get("legal_name"), seller.get("address_line1"), seller.get("address_line2"), seller.get("email"), seller.get("payment_handle")] if part])),
    ("Bill to", " | ".join([part for part in [buyer.get("name"), buyer.get("company"), buyer.get("email")] if part])),
]:
    cursor = ensure(cursor, 120)
    heading(title, cursor)
    cursor -= 18
    cursor = paragraph(body or "Pending", cursor)
    cursor -= 8

for phase in phases:
    cursor = ensure(cursor, 180)
    heading(phase.get("name") or "Phase", cursor)
    cursor -= 18
    cursor = paragraph(phase.get("date_label") or "", cursor, color=muted)
    cursor -= 6
    for item in phase.get("line_items") or []:
        cursor = ensure(cursor, 80)
        desc = item.get("description") or item.get("name") or "Line item"
        qty = float(item.get("quantity") or 0)
        price = float(item.get("price") or 0)
        line_total = qty * price
        pdf.setFillColor(ink)
        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawString(margin, cursor, str(item.get("name") or desc))
        pdf.drawRightString(width - margin, cursor, money(line_total))
        cursor -= 14
        pdf.setFont("Helvetica", 10)
        cursor = paragraph(f"{desc} - {qty:g} x {money(price)}", cursor, leading=14)
        cursor -= 6
    cursor -= 6

summary_lines = [
    summary.get("immediate_note"),
    summary.get("immediate_detail"),
    summary.get("deposit_note"),
    summary.get("payment_methods"),
]
summary_lines = [line for line in summary_lines if line]
if summary_lines:
    cursor = ensure(cursor, 120)
    heading("Summary", cursor)
    cursor -= 18
    for line_text in summary_lines:
        cursor = paragraph(line_text, cursor)
        cursor -= 4

if terms:
    cursor = ensure(cursor, 140)
    heading("Terms", cursor)
    cursor -= 18
    for key, value in terms.items():
        cursor = paragraph(f"{key}: {value}", cursor)
        cursor -= 4

if notes:
    cursor = ensure(cursor, 110)
    heading("Notes", cursor)
    cursor -= 18
    for note in notes:
        cursor = paragraph(f"- {note}", cursor)
        cursor -= 4

cursor = ensure(cursor, 90)
rule(cursor)
cursor -= 24
pdf.setFillColor(navy)
pdf.setFont("Helvetica-Bold", 18)
pdf.drawString(margin, cursor, f"Estimated total: {money(total)}")
cursor -= 18
pdf.setFillColor(muted)
pdf.setFont("Helvetica", 10.5)
sig = " | ".join([part for part in [acceptance.get("seller_name"), acceptance.get("seller_title")] if part])
if sig:
    pdf.drawString(margin, cursor, sig)

pdf.showPage()
pdf.save()
sys.stdout.write(json.dumps({"ok": True, "pdf_base64": base64.b64encode(buf.getvalue()).decode("ascii")}))
`;

function resolveBlazeBaseUrl(): string {
  for (const key of BLAZE_ENV_ALIASES) {
    const value = process.env[key]?.trim();
    if (value) return value.replace(/\/$/, "");
  }
  return "";
}

export type RenderRequest = {
  tenant: "cc" | "acs";
  document_type?: "quote" | "invoice";
  quote_number?: number;
  ref_name?: string;
  issue_date?: string;
  valid_until?: string;
  seller?: {
    legal_name: string;
    address_line1: string;
    address_line2: string;
    country?: string;
    email?: string;
    phone?: string;
    company_id?: string;
    payment_handle?: string;
  };
  buyer?: {
    name: string;
    email?: string;
    company?: string;
  };
  phases?: Array<{
    name: string;
    date_label: string;
    line_items: Array<{
      name: string;
      description: string;
      quantity: number;
      price: number;
    }>;
  }>;
  summary?: {
    immediate_note?: string;
    immediate_detail?: string;
    deposit_note?: string;
    payment_methods?: string;
  };
  terms?: {
    sections: Record<string, string>;
  };
  notes?: string[];
  acceptance?: {
    client_name?: string;
    client_company?: string;
    seller_name?: string;
    seller_title?: string;
  };
};

export type PreviewResult = {
  pdf_base64: string;
  total: number;
  phase_count: number;
  pdf_size_bytes: number;
};

export type DocumentResult = {
  ok: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  error?: string;
};

export type RenderResult = DocumentResult & {
  buffer?: Buffer;
  contentType?: string;
};

export type PreviewResponse = DocumentResult & {
  preview?: PreviewResult;
};

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

async function renderQuotePdfLocally(payload: RenderRequest): Promise<RenderResult> {
  try {
    const stdout = await runPythonJson(LOCAL_QUOTE_RENDERER_PYTHON, payload);
    const parsed = JSON.parse(stdout) as { ok?: boolean; pdf_base64?: string };
    if (!parsed.ok || !parsed.pdf_base64) {
      return { ok: false, statusCode: null, latencyMs: null, error: "local_quote_pdf_render_failed" };
    }
    return {
      ok: true,
      statusCode: 200,
      latencyMs: null,
      buffer: Buffer.from(parsed.pdf_base64, "base64"),
      contentType: LOCAL_PDF_CONTENT_TYPE,
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: null,
      latencyMs: null,
      error: error instanceof Error ? error.message : "local_quote_pdf_render_failed",
    };
  }
}

export async function renderQuotePdf(
  payload: RenderRequest,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<RenderResult> {
  const baseUrl = resolveBlazeBaseUrl();
  if (!baseUrl) {
    return renderQuotePdfLocally(payload);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const startedAt = Date.now();
    const response = await fetch(`${baseUrl}/api/documents/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 404 || response.status === 405) {
        const localFallback = await renderQuotePdfLocally(payload);
        if (localFallback.ok) return localFallback;
      }
      return { ok: false, statusCode: response.status, latencyMs, error: text };
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      ok: true,
      statusCode: response.status,
      latencyMs,
      buffer: Buffer.from(arrayBuffer),
      contentType: response.headers.get("content-type") || "application/pdf",
    };
  } catch (error) {
    const localFallback = await renderQuotePdfLocally(payload);
    if (localFallback.ok) return localFallback;
    return { ok: false, statusCode: null, latencyMs: null, error: String(error) };
  } finally {
    clearTimeout(timer);
  }
}

export async function previewQuotePdf(
  payload: RenderRequest,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<PreviewResponse> {
  const baseUrl = resolveBlazeBaseUrl();
  if (!baseUrl) {
    return { ok: false, statusCode: null, latencyMs: null, error: "missing_blaze_api_url" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const startedAt = Date.now();
    const response = await fetch(`${baseUrl}/api/documents/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const latencyMs = Date.now() - startedAt;
    const text = await response.text();

    if (!response.ok) {
      return { ok: false, statusCode: response.status, latencyMs, error: text };
    }

    let preview: PreviewResult | undefined;
    try {
      preview = JSON.parse(text) as PreviewResult;
    } catch {
      return { ok: false, statusCode: response.status, latencyMs, error: "invalid_json" };
    }

    return { ok: true, statusCode: response.status, latencyMs, preview };
  } catch (error) {
    return { ok: false, statusCode: null, latencyMs: null, error: String(error) };
  } finally {
    clearTimeout(timer);
  }
}
