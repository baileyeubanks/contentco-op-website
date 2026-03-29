import { resolveRootBrand } from "@/lib/root-brand";

export type RootBusinessScope = "ACS" | "CC" | null;

function readHost(headers: Headers) {
  return headers.get("x-forwarded-host") || headers.get("host") || "";
}

export function getRootBusinessScopeFromHeaders(headers: Headers): RootBusinessScope {
  const host = readHost(headers);
  if (!host) return null;
  return resolveRootBrand(host).defaultBusinessUnit;
}

export function getRootBusinessScopeFromRequest(request: Request): RootBusinessScope {
  return getRootBusinessScopeFromHeaders(request.headers);
}
