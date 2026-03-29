import { NextResponse } from "next/server";
import { getRootContacts } from "@/lib/root-data";

export async function GET() {
  const result = await getRootContacts();
  if (result.error) {
    return NextResponse.json({ error: result.error, contacts: [] }, { status: 500 });
  }
  return NextResponse.json(result);
}
