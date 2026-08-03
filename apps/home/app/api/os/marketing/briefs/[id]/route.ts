import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getRootMarketingBriefDetail } from "@/lib/os-marketing";
import { resolveOsBrand } from "@/lib/os-brand";

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Props) {
  const { id } = await params;
  const headerStore = await headers();
  const brand = resolveOsBrand(headerStore.get("host"), headerStore.get("x-os-brand"));
  const detail = await getRootMarketingBriefDetail(brand.key, id);

  if (!detail) {
    return NextResponse.json({ error: "brief_not_found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
