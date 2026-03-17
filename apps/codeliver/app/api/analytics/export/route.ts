import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { verifyProjectOwner } from "@/lib/server/codeliver-data";
import { buildReviewReportPdf } from "@/lib/server/review-report-pdf";

type AssetRow = {
  id: string;
  title: string;
  status: string;
  file_type: string;
  created_at: string;
  deleted_at?: string | null;
};

type CommentRow = {
  id: string;
  asset_id: string;
  author_name: string;
  author_email: string | null;
  body: string;
  status: string;
  timecode_seconds: number | null;
  created_at: string;
};

type ApprovalRow = {
  id: string;
  asset_id: string;
  assignee_email: string | null;
  role_label: string;
  status: string;
  decision_note: string | null;
  decided_at: string | null;
  created_at: string;
};

type VersionRow = {
  id: string;
  asset_id: string;
  version_number: number;
  is_current?: boolean | null;
  notes: string | null;
  created_at: string;
};

type InviteRow = {
  id: string;
  asset_id: string;
  permissions: string;
  view_count: number | null;
  expires_at: string | null;
  created_at: string;
};

export async function GET(req: Request) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("project_id");
  const format = (searchParams.get("format") || "pdf").toLowerCase();

  if (!projectId) {
    return NextResponse.json({ error: "project_id required" }, { status: 400 });
  }

  const access = await verifyProjectOwner(user.id, projectId);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const supabase = getSupabase();
  const { data: assets } = await supabase
    .from("assets")
    .select("id, title, status, file_type, created_at, deleted_at")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  const assetRows = (assets ?? []) as AssetRow[];
  const assetIds = assetRows.map((asset) => asset.id);

  const [commentsResult, approvalsResult, versionsResult, invitesResult] = await Promise.all([
    assetIds.length > 0
      ? supabase
          .from("comments")
          .select("id, asset_id, author_name, author_email, body, status, timecode_seconds, created_at")
          .in("asset_id", assetIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    assetIds.length > 0
      ? supabase
          .from("approvals")
          .select("id, asset_id, assignee_email, role_label, status, decision_note, decided_at, created_at")
          .in("asset_id", assetIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    assetIds.length > 0
      ? supabase
          .from("versions")
          .select("id, asset_id, version_number, is_current, notes, created_at")
          .in("asset_id", assetIds)
          .order("version_number", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    assetIds.length > 0
      ? supabase
          .from("review_invites")
          .select("id, asset_id, permissions, view_count, expires_at, created_at")
          .in("asset_id", assetIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (commentsResult.error) return NextResponse.json({ error: commentsResult.error.message }, { status: 500 });
  if (approvalsResult.error) return NextResponse.json({ error: approvalsResult.error.message }, { status: 500 });
  if (versionsResult.error) return NextResponse.json({ error: versionsResult.error.message }, { status: 500 });
  if (invitesResult.error) return NextResponse.json({ error: invitesResult.error.message }, { status: 500 });

  const comments = (commentsResult.data ?? []) as CommentRow[];
  const approvals = (approvalsResult.data ?? []) as ApprovalRow[];
  const versions = (versionsResult.data ?? []) as VersionRow[];
  const invites = (invitesResult.data ?? []) as InviteRow[];

  if (format === "json") {
    return new NextResponse(
      JSON.stringify(
        {
          project: { id: projectId, name: access.project.name },
          exported_at: new Date().toISOString(),
          assets: assetRows,
          comments,
          approvals,
          versions,
          share_links: invites,
        },
        null,
        2,
      ),
      {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${slugify(access.project.name)}_review-report.json"`,
        },
      },
    );
  }

  if (format === "csv") {
    const csv = toCsv(assetRows, comments, approvals, versions, invites);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${slugify(access.project.name)}_review-report.csv"`,
      },
    });
  }

  const primaryAsset = assetRows[0];
  const primaryVersions = versions
    .filter((version) => version.asset_id === primaryAsset?.id)
    .sort((left, right) => right.version_number - left.version_number);
  const primaryComments = comments.filter((comment) => comment.asset_id === primaryAsset?.id);
  const primaryApprovals = approvals.filter((approval) => approval.asset_id === primaryAsset?.id);
  const primaryInvites = invites.filter((invite) => invite.asset_id === primaryAsset?.id);

  const pdfBytes = await buildReviewReportPdf({
    project: {
      id: projectId,
      name: access.project.name,
    },
    asset: {
      id: primaryAsset?.id ?? "n/a",
      title: primaryAsset?.title ?? "No asset",
      file_type: primaryAsset?.file_type ?? "unknown",
      status: primaryAsset?.status ?? "draft",
      current_version_number:
        primaryVersions.find((version) => version.is_current)?.version_number ??
        primaryVersions[0]?.version_number ??
        null,
      latest_version_number: primaryVersions[0]?.version_number ?? null,
      share_views: primaryInvites.reduce((sum, invite) => sum + (invite.view_count ?? 0), 0),
    },
    versions: primaryVersions,
    comments: primaryComments,
    approvals: primaryApprovals,
    shareLinks: primaryInvites,
    exportedAt: new Date().toISOString(),
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${slugify(access.project.name)}_review-report.pdf"`,
    },
  });
}

function toCsv(
  assets: AssetRow[],
  comments: CommentRow[],
  approvals: ApprovalRow[],
  versions: VersionRow[],
  invites: InviteRow[],
) {
  const lines: string[] = [];

  lines.push("=== Assets ===");
  lines.push("ID,Title,Status,Type,Created");
  for (const asset of assets) {
    lines.push([
      asset.id,
      csvEscape(asset.title),
      asset.status,
      asset.file_type,
      asset.created_at,
    ].join(","));
  }

  lines.push("");
  lines.push("=== Versions ===");
  lines.push("ID,Asset ID,Version,Current,Created,Notes");
  for (const version of versions) {
    lines.push([
      version.id,
      version.asset_id,
      String(version.version_number),
      version.is_current ? "true" : "false",
      version.created_at,
      csvEscape(version.notes ?? ""),
    ].join(","));
  }

  lines.push("");
  lines.push("=== Comments ===");
  lines.push("ID,Asset ID,Author,Email,Status,Timecode,Created,Body");
  for (const comment of comments) {
    lines.push([
      comment.id,
      comment.asset_id,
      csvEscape(comment.author_name),
      comment.author_email ?? "",
      comment.status,
      comment.timecode_seconds == null ? "" : String(comment.timecode_seconds),
      comment.created_at,
      csvEscape(comment.body),
    ].join(","));
  }

  lines.push("");
  lines.push("=== Approvals ===");
  lines.push("ID,Asset ID,Reviewer,Role,Status,Decided At,Created,Decision Note");
  for (const approval of approvals) {
    lines.push([
      approval.id,
      approval.asset_id,
      approval.assignee_email ?? "",
      csvEscape(approval.role_label),
      approval.status,
      approval.decided_at ?? "",
      approval.created_at,
      csvEscape(approval.decision_note ?? ""),
    ].join(","));
  }

  lines.push("");
  lines.push("=== Share Links ===");
  lines.push("ID,Asset ID,Permissions,Views,Expires At,Created");
  for (const invite of invites) {
    lines.push([
      invite.id,
      invite.asset_id,
      invite.permissions,
      String(invite.view_count ?? 0),
      invite.expires_at ?? "",
      invite.created_at,
    ].join(","));
  }

  return lines.join("\n");
}

function csvEscape(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
