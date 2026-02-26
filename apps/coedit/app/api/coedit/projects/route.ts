import { NextResponse } from "next/server";
import { requireInviteSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

export async function GET() {
  const session = await requireInviteSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("review_assets")
    .select("project_name, status, updated_at")
    .eq("org_id", ORG_ID);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }

  // Group by project_name
  const map = new Map<string, { name: string; asset_count: number; last_updated: string; statuses: string[] }>();
  for (const row of data ?? []) {
    const existing = map.get(row.project_name);
    if (existing) {
      existing.asset_count++;
      if (row.updated_at > existing.last_updated) existing.last_updated = row.updated_at;
      existing.statuses.push(row.status);
    } else {
      map.set(row.project_name, {
        name: row.project_name,
        asset_count: 1,
        last_updated: row.updated_at,
        statuses: [row.status],
      });
    }
  }

  const items = Array.from(map.values())
    .sort((a, b) => b.last_updated.localeCompare(a.last_updated))
    .map(({ name, asset_count, last_updated, statuses }) => ({
      id: name,
      name,
      asset_count,
      last_updated,
      status: statuses.includes("in_review") ? "in_review" : statuses[0] ?? "draft",
    }));

  return NextResponse.json({ items });
}
