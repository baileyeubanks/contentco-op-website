import { NextResponse } from "next/server";
import {
  authorizeRootWorkspaceRoute,
  buildRootWorkspaceSnapshot,
  queueRootWorkspaceImport,
  type RootWorkspaceScope,
} from "@/lib/os-workspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type WorkspaceImportRequestBody = {
  kind?: unknown;
  id?: unknown;
  title?: unknown;
  sourceUrl?: unknown;
  scope?: unknown;
};

function normalizeWorkspaceScope(value: unknown): RootWorkspaceScope | undefined {
  const normalized = String(value ?? "").trim();
  if (!normalized) return undefined;
  const upper = normalized.toUpperCase();
  if (upper === "ALL") return "ALL";
  if (upper === "ACS") return "ACS";
  if (upper === "CC" || upper === "CCO") return "CC";
  if (upper === "SHARED") return "shared";
  return undefined;
}

async function parseBody(request: Request): Promise<WorkspaceImportRequestBody> {
  const body = await request.json().catch(() => null);
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return body as WorkspaceImportRequestBody;
  }
  return {};
}

export async function GET(request: Request) {
  const access = await authorizeRootWorkspaceRoute("root.workspace.imports.read");
  if (!access.ok) return access.response;

  const url = new URL(request.url);
  const snapshot = await buildRootWorkspaceSnapshot({
    host: request.headers.get("host"),
    brandHint: request.headers.get("x-os-brand"),
    fresh: url.searchParams.get("fresh") === "1",
  });
  const imports = snapshot.sections.find((section) => section.id === "imports");

  return NextResponse.json({ section: imports, items: imports?.items || [] });
}

export async function POST(request: Request) {
  const access = await authorizeRootWorkspaceRoute("root.workspace.imports.write");
  if (!access.ok) return access.response;

  const body = await parseBody(request);
  const kind = typeof body.kind === "string" && body.kind.trim() ? body.kind.trim() : "file";
  const id = typeof body.id === "string" && body.id.trim() ? body.id.trim() : "";

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const result = await queueRootWorkspaceImport({
      kind,
      id,
      title: typeof body.title === "string" ? body.title : null,
      sourceUrl: typeof body.sourceUrl === "string" ? body.sourceUrl : null,
      scope: normalizeWorkspaceScope(body.scope),
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "workspace_import_failed",
        kind,
        id,
      },
      { status: 500 },
    );
  }
}
