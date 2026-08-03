import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";
import { resolveOsBrand } from "@/lib/os-brand";

const execFileAsync = promisify(execFile);
const MONOREPO_ROOT = "/Users/baileyeubanks/Desktop/Projects/contentco-op/monorepo";
export const ROOT_WORKSPACE_REFRESH_INTERVAL_MS = 60_000;

export type RootWorkspaceStatus = "healthy" | "attention" | "critical" | "unknown";
export type RootWorkspaceSectionId = "drive" | "docs" | "sheets" | "slides" | "gcs" | "imports" | "health";
export type RootWorkspaceScope = "ALL" | "ACS" | "CC" | "shared";
export type RootWorkspaceSourceMode = "endpoint" | "cli" | "hybrid" | "stub";

export type RootWorkspaceItemAction = {
  id: string;
  label: string;
  kind: "link" | "api" | "stub";
  href?: string;
  action?: string;
  note?: string;
};

export type RootWorkspaceItem = {
  id: string;
  kind: "drive" | "doc" | "sheet" | "slide" | "bucket" | "object" | "import" | "health";
  title: string;
  subtitle: string;
  status: RootWorkspaceStatus;
  authority: string;
  detail: string;
  sourceLabel: string;
  sourceUrl?: string | null;
  previewUrl?: string | null;
  owner?: string | null;
  updatedAt?: string | null;
  sizeLabel?: string | null;
  mimeType?: string | null;
  scope?: RootWorkspaceScope;
  tags: string[];
  actions: RootWorkspaceItemAction[];
};

export type RootWorkspaceSection = {
  id: RootWorkspaceSectionId;
  title: string;
  summary: string;
  status: RootWorkspaceStatus;
  emptyState: string;
  items: RootWorkspaceItem[];
};

export type RootWorkspaceConnector = {
  id: string;
  label: string;
  kind: RootWorkspaceSourceMode;
  status: RootWorkspaceStatus;
  detail: string;
  endpoint?: string | null;
  command?: string | null;
  lastCheckedAt: string | null;
};

export type RootWorkspaceSnapshot = {
  meta: {
    generatedAt: string;
    refreshIntervalMs: number;
    sourceFreshness: string;
    overallStatus: RootWorkspaceStatus;
    workspaceScope: RootWorkspaceScope;
    connectorMode: RootWorkspaceSourceMode;
  };
  tabs: Array<{ id: RootWorkspaceSectionId; label: string; status: RootWorkspaceStatus; count: number }>;
  connectors: RootWorkspaceConnector[];
  sections: RootWorkspaceSection[];
  actions: RootWorkspaceItemAction[];
  summary: {
    totalItems: number;
    sectionsLoaded: number;
    liveConnectors: number;
    importableItems: number;
  };
};

export type RootWorkspaceDetail = RootWorkspaceItem | null;

export type RootWorkspaceProjectionResult = {
  status: RootWorkspaceStatus;
  detail: string;
  mode: RootWorkspaceSourceMode;
  endpoint: string | null;
  command: string | null;
  lastCheckedAt: string | null;
  items: RootWorkspaceItem[];
};

type WorkspaceTarget = {
  sectionId: RootWorkspaceSectionId;
  title: string;
  summary: string;
  emptyState: string;
  endpointPath: string;
  cliArgs: string[];
  kind: RootWorkspaceItem["kind"];
  authority: string;
  itemMapper: (payload: unknown) => RootWorkspaceItem[];
  deriveFrom?: RootWorkspaceSectionId[];
};

const ENDPOINT_ENV_KEYS = [
  "ROOT_WORKSPACE_ENDPOINT",
  "GOOGLE_WORKSPACE_ENDPOINT",
  "ROOT_GOOGLE_WORKSPACE_ENDPOINT",
];

const CLI_ENV_KEYS = [
  "ROOT_WORKSPACE_CLI",
  "GOOGLE_WORKSPACE_CLI",
  "ROOT_GOOGLE_WORKSPACE_CLI",
];

const CLI_ARGS_ENV_KEYS = [
  "ROOT_WORKSPACE_CLI_ARGS",
  "GOOGLE_WORKSPACE_CLI_ARGS",
  "ROOT_GOOGLE_WORKSPACE_CLI_ARGS",
];

