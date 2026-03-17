import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { getEnrichedAssetsForOwner, verifyProjectOwner } from "@/lib/server/codeliver-data";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await verifyProjectOwner(user.id, id);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const { assets } = await getEnrichedAssetsForOwner(user.id, { projectId: id });
    return NextResponse.json({ items: assets });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load project assets" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const access = await verifyProjectOwner(user.id, id);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { data, error } = await getSupabase()
    .from("assets")
    .insert({
      project_id: id,
      title: body.title,
      file_type: body.file_type || "video",
      file_url: body.file_url || null,
      thumbnail_url: body.thumbnail_url || null,
      file_size: body.file_size || null,
      duration_seconds: body.duration_seconds || null,
      folder_id: body.folder_id || null,
      status: body.status || "draft",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await getSupabase()
    .from("versions")
    .insert({
      asset_id: data.id,
      version_number: 1,
      file_url: body.file_url || null,
      file_size: body.file_size || null,
      thumbnail_url: body.thumbnail_url || null,
      duration_seconds: body.duration_seconds || null,
      resolution: body.resolution || null,
      is_current: true,
      notes: body.version_notes || "Initial upload",
      uploaded_by: user.id,
    });

  // Log activity
  await getSupabase().from("activity_log").insert({
    project_id: id,
    asset_id: data.id,
    actor_id: user.id,
    actor_name: user.email,
    action: "uploaded_asset",
    details: { asset_title: data.title },
  });

  return NextResponse.json(data, { status: 201 });
}
