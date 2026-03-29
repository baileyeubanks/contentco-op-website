import { type NextRequest } from "next/server";
import { getAsset, headAsset } from "@/lib/asset-route";

export const runtime = "nodejs";

export async function HEAD(_request: NextRequest, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  return headAsset("logos", filename);
}

export async function GET(request: NextRequest, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  return getAsset(request, "logos", filename);
}

