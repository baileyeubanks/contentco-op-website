import { type NextRequest } from "next/server";
import { getAsset, headAsset } from "@/lib/asset-route";

export const runtime = "nodejs";

export async function HEAD(_request: NextRequest, context: { params: Promise<{ segments: string[] }> }) {
  const { segments } = await context.params;
  return headAsset("content", ...segments);
}

export async function GET(request: NextRequest, context: { params: Promise<{ segments: string[] }> }) {
  const { segments } = await context.params;
  return getAsset(request, "content", ...segments);
}
