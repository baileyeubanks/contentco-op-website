import { NextResponse } from "next/server";
import { getRootBusinessScopeFromRequest } from "@/lib/root-request-scope";
import { getCompanies, createCompany } from "@/lib/root-contacts-engine";

export async function GET(req: Request) {
  const scope = getRootBusinessScopeFromRequest(req);
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") || 100), 500);

  const result = await getCompanies(scope, limit);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const result = await createCompany(body);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result, { status: 201 });
}
