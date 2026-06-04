import { spawn } from "node:child_process";

const PYTHON_SAFE_CWD = process.env.HOME || "/tmp";

const PYTHON_PROPOSAL_RENDERER = String.raw`
import base64
import io
import json
import sys
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

payload = json.load(sys.stdin)
brief = payload.get("brief") or {}
quote = payload.get("quote") or {}
booking_url = payload.get("booking_url") or ""

buffer = io.BytesIO()
pdf = canvas.Canvas(buffer, pagesize=letter)
width, height = letter
margin = 54
cursor = height - 56

navy = HexColor("#0b1928")
blue = HexColor("#174196")
ink = HexColor("#1f2937")
muted = HexColor("#5b6470")
line = HexColor("#d6dde8")


def draw_rule(y):
    pdf.setStrokeColor(line)
    pdf.setLineWidth(1)
    pdf.line(margin, y, width - margin, y)


def draw_heading(text, y):
    pdf.setFillColor(blue)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(margin, y, text.upper())


def draw_paragraph(text, y, font_name="Helvetica", font_size=11, color=ink, leading=16):
    pdf.setFillColor(color)
    pdf.setFont(font_name, font_size)
    max_width = width - (margin * 2)
    words = str(text or "").split()
    if not words:
        return y
    lines = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
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


def ensure_space(y, needed=90):
    if y > needed:
        return y
    pdf.showPage()
    return height - 56

project_name = brief.get("role") or brief.get("company") or brief.get("contact_name") or "Content Co-Op Project"
contact_line = " | ".join([part for part in [brief.get("contact_name"), brief.get("company"), brief.get("contact_email"), brief.get("phone")] if part])
summary_line = " | ".join([part for part in [brief.get("content_type"), brief.get("audience"), brief.get("tone"), brief.get("deadline")] if part])
constraints = brief.get("constraints") or "No additional constraints recorded."
key_messages = brief.get("key_messages") or "No core message provided."
references = brief.get("references") or "No reference material provided."
quote_total = quote.get("estimated_total")
quote_label = f"Estimated draft quote: \${quote_total:,.0f}" if isinstance(quote_total, (int, float)) else "Estimated draft quote pending"
quote_number = quote.get("quote_number")
quote_ref = f"Quote #{quote_number}" if quote_number else "Quote draft prepared"

pdf.setTitle(f"{project_name} Proposal Snapshot")
pdf.setAuthor("Content Co-Op")

pdf.setFillColor(navy)
pdf.setFont("Helvetica-Bold", 12)
pdf.drawString(margin, cursor, "CONTENT CO-OP")
cursor -= 18
pdf.setFont("Helvetica-Bold", 28)
pdf.drawString(margin, cursor, str(project_name))
cursor -= 20
pdf.setFillColor(muted)
pdf.setFont("Helvetica", 11)
pdf.drawString(margin, cursor, contact_line or "Creative brief intake")
cursor -= 18
pdf.drawString(margin, cursor, quote_ref)
cursor -= 20
draw_rule(cursor)
cursor -= 22

for title, body in [
    ("Project read", brief.get("objective") or "Goal not provided."),
    ("Core story", key_messages),
    ("Audience and placement", summary_line or "Audience and placement still need clarification."),
    ("Creative direction", references),
    ("Constraints", constraints),
    ("Recommended next step", f"Book time here: {booking_url}" if booking_url else "Book a strategy call with Bailey to finalize scope."),
]:
    cursor = ensure_space(cursor, 120)
    draw_heading(title, cursor)
    cursor -= 18
    cursor = draw_paragraph(body, cursor)
    cursor -= 10

cursor = ensure_space(cursor, 120)
draw_rule(cursor)
cursor -= 26
pdf.setFillColor(navy)
pdf.setFont("Helvetica-Bold", 18)
pdf.drawString(margin, cursor, quote_label)
cursor -= 18
pdf.setFillColor(muted)
pdf.setFont("Helvetica", 11)
pdf.drawString(margin, cursor, "This proposal snapshot is generated automatically from the public brief and should be reviewed in Root before external commitments.")
cursor -= 18
if booking_url:
    pdf.drawString(margin, cursor, booking_url)

pdf.showPage()
pdf.save()
encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
sys.stdout.write(json.dumps({"ok": True, "pdf_base64": encoded}))
`;

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

export async function renderCreativeBriefProposalPdf(payload: {
  brief: Record<string, unknown>;
  quote: Record<string, unknown>;
  bookingUrl: string;
}) {
  const stdout = await runPythonJson(PYTHON_PROPOSAL_RENDERER, {
    brief: payload.brief,
    quote: payload.quote,
    booking_url: payload.bookingUrl,
  });
  const parsed = JSON.parse(stdout) as { ok?: boolean; pdf_base64?: string };
  if (!parsed.ok || !parsed.pdf_base64) {
    throw new Error("proposal_pdf_render_failed");
  }
  return {
    buffer: Buffer.from(parsed.pdf_base64, "base64"),
    filename: `Proposal_${String(payload.quote.quote_number || payload.quote.id || "draft")}.pdf`,
  };
}
