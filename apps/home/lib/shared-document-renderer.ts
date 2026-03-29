const RENDERER_BASE_URL_ALIASES = [
  "DOCUMENT_RENDERER_BASE_URL",
  "ACS_PUBLIC_BASE",
  "ROOT_PUBLIC_BASE",
  "CCO_HOME_PUBLIC_BASE",
];

function normalizeBaseUrl(value: string | undefined): string {
  return String(value || "").trim().replace(/\/+$/, "");
}

export function resolveDocumentRendererBaseUrl(): string {
  for (const key of RENDERER_BASE_URL_ALIASES) {
    const value = normalizeBaseUrl(process.env[key]);
    if (value) return value;
  }
  return "https://astrocleanings.com";
}

export function buildQuoteRendererUrl(quoteId: string, format: "pdf" | "html" | "json") {
  const baseUrl = resolveDocumentRendererBaseUrl();
  return `${baseUrl}/api/generateQuotePDF?type=quote&format=${format}&quote_id=${encodeURIComponent(quoteId)}`;
}