function firstEnv(keys: string[]) {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim()) return value.trim();
  }
  return "";
}

function normalizeText(value: unknown, fallback = "") {
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function normalizeScope(value: unknown): RootWorkspaceScope {
  const raw = normalizeText(value, "").toUpperCase();
  if (raw === "ACS" || raw === "CC" || raw === "ALL" || raw === "SHARED") return raw as RootWorkspaceScope;
  return "shared";
}

function normalizeStatus(value: unknown): RootWorkspaceStatus {
  const raw = normalizeText(value, "").toLowerCase();
  if (["healthy", "ok", "live", "ready", "canonical"].includes(raw)) return "healthy";
  if (["attention", "warn", "warning", "degraded", "partial", "missing", "stub", "idle"].includes(raw)) return "attention";
  if (["critical", "error", "fail", "failed", "blocked", "down"].includes(raw)) return "critical";
  return "unknown";
}

function statusRank(status: RootWorkspaceStatus) {
  switch (status) {
    case "critical":
      return 3;
    case "attention":
      return 2;
    case "healthy":
      return 1;
    default:
      return 0;
  }
}

function worstStatus(statuses: RootWorkspaceStatus[]): RootWorkspaceStatus {
  return statuses.reduce<RootWorkspaceStatus>((current, next) => (statusRank(next) > statusRank(current) ? next : current), "unknown");
}

function coerceArray(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((value): value is Record<string, unknown> => Boolean(value && typeof value === "object"));
  }
  if (!payload || typeof payload !== "object") return [];
  const candidates = [
    "items",
    "files",
    "documents",
    "docs",
    "sheets",
    "slides",
    "buckets",
    "objects",
    "imports",
    "results",
    "data",
  ];
  for (const key of candidates) {
    const value = (payload as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      return value.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"));
    }
  }
  return [];
}

function bytesToLabel(value: unknown) {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return null;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let current = size;
  let unit = 0;
  while (current >= 1024 && unit < units.length - 1) {
    current /= 1024;
    unit += 1;
  }
  return `${current >= 10 || unit === 0 ? Math.round(current) : current.toFixed(1)} ${units[unit]}`;
}

function formatTimestamp(value: unknown) {
  const raw = normalizeText(value, "");
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleString();
}

function mapWorkspaceItem(raw: Record<string, unknown>, kind: RootWorkspaceItem["kind"], authority: string, sourceLabel: string): RootWorkspaceItem {
  const id = normalizeText(raw.id || raw.fileId || raw.documentId || raw.objectId || raw.path || raw.name || raw.title || raw.key, `${kind}-${Math.random().toString(36).slice(2, 8)}`);
  const title = normalizeText(raw.name || raw.title || raw.displayName || raw.fileName || raw.bucket || raw.key, id);
  const subtitle = normalizeText(
    raw.subtitle || raw.summary || raw.description || raw.ownerName || raw.mimeType || raw.contentType || raw.bucket || raw.key,
    "Server-side projection",
  );
  const sourceUrl = normalizeText(raw.webViewLink || raw.url || raw.htmlLink || raw.sourceUrl || raw.permalink, "") || null;
  const previewUrl = normalizeText(raw.previewUrl || raw.thumbnailLink || raw.preview_url, "") || null;
  const owner = normalizeText(raw.owner || raw.ownerName || raw.email || raw.creator, "") || null;
  const mimeType = normalizeText(raw.mimeType || raw.contentType || raw.mime_type, "") || null;
  const updatedAt = formatTimestamp(raw.modifiedTime || raw.updatedAt || raw.lastModified || raw.updated_at);
  const sizeLabel = bytesToLabel(raw.size || raw.bytes || raw.contentLength);
  const scope = normalizeScope(raw.scope || raw.businessScope || raw.workspace || raw.business_unit);
  const status = normalizeStatus(raw.status || raw.state || raw.health || raw.availability);
  const tags = coerceArray(raw.tags || raw.labels)
    .map((tag) => normalizeText(tag, ""))
    .filter(Boolean);
  const detail = normalizeText(
    raw.detail || raw.summary || raw.description || raw.note || `${title} is projected server-side from the ${sourceLabel} connector.`,
    `${title} is projected server-side from the ${sourceLabel} connector.`,
  );

  return {
    id,
    kind,
    title,
    subtitle,
    status,
    authority,
    detail,
    sourceLabel,
    sourceUrl,
    previewUrl,
    owner,
    updatedAt,
    sizeLabel,
    mimeType,
    scope,
    tags: Array.from(new Set(tags)),
    actions: [],
  };
}

