"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowUpRight,
  FolderClosed,
  Layers3,
  RefreshCcw,
  Tag as TagIcon,
} from "lucide-react";
import AssetFilters, { type AssetFilterState } from "@/components/assets/AssetFilters";
import FolderTree from "@/components/assets/FolderTree";
import TagManager from "@/components/assets/TagManager";
import {
  EmptyState,
  MetricTile,
  SectionCard,
  StatusBadge,
  SuitePage,
} from "@/components/suite/SuitePrimitives";
import type { Folder, Tag } from "@/lib/types/codeliver";

type Project = {
  id: string;
  name: string;
  description: string | null;
};

type Asset = {
  id: string;
  project_id: string;
  project_name: string;
  folder_id: string | null;
  folder_name: string | null;
  title: string;
  file_type: string;
  thumbnail_url: string | null;
  file_url: string | null;
  status: string;
  deleted_at?: string | null;
  file_size: number | null;
  updated_at: string;
  tags: Tag[];
  comment_count: number;
  open_comment_count: number;
  approval_count: number;
  approved_count: number;
  pending_approval_count: number;
  current_version_number: number | null;
  latest_version_number: number;
  share_views: number;
};

const defaultFilters: AssetFilterState = {
  type: "all",
  status: "all",
  tags: [],
  search: "",
  sort: "newest",
};

