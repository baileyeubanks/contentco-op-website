import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

export async function POST(req: Request) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await req.json().catch(() => ({}));
  const required = ["script_type", "audience", "objective", "constraints", "key_points"];
  const missing = required.filter((key) => !payload[key]);
  if (missing.length) {
    return NextResponse.json({ error: "Missing required brief fields", missing }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("briefs")
    .insert({
      org_id: ORG_ID,
      script_type: payload.script_type,
      audience: payload.audience,
      objective: payload.objective,
      constraints: payload.constraints,
      key_points: payload.key_points,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create brief" }, { status: 500 });
  }

  return NextResponse.json(data);
}
