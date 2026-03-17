import { getSupabase } from "@/lib/supabase";

type FolderRecord = {
  id: string;
  name: string;
  project_id: string;
};

type TagRecord = {
  id: string;
  project_id: string;
  name: string;
  color: string;
};

type AssetTagRecord = {
  asset_id: string;
  tag_id: string;
};

type AssetRecord = {
  id: string;
  project_id: string;
  folder_id: string | null;
  title: string;
  file_type: string;
  file_url: string | null;
  thumbnail_url: string | null;
  status: string;
  file_size: number | null;
  duration_seconds: number | null;
  updated_at: string;
  created_at: string;
  deleted_at?: string | null;
};

type VersionRecord = {
  id: string;
  asset_id: string;
  version_number: number;
  is_current?: boolean | null;
  created_at: string;
};

type CommentRecord = {
  asset_id: string;
  status: string;
};

type ApprovalRecord = {
  asset_id: string;
  status: string;
};

type InviteRecord = {
  id: string;
  asset_id: string;
  view_count: number | null;
  last_viewed_at: string | null;
  created_at: string;
  permissions: string;
  expires_at: string | null;
};

type ProjectRecord = {
  id: string;
  name: string;
  description: string | null;
  updated_at: string;
  created_at: string;
  owner_id: string;
};

export type EnrichedAsset = AssetRecord & {
  project_name: string;
  project_updated_at: string;
  folder_name: string | null;
  tags: TagRecord[];
  comment_count: number;
  open_comment_count: number;
  resolved_comment_count: number;
  approval_count: number;
  approved_count: number;
  pending_approval_count: number;
  latest_version_number: number;
  current_version_id: string | null;
  current_version_number: number | null;
  share_views: number;
  last_shared_at: string | null;
  last_viewed_at: string | null;
  latest_share_permission: string | null;
};

export type AccountAnalyticsSnapshot = {
  totals: {
    projects: number;
    assets: number;
    archived_assets: number;
    active_reviews: number;
    approved_assets: number;
    open_comments: number;
    resolved_comments: number;
    share_views: number;
  };
  trends: {
    comments_per_day: Array<{ date: string; count: number }>;
    approvals_per_day: Array<{ date: string; count: number }>;
  };
  top_assets: Array<{
    id: string;
    title: string;
    project_name: string;
    share_views: number;
    open_comment_count: number;
    approval_count: number;
    pending_approval_count: number;
    current_version_number: number | null;
    status: string;
  }>;
  top_projects: Array<{
    id: string;
    name: string;
    asset_count: number;
    active_reviews: number;
    open_comments: number;
    share_views: number;
    updated_at: string;
  }>;
};

export async function verifyProjectOwner(userId: string, projectId: string) {
  const { data, error } = await getSupabase()
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("owner_id", userId)
    .single<ProjectRecord>();

  if (error || !data) {
    return { allowed: false, status: 404, error: "Project not found" } as const;
  }

  return { allowed: true, project: data } as const;
}

export async function verifyAssetOwner(userId: string, assetId: string) {
  const { data: asset, error } = await getSupabase()
    .from("assets")
    .select("id, project_id, title")
    .eq("id", assetId)
    .single<{ id: string; project_id: string; title: string }>();

  if (error || !asset) {
    return { allowed: false, status: 404, error: "Asset not found" } as const;
  }

  const projectAccess = await verifyProjectOwner(userId, asset.project_id);
  if (!projectAccess.allowed) {
    return { allowed: false, status: 403, error: "Forbidden" } as const;
  }

  return { allowed: true, asset, project: projectAccess.project } as const;
}

export async function getOwnedProjects(userId: string) {
  const { data, error } = await getSupabase()
    .from("projects")
    .select("*")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ProjectRecord[];
}

