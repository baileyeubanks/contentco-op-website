import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getAccountAnalytics } from "@/lib/server/codeliver-data";

export async function GET() {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const snapshot = await getAccountAnalytics(user.id);
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load account analytics" },
      { status: 500 },
    );
  }
}
