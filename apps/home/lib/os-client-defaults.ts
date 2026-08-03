export type BizFilter = "ALL" | "ACS" | "CC";

import { resolveRootBrand } from "@/lib/root-brand";

export function getAllowedBizFiltersForHost(hostname?: string | null): BizFilter[] {
  if (!hostname) return ["ALL", "ACS", "CC"];
  const host = hostname.toLowerCase();
  if (host.includes("localhost") || host.includes("127.0.0.1")) return ["ALL", "ACS", "CC"];
  const brand = resolveRootBrand(host);
  return brand.defaultBusinessUnit === "ACS" ? ["ACS"] : ["CC"];
}

function readClientHost() {
  if (typeof window === "undefined") return null;
  return window.location.hostname.toLowerCase();
}

export function getAllowedBizFilters(): BizFilter[] {
  return getAllowedBizFiltersForHost(readClientHost());
}

export function getDefaultBizFilter(hostname?: string | null): BizFilter {
  const allowed = hostname ? getAllowedBizFiltersForHost(hostname) : getAllowedBizFilters();
  if (allowed.includes("CC")) return "CC";
  if (allowed.includes("ACS")) return "ACS";
  return "ALL";
}

export function coerceBizFilter(value: BizFilter): BizFilter {
  const allowed = getAllowedBizFilters();
  return allowed.includes(value) ? value : getDefaultBizFilter(readClientHost());
}
