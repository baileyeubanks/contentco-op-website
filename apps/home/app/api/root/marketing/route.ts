import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getRootMarketingSnapshot } from "@/lib/root-marketing";
import { resolveRootBrand } from "@/lib/root-brand";

export async function GET() {
  const headerStore = await headers();
  const brand = resolveRootBrand(headerStore.get("host"), headerStore.get("x-root-brand"));
  return NextResponse.json(await getRootMarketingSnapshot(brand.key));
}
