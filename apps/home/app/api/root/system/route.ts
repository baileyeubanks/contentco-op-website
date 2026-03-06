import { NextResponse } from "next/server";
import { getRootRuntimeSnapshot } from "@/lib/root-system";

export async function GET() {
  return NextResponse.json(await getRootRuntimeSnapshot());
}
