import { NextResponse } from "next/server";
import { getRootFinance } from "@/lib/root-data";

export async function GET() {
  const result = await getRootFinance();
  if (result.error) {
    return NextResponse.json({ error: result.error, finance: [] }, { status: 500 });
  }
  return NextResponse.json(result);
}