function deriveActions(item: RootWorkspaceItem): RootWorkspaceItemAction[] {
  const actions: RootWorkspaceItemAction[] = [];
  if (item.sourceUrl) {
    actions.push({
      id: `${item.id}-open-source`,
      label: "Open source",
      kind: "link",
      href: item.sourceUrl,
      note: "Open the original Google-hosted file or object.",
    });
  }
  if (item.previewUrl) {
    actions.push({
      id: `${item.id}-preview`,
      label: "Preview",
      kind: "link",
      href: item.previewUrl,
      note: "Open the preview projection when available.",
    });
  }
  if (item.kind !== "health") {
    actions.push({
      id: `${item.id}-import`,
      label: "Import to Root",
      kind: "api",
      action: "import",
      note: "Queue a server-side import while preserving provenance.",
    });
  }
  if (item.kind === "sheet") {
    actions.push({
      id: `${item.id}-sheet-action`,
      label: "Queue sheet action",
      kind: "api",
      action: "sheet-action",
      note: "Bounded server-side sheet writes remain stubbed until a live connector is configured.",
    });
  }
  return actions;
}

function hydrateActions(item: RootWorkspaceItem): RootWorkspaceItem {
  return { ...item, actions: deriveActions(item) };
}

function parseCliArgs() {
  const raw = firstEnv(CLI_ARGS_ENV_KEYS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((entry) => normalizeText(entry, "")).filter(Boolean) : [];
  } catch {
    return raw.split(/\s+/).map((entry) => entry.trim()).filter(Boolean);
  }
}

async function execWorkspaceCli(command: string, args: string[]) {
  const result = await execFileAsync(command, args, {
    cwd: MONOREPO_ROOT,
    timeout: 60_000,
    maxBuffer: 1024 * 1024,
  });
  const stdout = String(result.stdout || "").trim();
  if (!stdout) return null;
  try {
    return JSON.parse(stdout) as unknown;
  } catch {
    return { raw: stdout };
  }
}

