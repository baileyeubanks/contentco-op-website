import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getRootMarketingBriefDetail } from "@/lib/root-marketing";
import { resolveRootBrand } from "@/lib/root-brand";

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Props) {
  const { id } = await params;
  const headerStore = await headers();
  const brand = resolveRootBrand(headerStore.get("host"), headerStore.get("x-root-brand"));
  const detail = await getRootMarketingBriefDetail(brand.key, id);

  if (!detail) {
    return NextResponse.json({ error: "brief_not_found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
