import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

async function verifyToken(briefId: string, token: string | null) {
  if (!token) return false;
  const { data } = await supabase
    .from("creative_briefs")
    .select("id")
    .eq("id", briefId)
    .eq("access_token", token)
    .single();
  return !!data;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!(await verifyToken(id, token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("brief_files")
    .select("*")
    .eq("brief_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch files" }, { status: 500 });
  }

  return NextResponse.json({ files: data ?? [] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!(await verifyToken(id, token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File exceeds 50 MB limit" }, { status: 413 });
  }

  const storagePath = `briefs/${id}/${Date.now()}_${file.name}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from("brief-files")
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }

  // Save metadata
  const { data, error: dbError } = await supabase
    .from("brief_files")
    .insert({
      brief_id: id,
      file_name: file.name,
      file_size: file.size,
      content_type: file.type,
      storage_path: storagePath,
      uploaded_by: "client",
    })
    .select()
    .single();

  if (dbError) {
    console.error("File metadata error:", dbError);
    return NextResponse.json({ error: "Failed to save file metadata" }, { status: 500 });
  }

  return NextResponse.json({ file: data });
}
