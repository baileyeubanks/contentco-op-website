import { NextResponse } from "next/server";
import { getContactTimeline } from "@/lib/root-contacts-engine";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") || 50), 200);

  const result = await getContactTimeline(id, limit);
  return NextResponse.json(result);
}
