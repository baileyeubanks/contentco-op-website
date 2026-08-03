import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getRootMarketingSnapshot } from "@/lib/os-marketing";
import { resolveOsBrand } from "@/lib/os-brand";

export async function GET() {
  const headerStore = await headers();
  const brand = resolveOsBrand(headerStore.get("host"), headerStore.get("x-os-brand"));
  return NextResponse.json(await getRootMarketingSnapshot(brand.key));
}
