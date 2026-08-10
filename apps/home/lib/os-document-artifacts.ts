import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getSupabase } from "@/lib/supabase";

const ARTIFACT_ROOT = path.join(process.cwd(), ".generated", "commercial-artifacts");

type ArtifactDocumentType = "estimate" | "invoice";

type CommercialArtifactPayload = {
  documentType: ArtifactDocumentType;
  documentNumber: string;
  businessUnit: "CC" | "ACS";
  issueDate: string;
  dueDate?: string | null;
  title: string;
  customer: {
    name: string | null;
    email?: string | null;
    company?: string | null;
  };
  lineItems: Array<{
    description: string;
    quantity: number;
    unit: string;
    unit_price_cents: number;
    line_total_cents: number;
  }>;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  notes?: string[];
  paymentTerms?: string | null;
  payload?: Record<string, unknown>;
};

const PYTHON_RENDERER = [
  "import base64, io, json, sys",
  "from reportlab.lib.pagesizes import letter",
  "from reportlab.pdfgen import canvas",
  "from docx import Document",
  "",
  "data = json.loads(sys.stdin.read())",
  "",
  "def money(cents):",
  "    return f\"${cents / 100:,.2f}\"",
  "",
  "pdf_buffer = io.BytesIO()",
  "pdf = canvas.Canvas(pdf_buffer, pagesize=letter)",
  "width, height = letter",
  "y = height - 54",
  "pdf.setFont(\"Helvetica-Bold\", 11)",
  "pdf.drawString(48, y, data['businessUnit'])",
  "y -= 22",
  "pdf.setFont(\"Helvetica-Bold\", 24)",
  "pdf.drawString(48, y, data['title'])",
  "y -= 18",
  "pdf.setFont(\"Helvetica\", 11)",
  "pdf.drawString(48, y, f\"{data['documentType'].upper()} {data['documentNumber']}\")",
  "y -= 18",
  "pdf.drawString(48, y, f\"Issue date: {data['issueDate']}\")",
  "if data.get('dueDate'):",
  "    y -= 14",
  "    pdf.drawString(48, y, f\"Due date: {data['dueDate']}\")",
  "y -= 24",
  "customer = data.get('customer', {})",
  "pdf.setFont('Helvetica-Bold', 12)",
  "pdf.drawString(48, y, 'Bill To')",
  "y -= 14",
  "pdf.setFont('Helvetica', 11)",
  "for line in [customer.get('name'), customer.get('company'), customer.get('email')]:",
  "    if line:",
  "        pdf.drawString(48, y, str(line))",
  "        y -= 13",
  "y -= 10",
  "pdf.setFont('Helvetica-Bold', 11)",
  "pdf.drawString(48, y, 'Scope')",
  "y -= 16",
  "pdf.setFont('Helvetica', 10)",
  "for item in data.get('lineItems', []):",
  "    text = f\"{item['description']} | {item['quantity']} {item['unit']} | {money(item['line_total_cents'])}\"",
  "    pdf.drawString(52, y, text[:100])",
  "    y -= 12",
  "    if y < 80:",
  "        pdf.showPage()",
  "        y = height - 54",
  "        pdf.setFont('Helvetica', 10)",
  "y -= 10",
  "for label, cents in [('Subtotal', data['subtotalCents']), ('Tax', data['taxCents']), ('Total', data['totalCents'])]:",
  "    pdf.drawRightString(width - 48, y, f\"{label}: {money(cents)}\")",
  "    y -= 14",
  "if data.get('paymentTerms'):",
  "    y -= 8",
  "    pdf.drawString(48, y, f\"Payment terms: {data['paymentTerms']}\")",
  "y -= 16",
  "for note in data.get('notes', []):",
  "    pdf.drawString(48, y, str(note)[:100])",
  "    y -= 12",
  "    if y < 60:",
  "        pdf.showPage()",
  "        y = height - 54",
  "        pdf.setFont('Helvetica', 10)",
  "pdf.save()",
  "",
  "doc = Document()",
  "doc.add_heading(data['title'], 0)",
  "doc.add_paragraph(f\"{data['documentType'].title()} {data['documentNumber']}\")",
  "doc.add_paragraph(f\"Issue date: {data['issueDate']}\")",
  "if data.get('dueDate'):",
  "    doc.add_paragraph(f\"Due date: {data['dueDate']}\")",
  "doc.add_heading('Bill To', level=1)",
  "for line in [customer.get('name'), customer.get('company'), customer.get('email')]:",
  "    if line:",
  "        doc.add_paragraph(str(line))",
  "table = doc.add_table(rows=1, cols=4)",
  "hdr = table.rows[0].cells",
  "hdr[0].text = 'Description'",
  "hdr[1].text = 'Qty'",
  "hdr[2].text = 'Unit Price'",
  "hdr[3].text = 'Line Total'",
  "for item in data.get('lineItems', []):",
  "    row = table.add_row().cells",
  "    row[0].text = str(item['description'])",
  "    row[1].text = str(item['quantity'])",
  "    row[2].text = money(item['unit_price_cents'])",
  "    row[3].text = money(item['line_total_cents'])",
  "doc.add_paragraph(f\"Subtotal: {money(data['subtotalCents'])}\")",
  "doc.add_paragraph(f\"Tax: {money(data['taxCents'])}\")",
  "doc.add_paragraph(f\"Total: {money(data['totalCents'])}\")",
  "if data.get('paymentTerms'):",
  "    doc.add_paragraph(f\"Payment terms: {data['paymentTerms']}\")",
  "for note in data.get('notes', []):",
  "    doc.add_paragraph(str(note))",
  "docx_buffer = io.BytesIO()",
  "doc.save(docx_buffer)",
  "",
  "sys.stdout.write(json.dumps({",
  "    'ok': True,",
  "    'pdf_base64': base64.b64encode(pdf_buffer.getvalue()).decode('ascii'),",
  "    'docx_base64': base64.b64encode(docx_buffer.getvalue()).decode('ascii')",
  "}))",
].join("\n");

