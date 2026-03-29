import { NextResponse } from "next/server";
import { getPlatformManifest } from "@/lib/platform-manifest";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getPlatformManifest());
}