export async function getEnrichedAssetsForOwner(
  userId: string,
  options?: {
    projectId?: string;
    includeArchived?: boolean;
    folderId?: string | null;
  },
) {
  const includeArchived = options?.includeArchived ?? false;
  const supabase = getSupabase();
  const ownedProjects = options?.projectId
    ? [await verifyProjectOwner(userId, options.projectId)].flatMap((result) =>
        result.allowed ? [result.project] : [],
      )
    : await getOwnedProjects(userId);

  if (ownedProjects.length === 0) {
    return { projects: [] as ProjectRecord[], assets: [] as EnrichedAsset[] };
  }

  const projectIds = ownedProjects.map((project) => project.id);
  let assetsQuery = supabase
    .from("assets")
    .select("*")
    .in("project_id", projectIds)
    .order("updated_at", { ascending: false });

  if (!includeArchived) {
    assetsQuery = assetsQuery.is("deleted_at", null);
  }

  if (options?.folderId === null) {
    assetsQuery = assetsQuery.is("folder_id", null);
  } else if (options?.folderId) {
    assetsQuery = assetsQuery.eq("folder_id", options.folderId);
  }

  const { data: assetsData, error: assetsError } = await assetsQuery;
  if (assetsError) throw assetsError;

  const assets = (assetsData ?? []) as AssetRecord[];
  if (assets.length === 0) {
    return { projects: ownedProjects, assets: [] as EnrichedAsset[] };
  }

  const assetIds = assets.map((asset) => asset.id);

  const [
    versionsResult,
    commentsResult,
    approvalsResult,
    foldersResult,
    tagsResult,
    assetTagsResult,
    invitesResult,
  ] = await Promise.all([
    supabase
      .from("versions")
      .select("id, asset_id, version_number, is_current, created_at")
      .in("asset_id", assetIds)
      .order("version_number", { ascending: false }),
    supabase.from("comments").select("asset_id, status").in("asset_id", assetIds),
    supabase.from("approvals").select("asset_id, status").in("asset_id", assetIds),
    supabase.from("folders").select("id, name, project_id").in("project_id", projectIds),
    supabase.from("tags").select("id, project_id, name, color").in("project_id", projectIds),
    supabase.from("asset_tags").select("asset_id, tag_id").in("asset_id", assetIds),
    supabase
      .from("review_invites")
      .select("id, asset_id, view_count, last_viewed_at, created_at, permissions, expires_at")
      .in("asset_id", assetIds)
      .order("created_at", { ascending: false }),
  ]);

  if (versionsResult.error) throw versionsResult.error;
  if (commentsResult.error) throw commentsResult.error;
  if (approvalsResult.error) throw approvalsResult.error;
  if (foldersResult.error) throw foldersResult.error;
  if (tagsResult.error) throw tagsResult.error;
  if (assetTagsResult.error) throw assetTagsResult.error;
  if (invitesResult.error) throw invitesResult.error;

  const versions = (versionsResult.data ?? []) as VersionRecord[];
  const comments = (commentsResult.data ?? []) as CommentRecord[];
  const approvals = (approvalsResult.data ?? []) as ApprovalRecord[];
  const folders = (foldersResult.data ?? []) as FolderRecord[];
  const tags = (tagsResult.data ?? []) as TagRecord[];
  const assetTags = (assetTagsResult.data ?? []) as AssetTagRecord[];
  const invites = (invitesResult.data ?? []) as InviteRecord[];

  const projectMap = new Map(ownedProjects.map((project) => [project.id, project]));
  const folderMap = new Map(folders.map((folder) => [folder.id, folder]));
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]));

  const versionsByAsset = groupBy(versions, (version) => version.asset_id);
  const commentsByAsset = groupBy(comments, (comment) => comment.asset_id);
  const approvalsByAsset = groupBy(approvals, (approval) => approval.asset_id);
  const assetTagsByAsset = groupBy(assetTags, (assetTag) => assetTag.asset_id);
  const invitesByAsset = groupBy(invites, (invite) => invite.asset_id);

  const enrichedAssets = assets.map((asset) => {
    const project = projectMap.get(asset.project_id);
    const folder = asset.folder_id ? folderMap.get(asset.folder_id) : null;
    const assetVersions = (versionsByAsset.get(asset.id) ?? []).sort(
      (left, right) => right.version_number - left.version_number,
    );
    const currentVersion =
      assetVersions.find((version) => version.is_current) ?? assetVersions[0] ?? null;
    const assetComments = commentsByAsset.get(asset.id) ?? [];
    const assetApprovals = approvalsByAsset.get(asset.id) ?? [];
    const inviteList = invitesByAsset.get(asset.id) ?? [];
    const assetTagRecords = assetTagsByAsset.get(asset.id) ?? [];

    return {
      ...asset,
      project_name: project?.name ?? "Untitled Project",
      project_updated_at: project?.updated_at ?? asset.updated_at,
      folder_name: folder?.name ?? null,
      tags: assetTagRecords
        .map((record) => tagMap.get(record.tag_id))
        .filter(Boolean) as TagRecord[],
      comment_count: assetComments.length,
      open_comment_count: assetComments.filter((comment) => comment.status !== "resolved").length,
      resolved_comment_count: assetComments.filter((comment) => comment.status === "resolved").length,
      approval_count: assetApprovals.length,
      approved_count: assetApprovals.filter((approval) => approval.status === "approved").length,
      pending_approval_count: assetApprovals.filter((approval) => approval.status === "pending").length,
      latest_version_number: assetVersions[0]?.version_number ?? 1,
      current_version_id: currentVersion?.id ?? null,
      current_version_number: currentVersion?.version_number ?? null,
      share_views: inviteList.reduce((sum, invite) => sum + (invite.view_count ?? 0), 0),
      last_shared_at: inviteList[0]?.created_at ?? null,
      last_viewed_at: inviteList.find((invite) => invite.last_viewed_at)?.last_viewed_at ?? null,
      latest_share_permission: inviteList[0]?.permissions ?? null,
    } satisfies EnrichedAsset;
  });

  return { projects: ownedProjects, assets: enrichedAssets };
}

