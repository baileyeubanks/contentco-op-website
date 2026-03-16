import { NextResponse } from "next/server";
import { getRootBusinessScopeFromRequest } from "@/lib/root-request-scope";
import { createProjectFromBrief } from "@/lib/root-projects-engine";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = getRootBusinessScopeFromRequest(req);

  const result = await createProjectFromBrief(id, scope || "CC");
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result, { status: 201 });
}
