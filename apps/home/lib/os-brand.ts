export type OsBrandKey = "acs" | "cc";

export type OsBrand = {
  key: OsBrandKey;
  appName: string;
  subtitle: string;
  domainLabel: string;
  accent: string;
  accentSoft: string;
  brandClassName: string;
  defaultBusinessUnit: "ACS" | "CC";
  loginHint: string;
};

function normalizeBrandOverride(value?: string | null): OsBrandKey | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "acs" || normalized === "astro" || normalized === "astrocleanings") return "acs";
  if (normalized === "cc" || normalized === "contentco-op" || normalized === "contentco_op") return "cc";
  return null;
}

const ACS_BRAND: OsBrand = {
  key: "acs",
  appName: "root",
  subtitle: "astro cleanings operations core",
  domainLabel: "astrocleanings.com/root",
  accent: "#4ade80",
  accentSoft: "rgba(74,222,128,0.14)",
  brandClassName: "os-brand-acs",
  defaultBusinessUnit: "ACS",
  loginHint: "Dispatch, jobs, approvals, invoices, client communication.",
};

const CC_BRAND: OsBrand = {
  key: "cc",
  appName: "root",
  subtitle: "content co-op operations core",
  domainLabel: "contentco-op.com/root",
  accent: "#4ade80",
  accentSoft: "rgba(74,222,128,0.14)",
  brandClassName: "os-brand-cc",
  defaultBusinessUnit: "CC",
  loginHint: "Briefs, proposals, delivery, finance, approvals, intelligence.",
};

export function resolveOsBrand(hostname?: string | null, brandOverride?: string | null): OsBrand {
  const forced = normalizeBrandOverride(brandOverride);
  if (forced === "acs") return ACS_BRAND;
  if (forced === "cc") return CC_BRAND;
  const host = (hostname || "").toLowerCase();
  if (host.includes("astrocleanings")) return ACS_BRAND;
  return CC_BRAND;
}
