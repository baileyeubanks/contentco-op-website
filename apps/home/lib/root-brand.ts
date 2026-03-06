export type RootBrandKey = "acs" | "cc";

export type RootBrand = {
  key: RootBrandKey;
  appName: string;
  subtitle: string;
  domainLabel: string;
  accent: string;
  accentSoft: string;
  brandClassName: string;
  defaultBusinessUnit: "ACS" | "CC";
  loginHint: string;
};

const ACS_BRAND: RootBrand = {
  key: "acs",
  appName: "root",
  subtitle: "astro cleanings operations core",
  domainLabel: "astrocleanings.com/root",
  accent: "#2450a6",
  accentSoft: "rgba(36,80,166,0.14)",
  brandClassName: "root-brand-acs",
  defaultBusinessUnit: "ACS",
  loginHint: "Dispatch, jobs, approvals, invoices, client communication.",
};

const CC_BRAND: RootBrand = {
  key: "cc",
  appName: "root",
  subtitle: "content co-op operations core",
  domainLabel: "contentco-op.com/root",
  accent: "#4c8ef5",
  accentSoft: "rgba(76,142,245,0.14)",
  brandClassName: "root-brand-cc",
  defaultBusinessUnit: "CC",
  loginHint: "Briefs, proposals, delivery, finance, approvals, intelligence.",
};

export function resolveRootBrand(hostname?: string | null): RootBrand {
  const host = (hostname || "").toLowerCase();
  if (host.includes("astrocleanings")) return ACS_BRAND;
  return CC_BRAND;
}
