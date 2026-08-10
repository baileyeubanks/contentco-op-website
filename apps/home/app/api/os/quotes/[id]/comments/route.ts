import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.quotes.comments.read",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["quote_read"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const { id } = await context.params;
  const sb = getSupabase();

  const { data, error } = await sb
    .from("quote_comments")
    .select("id, author, body, is_client, created_at")
    .eq("quote_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ comments: [] });
  return NextResponse.json({ comments: data ?? [] });
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.quotes.comments.write",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["quote_manage"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const { id } = await context.params;
  const sb = getSupabase();

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { author, body: text, is_client = false } = body as Record<string, string | boolean>;

  if (!text || String(text).trim() === "") {
    return NextResponse.json({ error: "body required" }, { status: 400 });
  }

  const { data, error } = await sb
    .from("quote_comments")
    .insert({ quote_id: id, author: author || "Team", body: text, is_client })
    .select("id, author, body, is_client, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comment: data });
}
