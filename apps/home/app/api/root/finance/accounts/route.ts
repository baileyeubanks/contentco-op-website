import { NextResponse } from "next/server";
import { getRootBusinessScopeFromRequest } from "@/lib/root-request-scope";
import { getRootFinanceWorkspace } from "@/lib/root-finance-workspace";

export async function GET(req: Request) {
  const result = await getRootFinanceWorkspace(getRootBusinessScopeFromRequest(req));
  return NextResponse.json({ accounts: result.accounts, error: result.error });
}
