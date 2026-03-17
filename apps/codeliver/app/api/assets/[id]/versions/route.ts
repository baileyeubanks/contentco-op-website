import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

async function verifyAssetAccess(assetId: string, userId: string) {
  const { data: asset } = await getSupabase()
    .from("assets")
    .select("project_id")
    .eq("id", assetId)
    .single();
  if (!asset) return { allowed: false, status: 404, error: "Asset not found" } as const;

  const { data: project } = await getSupabase()
    .from("projects")
    .select("owner_id")
    .eq("id", asset.project_id)
    .single();
  if (!project || project.owner_id !== userId) {
    return { allowed: false, status: 403, error: "Forbidden" } as const;
  }
  return { allowed: true } as const;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await verifyAssetAccess(id, user.id);
  if (!access.allowed) return NextResponse.json({ error: access.error }, { status: access.status });

  const { data, error } = await getSupabase()
    .from("versions")
    .select("*")
    .eq("asset_id", id)
    .order("version_number", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const access = await verifyAssetAccess(id, user.id);
  if (!access.allowed) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await req.json();

  // Get next version number
  const { data: existing } = await getSupabase()
    .from("versions")
    .select("version_number")
    .eq("asset_id", id)
    .order("version_number", { ascending: false })
    .limit(1);

  const nextVersion = (existing?.[0]?.version_number ?? 0) + 1;

  await getSupabase().from("versions").update({ is_current: false }).eq("asset_id", id);

  const { data, error } = await getSupabase()
    .from("versions")
    .insert({
      asset_id: id,
      version_number: nextVersion,
      file_url: body.file_url,
      file_size: body.file_size || null,
      thumbnail_url: body.thumbnail_url || null,
      duration_seconds: body.duration_seconds || null,
      resolution: body.resolution || null,
      is_current: true,
      notes: body.notes || null,
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update asset file_url to latest version
  await getSupabase()
    .from("assets")
    .update({
      file_url: body.file_url,
      thumbnail_url: body.thumbnail_url || null,
      duration_seconds: body.duration_seconds || null,
      file_size: body.file_size || null,
      updated_at: new Date().toISOString(),
      status: body.status || "in_review",
    })
    .eq("id", id);

  const { data: asset } = await getSupabase()
    .from("assets")
    .select("project_id, title")
    .eq("id", id)
    .single();

  if (asset) {
    await getSupabase().from("activity_log").insert({
      project_id: asset.project_id,
      asset_id: id,
      actor_id: user.id,
      actor_name: user.email ?? "Unknown",
      action: "version_uploaded",
      details: { asset_title: asset.title, version_number: nextVersion },
    });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await verifyAssetAccess(id, user.id);
  if (!access.allowed) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await req.json();
  if (!body.version_id) {
    return NextResponse.json({ error: "version_id required" }, { status: 400 });
  }

  const supabase = getSupabase();
  await supabase.from("versions").update({ is_current: false }).eq("asset_id", id);

  const { data: version, error } = await supabase
    .from("versions")
    .update({ is_current: true })
    .eq("id", body.version_id)
    .eq("asset_id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from("assets")
    .update({
      file_url: version.file_url,
      thumbnail_url: version.thumbnail_url || null,
      duration_seconds: version.duration_seconds || null,
      file_size: version.file_size || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  return NextResponse.json({ version });
}