async function fetchWorkspaceEndpoint(path: string) {
  const endpoint = firstEnv(ENDPOINT_ENV_KEYS);
  if (!endpoint) return null;
  const url = `${endpoint.replace(/\/$/, "")}${path}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`workspace_endpoint_http_${response.status}`);
  }
  return response.json();
}

function resolveWorkspaceProjectionMode() {
  const endpoint = firstEnv(ENDPOINT_ENV_KEYS);
  const cli = firstEnv(CLI_ENV_KEYS);
  if (endpoint && cli) return "hybrid" as const;
  if (endpoint) return "endpoint" as const;
  if (cli) return "cli" as const;
  return "stub" as const;
}

function makeProjectionDetail(mode: RootWorkspaceSourceMode, endpoint: string | null, command: string | null) {
  if (mode === "endpoint") return `Server projection via ${endpoint}.`;
  if (mode === "cli") return `Server projection via ${command}.`;
  if (mode === "hybrid") return `Server projection via ${command} and ${endpoint}.`;
  return "No Google connector configured yet. The console is ready, but file data is projected from local fallback state only.";
}

function sectionFromItems(
  target: WorkspaceTarget,
  projection: RootWorkspaceProjectionResult,
  items: RootWorkspaceItem[],
): RootWorkspaceSection {
  const status = items.length > 0 ? worstStatus(items.map((item) => item.status)) : projection.status;
  return {
    id: target.sectionId,
    title: target.title,
    summary: target.summary,
    status,
    emptyState: target.emptyState,
    items,
  };
}

function isDocLike(item: RootWorkspaceItem) {
  const text = `${item.mimeType || ""} ${item.title} ${item.subtitle}`.toLowerCase();
  return text.includes("document") || text.includes("doc ") || text.includes("google docs") || text.includes("docx");
}

function isSheetLike(item: RootWorkspaceItem) {
  const text = `${item.mimeType || ""} ${item.title} ${item.subtitle}`.toLowerCase();
  return text.includes("spreadsheet") || text.includes("sheet") || text.includes("csv") || text.includes("xlsx");
}

function isSlideLike(item: RootWorkspaceItem) {
  const text = `${item.mimeType || ""} ${item.title} ${item.subtitle}`.toLowerCase();
  return text.includes("presentation") || text.includes("slide") || text.includes("ppt");
}

function deriveImportItems(sections: RootWorkspaceSection[]): RootWorkspaceItem[] {
  const importable = sections
    .filter((section) => section.id !== "imports" && section.id !== "health")
    .flatMap((section) => section.items.map((item) => ({ item, section })))
    .filter(({ item }) => item.kind !== "health" && item.status !== "critical");

  return importable.slice(0, 18).map(({ item, section }) =>
    hydrateActions({
      id: `import-${section.id}-${item.id}`,
      kind: "import",
      title: `Import ${item.title}`,
      subtitle: `${section.title} · ${item.authority}`,
      status: item.status,
      authority: "Root projection",
      detail: `Create a Root-linked source record for ${item.title} while preserving the Google source reference and business provenance.`,
      sourceLabel: section.title,
      sourceUrl: item.sourceUrl,
      previewUrl: item.previewUrl,
      owner: item.owner,
      updatedAt: item.updatedAt,
      sizeLabel: item.sizeLabel,
      mimeType: item.mimeType,
      scope: item.scope,
      tags: Array.from(new Set(["import", ...item.tags])),
      actions: [],
    }),
  );
}

function buildHealthItems(connectors: RootWorkspaceConnector[], projections: Array<{ id: string; status: RootWorkspaceStatus; detail: string }>) {
  const healthItems: RootWorkspaceItem[] = [
    hydrateActions({
      id: "browser-token-policy",
      kind: "health",
      title: "Browser token policy",
      subtitle: "Root stays token-free in the browser",
      status: "healthy",
      authority: "Root control plane",
      detail: "Workspace tokens live only in server-side connectors. The browser receives projected file data, not credentials.",
      sourceLabel: "policy",
      tags: ["security", "projection", "token-free"],
      actions: [],
    }),
    hydrateActions({
      id: "projection-mode",
      kind: "health",
      title: "Projection mode",
      subtitle: projections.length > 0 ? "Google file projections are being evaluated on the server" : "Projection mode unavailable",
      status: connectors.some((connector) => connector.status === "critical") ? "critical" : connectors.some((connector) => connector.status === "attention") ? "attention" : "healthy",
      authority: "Root control plane",
      detail: connectors.length > 0
        ? "Drive, Docs, Sheets, Slides, GCS, and Imports are being projected through the selected connector path."
        : "No connector was configured, so this console is showing its projection scaffold and health warnings instead of live files.",
      sourceLabel: "runtime",
      tags: ["health", "projection"],
      actions: [],
    }),
  ];

  for (const connector of connectors) {
    healthItems.push(
      hydrateActions({
        id: `connector-${connector.id}`,
        kind: "health",
        title: connector.label,
        subtitle: connector.detail,
        status: connector.status,
        authority: connector.kind === "endpoint" ? "external endpoint" : connector.kind === "cli" ? "child process" : "fallback projection",
        detail: connector.endpoint || connector.command || connector.detail,
        sourceLabel: connector.id,
        updatedAt: connector.lastCheckedAt,
        tags: [connector.kind, connector.status],
        actions: [],
      }),
    );
  }

  return healthItems;
}

async function projectWorkspaceTarget(target: WorkspaceTarget): Promise<{ projection: RootWorkspaceProjectionResult; section: RootWorkspaceSection }> {
  const endpoint = firstEnv(ENDPOINT_ENV_KEYS);
  const command = firstEnv(CLI_ENV_KEYS);
  const cliArgs = parseCliArgs();
  const mode = resolveWorkspaceProjectionMode();
  const now = new Date().toISOString();

  let payload: unknown = null;
  let status: RootWorkspaceStatus = "unknown";
  let detail = makeProjectionDetail(mode, endpoint || null, command || null);
  let items: RootWorkspaceItem[] = [];

  try {
    if (endpoint) {
      payload = await fetchWorkspaceEndpoint(target.endpointPath);
      if (payload) {
        status = "healthy";
        detail = `Server projection loaded from ${endpoint.replace(/\/$/, "")}${target.endpointPath}.`;
      }
    }
  } catch (error) {
    status = "critical";
    detail = error instanceof Error ? error.message : `workspace_endpoint_failed:${target.sectionId}`;
  }

  if (!payload && command && status !== "critical") {
    try {
      payload = await execWorkspaceCli(command, [...cliArgs, ...target.cliArgs, "--json"]);
      if (payload) {
        status = "healthy";
        detail = `Server projection loaded from ${command} ${[...cliArgs, ...target.cliArgs].join(" ")}.`;
      }
    } catch (error) {
      status = "critical";
      detail = error instanceof Error ? error.message : `workspace_cli_failed:${target.sectionId}`;
    }
  }

  if (!payload) {
    status = status === "critical" ? status : "attention";
    detail = makeProjectionDetail(mode, endpoint || null, command || null);
    items = [];
  } else {
    items = target.itemMapper(payload).map(hydrateActions);
    if (items.length === 0) {
      status = "attention";
    }
  }

  const projection: RootWorkspaceProjectionResult = {
    status,
    detail,
    mode,
    endpoint: endpoint || null,
    command: command || null,
    lastCheckedAt: now,
    items,
  };

  return { projection, section: sectionFromItems(target, projection, items) };
}

function normalizeWorkspaceListItem(raw: Record<string, unknown>, kind: RootWorkspaceItem["kind"], authority: string, sourceLabel: string) {
  return mapWorkspaceItem(raw, kind, authority, sourceLabel);
}

function normalizeDriveItems(payload: unknown): RootWorkspaceItem[] {
  return coerceArray(payload).map((raw) => normalizeWorkspaceListItem(raw, "drive", "Google Drive", "Drive"));
}

function normalizeDocItems(payload: unknown): RootWorkspaceItem[] {
  return coerceArray(payload).map((raw) => normalizeWorkspaceListItem(raw, "doc", "Google Docs", "Docs"));
}

function normalizeSheetItems(payload: unknown): RootWorkspaceItem[] {
  return coerceArray(payload).map((raw) => normalizeWorkspaceListItem(raw, "sheet", "Google Sheets", "Sheets"));
}

function normalizeSlideItems(payload: unknown): RootWorkspaceItem[] {
  return coerceArray(payload).map((raw) => normalizeWorkspaceListItem(raw, "slide", "Google Slides", "Slides"));
}

function normalizeGcsItems(payload: unknown): RootWorkspaceItem[] {
  const array = coerceArray(payload);
  return array.map((raw) => {
    const kind = raw.bucket || raw.bucketName || raw.key || raw.path ? "object" : "bucket";
    return normalizeWorkspaceListItem(raw, kind, "Google Cloud Storage", "GCS");
  });
}

function inferWorkspaceScope(host: string | null, brandHint: string | null): RootWorkspaceScope {
  const brand = resolveOsBrand(host, brandHint);
  if (brand.key === "acs") return "ACS";
  if (brand.key === "cc") return "CC";
  return "ALL";
}

export async function buildRootWorkspaceSnapshot(options?: {
  host?: string | null;
  brandHint?: string | null;
  fresh?: boolean;
}): Promise<RootWorkspaceSnapshot> {
  const workspaceScope = inferWorkspaceScope(options?.host || null, options?.brandHint || null);

  const [driveProjection, docsProjection, sheetsProjection, slidesProjection, gcsProjection] = await Promise.all([
    projectWorkspaceTarget({
      sectionId: "drive",
      title: "Drive",
      summary: "Recent files, folders, and source entry points.",
      emptyState: "No Drive files were surfaced. Configure ROOT_WORKSPACE_ENDPOINT or ROOT_WORKSPACE_CLI to project live files.",
      endpointPath: "/drive/files",
      cliArgs: ["drive", "files"],
      kind: "drive",
      authority: "Google Drive",
      itemMapper: normalizeDriveItems,
    }),
    projectWorkspaceTarget({
      sectionId: "docs",
      title: "Docs",
      summary: "Documents with previewable text, structure, and source links.",
      emptyState: "No Google Docs were projected. If only Drive is configured, this tab will derive docs from Drive inventory when possible.",
      endpointPath: "/docs",
      cliArgs: ["docs"],
      kind: "doc",
      authority: "Google Docs",
      itemMapper: normalizeDocItems,
    }),
    projectWorkspaceTarget({
      sectionId: "sheets",
      title: "Sheets",
      summary: "Spreadsheets, tabs, and bounded server-side sheet actions.",
      emptyState: "No Sheets were projected. Configure a connector or let the tab derive sheets from Drive file metadata.",
      endpointPath: "/sheets",
      cliArgs: ["sheets"],
      kind: "sheet",
      authority: "Google Sheets",
      itemMapper: normalizeSheetItems,
    }),
    projectWorkspaceTarget({
      sectionId: "slides",
      title: "Slides",
      summary: "Deck metadata and reviewable presentation surfaces.",
      emptyState: "No Slides were projected. The tab can derive slide decks from Drive inventory if the file metadata is available.",
      endpointPath: "/slides",
      cliArgs: ["slides"],
      kind: "slide",
      authority: "Google Slides",
      itemMapper: normalizeSlideItems,
    }),
    projectWorkspaceTarget({
      sectionId: "gcs",
      title: "GCS",
      summary: "Buckets and objects exposed as source-linked assets.",
      emptyState: "No GCS buckets or objects were projected. Configure a connector to surface storage inventory.",
      endpointPath: "/gcs/objects",
      cliArgs: ["gcs", "objects"],
      kind: "object",
      authority: "Google Cloud Storage",
      itemMapper: normalizeGcsItems,
    }),
  ]);

  const derivedDocs = docsProjection.section.items.length > 0 ? docsProjection.section.items : driveProjection.section.items.filter(isDocLike).map((item) => hydrateActions({
    ...item,
    id: `derived-doc-${item.id}`,
    kind: "doc",
    title: item.title,
    subtitle: `${item.subtitle} · derived from Drive inventory`,
    authority: "Google Docs",
    detail: item.detail,
    sourceLabel: "Drive derivation",
    tags: Array.from(new Set([...item.tags, "derived", "docs"])),
    actions: [],
  }));
  const derivedSheets = sheetsProjection.section.items.length > 0 ? sheetsProjection.section.items : driveProjection.section.items.filter(isSheetLike).map((item) => hydrateActions({
    ...item,
    id: `derived-sheet-${item.id}`,
    kind: "sheet",
    title: item.title,
    subtitle: `${item.subtitle} · derived from Drive inventory`,
    authority: "Google Sheets",
    detail: item.detail,
    sourceLabel: "Drive derivation",
    tags: Array.from(new Set([...item.tags, "derived", "sheets"])),
    actions: [],
  }));
  const derivedSlides = slidesProjection.section.items.length > 0 ? slidesProjection.section.items : driveProjection.section.items.filter(isSlideLike).map((item) => hydrateActions({
    ...item,
    id: `derived-slide-${item.id}`,
    kind: "slide",
    title: item.title,
    subtitle: `${item.subtitle} · derived from Drive inventory`,
    authority: "Google Slides",
    detail: item.detail,
    sourceLabel: "Drive derivation",
    tags: Array.from(new Set([...item.tags, "derived", "slides"])),
    actions: [],
  }));

  const driveItems = driveProjection.section.items.length > 0 ? driveProjection.section.items : [];
  const docsItems = derivedDocs;
  const sheetsItems = derivedSheets;
  const slidesItems = derivedSlides;
  const gcsItems = gcsProjection.section.items.length > 0 ? gcsProjection.section.items : [];

  const baseSections: RootWorkspaceSection[] = [
    {
      ...driveProjection.section,
      items: driveItems,
      status: driveItems.length > 0 ? worstStatus(driveItems.map((item) => item.status)) : driveProjection.projection.status,
    },
    {
      ...docsProjection.section,
      items: docsItems,
      status: docsItems.length > 0 ? worstStatus(docsItems.map((item) => item.status)) : docsProjection.projection.status,
    },
    {
      ...sheetsProjection.section,
      items: sheetsItems,
      status: sheetsItems.length > 0 ? worstStatus(sheetsItems.map((item) => item.status)) : sheetsProjection.projection.status,
    },
    {
      ...slidesProjection.section,
      items: slidesItems,
      status: slidesItems.length > 0 ? worstStatus(slidesItems.map((item) => item.status)) : slidesProjection.projection.status,
    },
    {
      ...gcsProjection.section,
      items: gcsItems,
      status: gcsItems.length > 0 ? worstStatus(gcsItems.map((item) => item.status)) : gcsProjection.projection.status,
    },
  ];

  const importsItems = deriveImportItems(baseSections);
  const healthConnectors: RootWorkspaceConnector[] = [
    {
      id: "workspace",
      label: "Workspace connector",
      kind: resolveWorkspaceProjectionMode(),
      status: [driveProjection.projection, docsProjection.projection, sheetsProjection.projection, slidesProjection.projection, gcsProjection.projection].some((projection) => projection.status === "critical")
        ? "critical"
        : [driveProjection.projection, docsProjection.projection, sheetsProjection.projection, slidesProjection.projection, gcsProjection.projection].some((projection) => projection.status === "attention")
          ? "attention"
          : "healthy",
      detail: makeProjectionDetail(resolveWorkspaceProjectionMode(), firstEnv(ENDPOINT_ENV_KEYS) || null, firstEnv(CLI_ENV_KEYS) || null),
      endpoint: firstEnv(ENDPOINT_ENV_KEYS) || null,
      command: firstEnv(CLI_ENV_KEYS) || null,
      lastCheckedAt: new Date().toISOString(),
    },
    ...baseSections.map((section) => ({
      id: `${section.id}-projection`,
      label: `${section.title} projection`,
      kind: "stub" as const,
      status: section.status,
      detail: section.items.length > 0
        ? `${section.items.length} projected item${section.items.length === 1 ? "" : "s"} loaded.`
        : section.emptyState,
      endpoint: null,
      command: null,
      lastCheckedAt: new Date().toISOString(),
    })),
  ];

  const healthItems = buildHealthItems(healthConnectors, baseSections.map((section) => ({
    id: section.id,
    status: section.status,
    detail: section.items.length > 0 ? `${section.items.length} item${section.items.length === 1 ? "" : "s"} loaded.` : section.emptyState,
  })));
  const healthSection: RootWorkspaceSection = {
    id: "health",
    title: "Health",
    summary: "Connector mode, token policy, and projection health.",
    status: worstStatus([...healthItems.map((item) => item.status), "healthy"]),
    emptyState: "Health projections are unavailable.",
    items: healthItems,
  };

  const sections = [
    ...baseSections,
    {
      id: "imports" as const,
      title: "Imports",
      summary: "Queued import candidates derived from live source items.",
      status: importsItems.length > 0 ? worstStatus(importsItems.map((item) => item.status)) : "attention",
      emptyState: "No import candidates surfaced yet. Once Drive, Docs, Sheets, Slides, or GCS projects data, the console will derive import-ready items here.",
      items: importsItems,
    },
    healthSection,
  ];

  const sectionsWithActions = sections.map((section) => ({
    ...section,
    items: section.items.map(hydrateActions),
  }));

  const tabs = sectionsWithActions.map((section) => ({
    id: section.id,
    label: section.title,
    status: section.status,
    count: section.items.length,
  }));

  const liveConnectors = resolveWorkspaceProjectionMode() === "stub" ? 0 : 1;
  const totalItems = sectionsWithActions.reduce((sum, section) => sum + section.items.length, 0);
  const sectionsLoaded = sectionsWithActions.filter((section) => ["drive", "docs", "sheets", "slides", "gcs"].includes(section.id) && section.items.length > 0).length;
  const importableItems = importsItems.length;
  const overallStatus = worstStatus(sectionsWithActions.map((section) => section.status));

  const actions: RootWorkspaceItemAction[] = [
    {
      id: "workspace-refresh",
      label: "Refresh workspace",
      kind: "stub",
      note: "Use the page refresh button to re-run the server projection.",
    },
    {
      id: "workspace-health",
      label: "View health",
      kind: "link",
      href: "#health",
      note: "Jump to connector and projection health.",
    },
    {
      id: "workspace-imports",
      label: "View imports",
      kind: "link",
      href: "#imports",
      note: "See import-ready items derived from live source material.",
    },
  ];

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      refreshIntervalMs: ROOT_WORKSPACE_REFRESH_INTERVAL_MS,
      sourceFreshness:
        liveConnectors > 0
          ? "Server-side projections are active. Browser tokens stay out of the console."
          : "No connector is configured yet. The console is using safe fallback projections.",
      overallStatus,
      workspaceScope,
      connectorMode: resolveWorkspaceProjectionMode(),
    },
    tabs,
    connectors: healthConnectors,
    sections: sectionsWithActions,
    actions,
    summary: {
      totalItems,
      sectionsLoaded,
      liveConnectors,
      importableItems,
    },
  };
}

export async function loadRootWorkspaceDetail(options: {
  host?: string | null;
  brandHint?: string | null;
  id: string;
}): Promise<RootWorkspaceDetail> {
  const snapshot = await buildRootWorkspaceSnapshot(options);
  for (const section of snapshot.sections) {
    const found = section.items.find((item) => item.id === options.id);
    if (found) return found;
  }
  return null;
}

export function getRootWorkspaceSection(snapshot: RootWorkspaceSnapshot, id: RootWorkspaceSectionId) {
  return snapshot.sections.find((section) => section.id === id) || null;
}

export function getRootWorkspaceItem(snapshot: RootWorkspaceSnapshot, id: string) {
  for (const section of snapshot.sections) {
    const item = section.items.find((entry) => entry.id === id);
    if (item) return item;
  }
  return null;
}

export async function runRootWorkspaceSheetAction(options: {
  id: string;
  action: string;
  range?: string | null;
  host?: string | null;
  brandHint?: string | null;
}) {
  const endpoint = firstEnv(ENDPOINT_ENV_KEYS);
  const command = firstEnv(CLI_ENV_KEYS);
  const cliArgs = parseCliArgs();

  if (endpoint) {
    const response = await fetch(`${endpoint.replace(/\/$/, "")}/sheets/${encodeURIComponent(options.id)}/actions`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        action: options.action,
        range: options.range || null,
        source: "root-workspace",
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`workspace_sheet_action_http_${response.status}`);
    }
    return response.json();
  }

  if (command) {
    return {
      ok: true,
      mode: "stub",
      action: options.action,
      id: options.id,
      range: options.range || null,
      note: `Sheet actions are read-heavy and remain stubbed until the connector exposes a live write endpoint. CLI ${command} is configured for reads only.`,
      command: [command, ...cliArgs, "sheets", options.id, "actions"].join(" "),
    };
  }

  return {
    ok: true,
    mode: "stub",
    action: options.action,
    id: options.id,
    range: options.range || null,
    note: "No workspace connector is configured. The sheet action has been accepted as a stub only.",
  };
}

export async function queueRootWorkspaceImport(options: {
  kind: string;
  id: string;
  title?: string | null;
  sourceUrl?: string | null;
  scope?: RootWorkspaceScope;
}) {
  const endpoint = firstEnv(ENDPOINT_ENV_KEYS);
  if (endpoint) {
    const response = await fetch(`${endpoint.replace(/\/$/, "")}/imports`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        kind: options.kind,
        id: options.id,
        title: options.title || null,
        sourceUrl: options.sourceUrl || null,
        scope: options.scope || "shared",
        source: "root-workspace",
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`workspace_import_http_${response.status}`);
    }
    return response.json();
  }

  return {
    ok: true,
    mode: "stub",
    kind: options.kind,
    id: options.id,
    title: options.title || null,
    sourceUrl: options.sourceUrl || null,
    scope: options.scope || "shared",
    note: "No import connector is configured. The request has been accepted as a stub so the UI can stay read-heavy and honest.",
  };
}

export async function authorizeRootWorkspaceRoute(id: string) {
  return enforceRoutePolicy(
    createRoutePolicy({
      id,
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["system_config"],
      tenantBoundary: "internal_workspace",
    }),
  );
}
