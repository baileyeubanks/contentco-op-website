import { NextResponse } from "next/server";
import { getRootContactDossier } from "@/lib/root-data";
import { getRootBusinessScopeFromRequest } from "@/lib/root-request-scope";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await getRootContactDossier(id, getRootBusinessScopeFromRequest(req));
  if (result.error && !result.dossier) {
    return NextResponse.json({ error: result.error, dossier: null }, { status: result.error === "Contact not found" ? 404 : 500 });
  }
  return NextResponse.json(result);
}
