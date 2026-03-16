import { NextResponse } from "next/server";
import { getRootBusinessScopeFromRequest } from "@/lib/root-request-scope";
import { getProjects, createProject } from "@/lib/root-projects-engine";

export async function GET(req: Request) {
  const scope = getRootBusinessScopeFromRequest(req);
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;
  const limit = Math.min(Number(searchParams.get("limit") || 100), 500);

  const result = await getProjects(scope, { status, limit });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const result = await createProject(body);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result, { status: 201 });
}