async function renderArtifactBuffers(payload: CommercialArtifactPayload) {
  const child = spawn("python3", ["-c", PYTHON_RENDERER], {
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
  child.stdin.write(JSON.stringify(payload));
  child.stdin.end();

  const exitCode: number = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  if (exitCode !== 0) {
    throw new Error(stderr || "commercial_document_render_failed");
  }

  const parsed = JSON.parse(stdout) as { ok?: boolean; pdf_base64?: string; docx_base64?: string };
  if (!parsed.ok || !parsed.pdf_base64 || !parsed.docx_base64) {
    throw new Error("commercial_document_render_failed");
  }

  return {
    pdfBuffer: Buffer.from(parsed.pdf_base64, "base64"),
    docxBuffer: Buffer.from(parsed.docx_base64, "base64"),
  };
}

export type { CommercialArtifactPayload };

/** Render a PDF buffer from a payload (used to render frozen estimate snapshots). */
export async function renderDocumentPdfBuffer(payload: CommercialArtifactPayload) {
  const buffers = await renderArtifactBuffers(payload);
  return buffers.pdfBuffer;
}

export async function createDocumentArtifacts(input: {
  sourceDocumentId: string;
  businessUnit: "CC" | "ACS";
  documentType: ArtifactDocumentType;
  versionLabel: string;
  payload: CommercialArtifactPayload;
}) {
  await mkdir(ARTIFACT_ROOT, { recursive: true });
  const buffers = await renderArtifactBuffers(input.payload);
  const baseName = `${input.documentType}-${input.versionLabel}-${input.sourceDocumentId.slice(0, 8)}`;
  const pdfPath = path.join(ARTIFACT_ROOT, `${baseName}.pdf`);
  const docxPath = path.join(ARTIFACT_ROOT, `${baseName}.docx`);
  await Promise.all([
    writeFile(pdfPath, buffers.pdfBuffer),
    writeFile(docxPath, buffers.docxBuffer),
  ]);

  const sb = getSupabase();
  const artifacts = buildDocumentArtifactRows({
    sourceDocumentId: input.sourceDocumentId,
    businessUnit: input.businessUnit,
    documentType: input.documentType,
    versionLabel: input.versionLabel,
    payload: input.payload,
    pdfPath,
    docxPath,
  });

  const { data, error } = await sb.from("document_artifacts").insert(artifacts).select("*");
  if (error) throw new Error(error.message);

  return {
    artifacts: data || [],
    pdfPath,
    docxPath,
  };
}

export function buildDocumentArtifactRows(input: {
  sourceDocumentId: string;
  businessUnit: "CC" | "ACS";
  documentType: ArtifactDocumentType;
  versionLabel: string;
  payload: CommercialArtifactPayload;
  pdfPath: string;
  docxPath: string;
}) {
  const sharedPayload = {
    document_number: input.payload.documentNumber,
    issue_date: input.payload.issueDate,
    due_date: input.payload.dueDate || null,
    totals: {
      subtotal_cents: input.payload.subtotalCents,
      tax_cents: input.payload.taxCents,
      total_cents: input.payload.totalCents,
    },
    source_payload: input.payload.payload || {},
  };

  return [
    {
      source_document_id: input.sourceDocumentId,
      business_unit: input.businessUnit,
      document_type: `${input.documentType}_pdf`,
      version_label: input.versionLabel,
      storage_path: input.pdfPath,
      render_status: "rendered",
      outcome_status: "ready",
      payload: { ...sharedPayload, format: "pdf" },
    },
    {
      source_document_id: input.sourceDocumentId,
      business_unit: input.businessUnit,
      document_type: `${input.documentType}_docx`,
      version_label: input.versionLabel,
      storage_path: input.docxPath,
      render_status: "rendered",
      outcome_status: "ready",
      payload: { ...sharedPayload, format: "docx" },
    },
  ];
}
