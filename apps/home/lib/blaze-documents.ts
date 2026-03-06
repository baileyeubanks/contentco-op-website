/**
 * Mac Mini PDF renderer client.
 *
 * Proxies to the FastAPI document engine at BLAZE_API_URL.
 * Two operations:
 *   - renderQuotePdf  → POST /api/documents/render  → PDF binary (Buffer)
 *   - previewQuotePdf → POST /api/documents/preview → { pdf_base64, total, phase_count, pdf_size_bytes }
 */

const BLAZE_ENV_ALIASES = ["BLAZE_API_URL", "BLAZE_API_BASE_URL"] as const;
const DEFAULT_TIMEOUT_MS = 12000;

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

export async function renderQuotePdf(
  payload: RenderRequest,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<RenderResult> {
  const baseUrl = resolveBlazeBaseUrl();
  if (!baseUrl) {
    return { ok: false, statusCode: null, latencyMs: null, error: "missing_blaze_api_url" };
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
