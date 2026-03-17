import crypto from "crypto";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getBaseUrl, sendEmail, emailTemplates } from "@/lib/email";
import { getSupabase } from "@/lib/supabase";
import { verifyAssetOwner } from "@/lib/server/codeliver-data";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await verifyAssetOwner(user.id, id);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { data, error } = await getSupabase()
    .from("review_invites")
    .select("*")
    .eq("asset_id", id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await verifyAssetOwner(user.id, id);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body = await req.json().catch(() => ({}));
  const token = crypto.randomBytes(16).toString("hex");
  const expiresAt = body.expires_at
    ? new Date(body.expires_at).toISOString()
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const passwordHash = body.password
    ? crypto.createHash("sha256").update(String(body.password)).digest("hex")
    : null;

  const { data, error } = await getSupabase()
    .from("review_invites")
    .insert({
      asset_id: id,
      token,
      password_hash: passwordHash,
      reviewer_name: body.reviewer_name || null,
      reviewer_email: body.reviewer_email || null,
      permissions: body.permissions || "comment",
      expires_at: expiresAt,
      created_by: user.id,
      watermark_enabled: body.watermark_enabled ?? false,
      watermark_text: body.watermark_text || null,
      download_enabled: body.download_enabled ?? true,
      max_views: body.max_views ?? null,
      view_count: 0,
      last_viewed_at: null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await getSupabase().from("activity_log").insert({
    project_id: access.project.id,
    asset_id: id,
    actor_id: user.id,
    actor_name: user.email ?? "Unknown",
    action: "share_link_created",
    details: {
      asset_title: access.asset.title,
      permissions: data.permissions,
      download_enabled: data.download_enabled,
      max_views: data.max_views,
    },
  });

  if (body.reviewer_email && data) {
    const shareLink = `${getBaseUrl()}/review/${data.token}`;
    const emailPayload = emailTemplates.shareInvite(
      body.reviewer_email,
      access.asset.title,
      shareLink,
    );
    await sendEmail({ to: body.reviewer_email, ...emailPayload });
  }

  return NextResponse.json({
    token: data.token,
    invite: data,
    url: `${getBaseUrl()}/review/${data.token}`,
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await verifyAssetOwner(user.id, id);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body = await req.json().catch(() => ({}));
  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await getSupabase()
    .from("review_invites")
    .delete()
    .eq("id", body.id)
    .eq("asset_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
