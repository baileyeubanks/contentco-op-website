import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getEnrichedAssetsForOwner } from "@/lib/server/codeliver-data";

export async function GET(req: Request) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get("include_archived") === "true";
    const projectId = searchParams.get("project_id") || undefined;
    const folderId = searchParams.has("folder_id")
      ? searchParams.get("folder_id")
      : undefined;
    const typeFilter = searchParams.get("type");
    const search = searchParams.get("search")?.trim().toLowerCase() || "";
    const sort = searchParams.get("sort") || "updated_at";
    const tagIds = searchParams.getAll("tag");

    const { items } = normalizeFilters(
      (
        await getEnrichedAssetsForOwner(user.id, {
          includeArchived,
          projectId,
          folderId,
        })
      ).assets,
      {
        type: typeFilter,
        search,
        sort,
        tagIds,
      },
    );

    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load assets" },
      { status: 500 },
    );
  }
}

function normalizeFilters(
  items: Awaited<ReturnType<typeof getEnrichedAssetsForOwner>>["assets"],
  filters: {
    type: string | null;
    search: string;
    sort: string;
    tagIds: string[];
  },
) {
  let next = [...items];

  if (filters.type && filters.type !== "all") {
    next = next.filter((item) => item.file_type === filters.type);
  }

  if (filters.search) {
    next = next.filter((item) => {
      const haystack = [
        item.title,
        item.project_name,
        item.folder_name ?? "",
        ...item.tags.map((tag) => tag.name),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(filters.search);
    });
  }

  if (filters.tagIds.length > 0) {
    next = next.filter((item) =>
      filters.tagIds.every((tagId) => item.tags.some((tag) => tag.id === tagId)),
    );
  }

  next.sort((left, right) => {
    if (filters.sort === "name") {
      return left.title.localeCompare(right.title);
    }

    if (filters.sort === "size") {
      return (right.file_size ?? 0) - (left.file_size ?? 0);
    }

    if (filters.sort === "created_at") {
      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    }

    return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
  });

  return { items: next };
}
