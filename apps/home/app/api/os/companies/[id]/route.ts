import { NextResponse } from "next/server";
import { getCompanyById, updateCompany } from "@/lib/root-contacts-engine";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getCompanyById(id);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  if (!result.company) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(result);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const result = await updateCompany(id, body);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result);
}