export default function LibraryPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"folders" | "media" | "archived">("media");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [filters, setFilters] = useState<AssetFilterState>(defaultFilters);

  useEffect(() => {
    void refreshLibrary();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const search = params.get("search") ?? "";
    if (!search) return;

    setFilters((current) => ({ ...current, search }));
  }, []);

  useEffect(() => {
    if (selectedProjectId === "all") {
      setFolders([]);
      setTags([]);
      setCurrentFolderId(null);
      return;
    }

    void Promise.all([
      fetch(`/api/folders?project_id=${selectedProjectId}`).then((response) => response.json()),
      fetch(`/api/assets/tags?project_id=${selectedProjectId}`).then((response) => response.json()),
    ]).then(([folderData, tagData]) => {
      setFolders(folderData ?? []);
      setTags(tagData ?? []);
    });
  }, [selectedProjectId]);

  const visibleAssets = useMemo(() => {
    let next = [...assets];
    if (selectedProjectId !== "all") {
      next = next.filter((asset) => asset.project_id === selectedProjectId);
    }

    if (activeTab === "archived") {
      next = next.filter((asset) => Boolean(asset.deleted_at));
    } else {
      next = next.filter((asset) => !asset.deleted_at);
    }

    if (activeTab === "folders" && currentFolderId !== null) {
      next = next.filter((asset) => asset.folder_id === currentFolderId);
    }

    if (filters.status !== "all") {
      next = next.filter((asset) => asset.status === filters.status);
    }

    if (filters.type !== "all") {
      next = next.filter((asset) => asset.file_type === filters.type);
    }

    if (filters.tags.length > 0) {
      next = next.filter((asset) =>
        filters.tags.every((tagId) => asset.tags.some((tag) => tag.id === tagId)),
      );
    }

    if (filters.search.trim()) {
      const query = filters.search.trim().toLowerCase();
      next = next.filter((asset) =>
        [
          asset.title,
          asset.project_name,
          asset.folder_name ?? "",
          ...asset.tags.map((tag) => tag.name),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query),
      );
    }

    next.sort((left, right) => {
      if (filters.sort === "oldest") {
        return new Date(left.updated_at).getTime() - new Date(right.updated_at).getTime();
      }
      if (filters.sort === "name") {
        return left.title.localeCompare(right.title);
      }
      if (filters.sort === "size") {
        return (right.file_size ?? 0) - (left.file_size ?? 0);
      }
      return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
    });

    return next;
  }, [activeTab, assets, currentFolderId, filters, selectedProjectId]);

  const activeProject = projects.find((project) => project.id === selectedProjectId) ?? null;

  async function refreshLibrary() {
    setLoading(true);
    const [projectData, assetData] = await Promise.all([
      fetch("/api/projects").then((response) => response.json()),
      fetch("/api/assets?include_archived=true").then((response) => response.json()),
    ]);
    setProjects(projectData.items ?? []);
    setAssets(assetData.items ?? []);
    setLoading(false);
  }

  async function createFolder(name: string, parentId: string | null) {
    if (!activeProject) return;
    await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: activeProject.id, name, parent_id: parentId }),
    });
    const folderData = await fetch(`/api/folders?project_id=${activeProject.id}`).then((response) => response.json());
    setFolders(folderData ?? []);
  }

  async function renameFolder(id: string, name: string) {
    await fetch("/api/folders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name }),
    });
    if (activeProject) {
      const folderData = await fetch(`/api/folders?project_id=${activeProject.id}`).then((response) => response.json());
      setFolders(folderData ?? []);
    }
  }

  async function deleteFolder(id: string) {
    await fetch("/api/folders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (activeProject) {
      const folderData = await fetch(`/api/folders?project_id=${activeProject.id}`).then((response) => response.json());
      setFolders(folderData ?? []);
    }
    void refreshLibrary();
  }

  async function toggleAssetTag(asset: Asset, tagId: string) {
    const hasTag = asset.tags.some((tag) => tag.id === tagId);
    await fetch("/api/assets/tags", {
      method: hasTag ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset_id: asset.id, tag_id: tagId }),
    });
    void refreshLibrary();
  }

  async function archiveAsset(assetId: string) {
    await fetch(`/api/assets/${assetId}`, { method: "DELETE" });
    void refreshLibrary();
  }

  async function restoreAsset(assetId: string) {
    await fetch(`/api/assets/${assetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleted_at: null }),
    });
    void refreshLibrary();
  }

  async function moveAsset(assetId: string, folderId: string | null) {
    await fetch(`/api/assets/${assetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_id: folderId }),
    });
    void refreshLibrary();
  }

  const activeAssets = assets.filter((asset) => !asset.deleted_at);
  const archivedAssets = assets.filter((asset) => Boolean(asset.deleted_at));

  return (
    <SuitePage
      eyebrow="Content Library"
      title="Organize media like a suite, open it like a review room"
      description="Folders, tags, archive state, version awareness, and review metrics now live together so the library behaves like the front door to co-deliver instead of a separate utility."
      actions={
        <>
          <button
            type="button"
            onClick={() => void refreshLibrary()}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:border-[color:rgba(52,211,153,0.16)]"
          >
            <RefreshCcw size={14} />
            Refresh
          </button>
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90"
          >
            Upload and review
          </Link>
        </>
      }
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Media" value={loading ? "—" : activeAssets.length} note="Live assets across the account library." />
        <MetricTile label="Archived" value={loading ? "—" : archivedAssets.length} note="Soft-archived assets that can still be restored." accent="var(--orange)" />
        <MetricTile label="Open comments" value={loading ? "—" : activeAssets.reduce((sum, asset) => sum + asset.open_comment_count, 0)} note="Unresolved feedback still attached to live assets." accent="var(--orange)" />
        <MetricTile label="Share views" value={loading ? "—" : activeAssets.reduce((sum, asset) => sum + asset.share_views, 0)} note="External review traffic across current library assets." accent="var(--purple)" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <SectionCard
          title="Library controls"
          description="Switch the project lens, browse folders, and manage reusable tags."
        >
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dim)]">
                Project lens
              </label>
              <select
                value={selectedProjectId}
                onChange={(event) => setSelectedProjectId(event.target.value)}
                className="w-full rounded-2xl border border-[var(--border)] bg-[color:rgba(255,255,255,0.04)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
              >
                <option value="all">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              {[
                { value: "folders", label: "Folders", icon: FolderClosed },
                { value: "media", label: "Media", icon: Layers3 },
                { value: "archived", label: "Archived", icon: Archive },
              ].map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value as typeof activeTab)}
                  className={`flex items-center gap-2 rounded-2xl px-3 py-3 text-sm font-medium transition ${
                    activeTab === tab.value
                      ? "border border-[color:rgba(52,211,153,0.14)] bg-[color:rgba(52,211,153,0.1)] text-[var(--accent)]"
                      : "text-[var(--muted)] hover:bg-[color:rgba(255,255,255,0.03)] hover:text-[var(--ink)]"
                  }`}
                >
                  <tab.icon size={15} />
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "folders" && activeProject ? (
              <FolderTree
                folders={folders}
                currentFolderId={currentFolderId}
                onSelectFolder={setCurrentFolderId}
                onCreateFolder={createFolder}
                onRenameFolder={renameFolder}
                onDeleteFolder={deleteFolder}
              />
            ) : null}

            {activeProject ? (
              <TagManager
                projectId={activeProject.id}
                tags={tags}
                onTagsChange={() => {
                  void Promise.all([
                    fetch(`/api/assets/tags?project_id=${activeProject.id}`).then((response) => response.json()),
                    refreshLibrary(),
                  ]).then(([tagData]) => setTags(tagData ?? []));
                }}
              />
            ) : (
              <div className="rounded-[18px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] px-4 py-4 text-sm leading-6 text-[var(--muted)]">
                Pick a specific project to manage folders and reusable tags.
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Library view"
          description="Richer cards expose version state, review pressure, and asset organization before you even open the review workspace."
        >
          <div className="mb-4">
            <AssetFilters
              currentFilters={filters}
              tags={tags}
              onFilterChange={setFilters}
            />
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((value) => (
                <div key={value} className="skeleton h-[320px] rounded-[18px]" />
              ))}
            </div>
          ) : visibleAssets.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {visibleAssets.map((asset) => (
                <article
                  key={asset.id}
                  className="overflow-hidden rounded-[20px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)]"
                >
                  <Link href={`/projects/${asset.project_id}/assets/${asset.id}`} className="block">
                    <div className="relative aspect-video overflow-hidden bg-[color:rgba(8,17,31,0.55)]">
                      {asset.thumbnail_url ? (
                        <Image
                          src={asset.thumbnail_url}
                          alt={asset.title}
                          fill
                          unoptimized
                          sizes="(min-width: 1536px) 33vw, (min-width: 768px) 50vw, 100vw"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm font-medium text-[var(--dim)]">
                          {asset.file_type}
                        </div>
                      )}
                    </div>
                  </Link>

                  <div className="space-y-4 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link
                          href={`/projects/${asset.project_id}/assets/${asset.id}`}
                          className="text-base font-semibold text-[var(--ink)] transition hover:text-[var(--accent)]"
                        >
                          {asset.title}
                        </Link>
                        <div className="mt-1 text-sm text-[var(--muted)]">
                          {asset.project_name}
                          {asset.folder_name ? ` · ${asset.folder_name}` : ""}
                        </div>
                      </div>
                      <StatusBadge value={asset.status} />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <LibraryStat label="Version" value={asset.current_version_number ? `v${asset.current_version_number}` : `v${asset.latest_version_number}`} />
                      <LibraryStat label="Comments" value={asset.open_comment_count} />
                      <LibraryStat label="Approvals" value={`${asset.approved_count}/${asset.approval_count || 0}`} />
                      <LibraryStat label="Views" value={asset.share_views} />
                    </div>

                    {asset.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {asset.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink)]"
                          >
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {activeProject ? (
                      <div className="space-y-3 rounded-[18px] border border-[var(--border)] bg-[color:rgba(8,17,31,0.5)] p-3">
                        <div>
                          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dim)]">
                            Folder
                          </div>
                          <select
                            value={asset.folder_id ?? ""}
                            onChange={(event) => void moveAsset(asset.id, event.target.value || null)}
                            className="w-full rounded-xl border border-[var(--border)] bg-[color:rgba(255,255,255,0.04)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
                          >
                            <option value="">Unfiled</option>
                            {flattenFolders(folders).map((folder) => (
                              <option key={folder.id} value={folder.id}>
                                {folder.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {tags.length > 0 ? (
                          <div>
                            <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dim)]">
                              <TagIcon size={12} />
                              Assign tags
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {tags.map((tag) => {
                                const selected = asset.tags.some((item) => item.id === tag.id);
                                return (
                                  <button
                                    key={tag.id}
                                    type="button"
                                    onClick={() => void toggleAssetTag(asset, tag.id)}
                                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                                      selected
                                        ? "border-transparent text-slate-950"
                                        : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--ink)]"
                                    }`}
                                    style={selected ? { backgroundColor: tag.color } : undefined}
                                  >
                                    {tag.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between gap-3">
                      <Link
                        href={`/projects/${asset.project_id}/assets/${asset.id}`}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]"
                      >
                        Open in review workspace
                        <ArrowUpRight size={14} />
                      </Link>
                      {asset.deleted_at ? (
                        <button
                          type="button"
                          onClick={() => void restoreAsset(asset.id)}
                          className="text-sm font-medium text-[var(--ink)] transition hover:text-[var(--accent)]"
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void archiveAsset(asset.id)}
                          className="text-sm font-medium text-[var(--muted)] transition hover:text-[var(--orange)]"
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No assets in this view"
              body="Try another project lens, folder, or filter set. Once assets are uploaded, this library will surface organization and review state together."
              actionLabel="Open projects"
              actionHref="/projects"
            />
          )}
        </SectionCard>
      </section>
    </SuitePage>
  );
}

function LibraryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[color:rgba(8,17,31,0.5)] px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--dim)]">
        {label}
      </div>
      <div className="mt-1 text-base font-semibold text-[var(--ink)]">{value}</div>
    </div>
  );
}

function flattenFolders(
  folders: Folder[],
  depth = 0,
): Array<{ id: string; label: string }> {
  return folders.flatMap((folder) => [
    { id: folder.id, label: `${"  ".repeat(depth)}${folder.name}` },
    ...flattenFolders(folder.children ?? [], depth + 1),
  ]);
}
