import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT_DIR = "/Users/baileyeubanks/Desktop/Projects/root";
const ROOT_TSX_BIN = "/Users/baileyeubanks/Desktop/Projects/root/node_modules/.bin/tsx";
const ROOT_RENDER_SCRIPT = "/Users/baileyeubanks/Desktop/Projects/root/scripts/render-live-document.ts";

type RenderResult =
  | { ok: true; html: string }
  | { ok: true; pdfPath: string }
  | { ok: false; error: string };

async function runRootDocumentCommand(kind: "invoice" | "quote", id: string, format: "html" | "pdf") {
  const env = {
    ...process.env,
    ROOT_STORE_BACKEND: process.env.ROOT_STORE_BACKEND || "supabase",
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    SUPABASE_SERVICE_ROLE_KEY:
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "",
    SUPABASE_SERVICE_KEY:
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  };

  const { stdout } = await execFileAsync(
    ROOT_TSX_BIN,
    [ROOT_RENDER_SCRIPT, "--kind", kind, "--id", id, "--format", format],
    {
      cwd: ROOT_DIR,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      env,
    },
  );
  const parsed = JSON.parse(stdout.trim()) as RenderResult;
  if (!parsed.ok) {
    throw new Error(parsed.error || "root_document_authority_failed");
  }
  return parsed;
}

export async function renderCanonicalInvoiceHtml(invoiceId: string) {
  const result = await runRootDocumentCommand("invoice", invoiceId, "html");
  if (!("html" in result)) throw new Error("invoice_html_missing");
  return result.html;
}

export async function renderCanonicalQuoteHtml(quoteId: string) {
  const result = await runRootDocumentCommand("quote", quoteId, "html");
  if (!("html" in result)) throw new Error("quote_html_missing");
  return result.html;
}

export async function readCanonicalInvoicePdf(invoiceId: string) {
  const result = await runRootDocumentCommand("invoice", invoiceId, "pdf");
  if (!("pdfPath" in result)) throw new Error("invoice_pdf_missing");
  return readFile(result.pdfPath);
}

export async function readCanonicalQuotePdf(quoteId: string) {
  const result = await runRootDocumentCommand("quote", quoteId, "pdf");
  if (!("pdfPath" in result)) throw new Error("quote_pdf_missing");
  return readFile(result.pdfPath);
}