export async function getAccountAnalytics(userId: string): Promise<AccountAnalyticsSnapshot> {
  const { projects, assets } = await getEnrichedAssetsForOwner(userId, {
    includeArchived: true,
  });

  const activeAssetIds = assets.filter((asset) => !asset.deleted_at).map((asset) => asset.id);
  const supabase = getSupabase();
  const [commentsResult, approvalsResult] = await Promise.all([
    activeAssetIds.length > 0
      ? supabase
          .from("comments")
          .select("asset_id, status, created_at")
          .in("asset_id", activeAssetIds)
      : Promise.resolve({ data: [], error: null }),
    activeAssetIds.length > 0
      ? supabase
          .from("approvals")
          .select("asset_id, status, created_at")
          .in("asset_id", activeAssetIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (commentsResult.error) throw commentsResult.error;
  if (approvalsResult.error) throw approvalsResult.error;

  const comments = (commentsResult.data ?? []) as Array<{
    asset_id: string;
    status: string;
    created_at: string;
  }>;
  const approvals = (approvalsResult.data ?? []) as Array<{
    asset_id: string;
    status: string;
    created_at: string;
  }>;

  const totals = {
    projects: projects.length,
    assets: assets.filter((asset) => !asset.deleted_at).length,
    archived_assets: assets.filter((asset) => Boolean(asset.deleted_at)).length,
    active_reviews: assets.filter((asset) => !asset.deleted_at && asset.status === "in_review").length,
    approved_assets: assets.filter((asset) => !asset.deleted_at && asset.status === "approved").length,
    open_comments: comments.filter((comment) => comment.status !== "resolved").length,
    resolved_comments: comments.filter((comment) => comment.status === "resolved").length,
    share_views: assets.reduce((sum, asset) => sum + asset.share_views, 0),
  };

  return {
    totals,
    trends: {
      comments_per_day: fillTrailingDays(comments.map((comment) => comment.created_at)),
      approvals_per_day: fillTrailingDays(
        approvals
          .filter((approval) => approval.status !== "pending")
          .map((approval) => approval.created_at),
      ),
    },
    top_assets: [...assets]
      .filter((asset) => !asset.deleted_at)
      .sort((left, right) => {
        const scoreA = left.share_views * 5 + left.open_comment_count * 3 + left.pending_approval_count * 4;
        const scoreB = right.share_views * 5 + right.open_comment_count * 3 + right.pending_approval_count * 4;
        return scoreB - scoreA;
      })
      .slice(0, 6)
      .map((asset) => ({
        id: asset.id,
        title: asset.title,
        project_name: asset.project_name,
        share_views: asset.share_views,
        open_comment_count: asset.open_comment_count,
        approval_count: asset.approval_count,
        pending_approval_count: asset.pending_approval_count,
        current_version_number: asset.current_version_number,
        status: asset.status,
      })),
    top_projects: projects
      .map((project) => {
        const projectAssets = assets.filter((asset) => asset.project_id === project.id && !asset.deleted_at);
        return {
          id: project.id,
          name: project.name,
          asset_count: projectAssets.length,
          active_reviews: projectAssets.filter((asset) => asset.status === "in_review").length,
          open_comments: projectAssets.reduce((sum, asset) => sum + asset.open_comment_count, 0),
          share_views: projectAssets.reduce((sum, asset) => sum + asset.share_views, 0),
          updated_at: project.updated_at,
        };
      })
      .sort((left, right) => {
        const scoreA = left.share_views * 5 + left.open_comments * 3 + left.active_reviews * 4;
        const scoreB = right.share_views * 5 + right.open_comments * 3 + right.active_reviews * 4;
        return scoreB - scoreA;
      })
      .slice(0, 6),
  };
}

function fillTrailingDays(isoDates: string[], totalDays = 30) {
  const counts = new Map<string, number>();
  for (const isoDate of isoDates) {
    const key = isoDate.slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const series: Array<{ date: string; count: number }> = [];
  for (let index = totalDays - 1; index >= 0; index -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - index);
    const key = date.toISOString().slice(0, 10);
    series.push({ date: key, count: counts.get(key) ?? 0 });
  }

  return series;
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = getKey(item);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return groups;
}
