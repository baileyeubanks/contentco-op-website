"use client";

import { useEffect, useEffectEvent, useState, startTransition } from "react";
import Link from "next/link";
import type {
  RootWorkspaceItem,
  RootWorkspaceSection,
  RootWorkspaceSectionId,
  RootWorkspaceSnapshot,
  RootWorkspaceStatus,
  RootWorkspaceScope,
} from "@/lib/root-workspace";
import styles from "./page.module.css";

type Selection = {
  sectionId: RootWorkspaceSectionId;
  itemId: string | null;
};

type ActionResult = {
  title: string;
  detail: string;
  tone: "healthy" | "attention" | "critical";
};

const SECTION_ORDER: RootWorkspaceSectionId[] = ["drive", "docs", "sheets", "slides", "gcs", "imports", "health"];
const SCOPE_FILTERS: Array<RootWorkspaceScope> = ["ALL", "ACS", "CC", "shared"];

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString();
}

function statusTone(status: RootWorkspaceStatus) {
  if (status === "healthy") return "healthy";
  if (status === "attention") return "attention";
  if (status === "critical") return "critical";
  return "unknown";
}

function statusLabel(status: RootWorkspaceStatus) {
  if (status === "healthy") return "healthy";
  if (status === "attention") return "attention";
  if (status === "critical") return "critical";
  return "unknown";
}

function matchesScope(itemScope: RootWorkspaceScope | undefined, filter: RootWorkspaceScope) {
  if (filter === "ALL") return true;
  const normalized = itemScope || "shared";
  if (normalized === "shared" || normalized === "ALL") return true;
  return normalized === filter;
}

function matchesSearch(item: RootWorkspaceItem, query: string) {
  if (!query) return true;
  const haystack = [
    item.title,
    item.subtitle,
    item.detail,
    item.authority,
    item.owner,
    item.mimeType,
    item.sizeLabel,
    item.sourceLabel,
    ...(item.tags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function itemKey(sectionId: RootWorkspaceSectionId, itemId: string) {
  return `${sectionId}:${itemId}`;
}

function fallbackSection(sectionId: RootWorkspaceSectionId): RootWorkspaceSection {
  return {
    id: sectionId,
    title: sectionId,
    summary: "No projected section is available.",
    status: "unknown",
    emptyState: "No workspace projection is available yet.",
    items: [],
  };
}

function sectionById(snapshot: RootWorkspaceSnapshot, sectionId: RootWorkspaceSectionId) {
  return snapshot.sections.find((section) => section.id === sectionId) || snapshot.sections[0] || fallbackSection(sectionId);
}

function firstSelectableItem(section: RootWorkspaceSection | undefined) {
  return section?.items[0] || null;
}

export function RootWorkspaceConsoleClient({
  initialSnapshot,
}: {
  initialSnapshot: RootWorkspaceSnapshot;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const initialSectionId =
    SECTION_ORDER.find((sectionId) => initialSnapshot.sections.some((section) => section.id === sectionId)) ||
    initialSnapshot.sections[0]?.id ||
    "drive";
  const [activeSectionId, setActiveSectionId] = useState<RootWorkspaceSectionId>(
    initialSectionId,
  );
  const [selection, setSelection] = useState<Selection>(() => {
    const section = initialSnapshot.sections.find((entry) => entry.id === initialSectionId) || initialSnapshot.sections[0];
    const first = firstSelectableItem(section);
    return { sectionId: section?.id || "drive", itemId: first?.id || null };
  });
  const [scopeFilter, setScopeFilter] = useState<RootWorkspaceScope>("ALL");
  const [search, setSearch] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<ActionResult | null>(null);

  async function refreshSnapshot(fresh = false) {
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      const response = await fetch(`/api/root/workspace${fresh ? "?fresh=1" : ""}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`workspace_snapshot_http_${response.status}`);
      }
      const next = (await response.json()) as RootWorkspaceSnapshot;
      startTransition(() => {
        setSnapshot(next);
        setActiveSectionId((current) =>
          next.sections.some((section) => section.id === current)
            ? current
            : (next.sections[0]?.id || "drive"),
        );
        setSelection((current) => {
          const section = next.sections.find((entry) => entry.id === current.sectionId) || next.sections[0];
          const item = section?.items.find((entry) => entry.id === current.itemId) || firstSelectableItem(section);
          return {
            sectionId: section?.id || "drive",
            itemId: item?.id || null,
          };
        });
      });
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "workspace_snapshot_failed");
    } finally {
      setIsRefreshing(false);
    }
  }

  const pollSnapshot = useEffectEvent(async () => {
    await refreshSnapshot(false);
  });

  useEffect(() => {
    const interval = window.setInterval(() => {
      void pollSnapshot();
    }, snapshot.meta.refreshIntervalMs);
    return () => window.clearInterval(interval);
  }, [snapshot.meta.refreshIntervalMs]);

  useEffect(() => {
    const section = snapshot.sections.find((entry) => entry.id === activeSectionId) || snapshot.sections[0];
    const filtered = filterItems(section?.items || [], search, scopeFilter);
    if (!section) return;
    if (!selection.itemId || !filtered.some((item) => item.id === selection.itemId)) {
      setSelection({ sectionId: section.id, itemId: filtered[0]?.id || null });
    }
  }, [activeSectionId, scopeFilter, search, selection.itemId, snapshot.sections]);

  const activeSection = sectionById(snapshot, activeSectionId);
  const filteredItems = filterItems(activeSection?.items || [], search, scopeFilter);
  const selectedItem =
    selection.itemId && selection.sectionId === activeSectionId
      ? filteredItems.find((item) => item.id === selection.itemId) || activeSection?.items.find((item) => item.id === selection.itemId) || null
      : null;

  async function runSheetAction(item: RootWorkspaceItem, action: string) {
    setActionResult(null);
    try {
      const response = await fetch(`/api/root/workspace/sheets/${encodeURIComponent(item.id)}/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload?.error || `sheet_action_http_${response.status}`));
      }
      setActionResult({
        title: `Sheet action queued`,
        detail: String(payload?.note || payload?.message || "The bounded sheet action completed as a server-side stub."),
        tone: "attention",
      });
    } catch (error) {
      setActionResult({
        title: "Sheet action failed",
        detail: error instanceof Error ? error.message : "sheet_action_failed",
        tone: "critical",
      });
    }
  }

  async function queueImport(item: RootWorkspaceItem) {
    setActionResult(null);
    try {
      const response = await fetch("/api/root/workspace/imports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: item.kind,
          id: item.id,
          title: item.title,
          sourceUrl: item.sourceUrl,
          scope: item.scope || "shared",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload?.error || `import_http_${response.status}`));
      }
      setActionResult({
        title: "Import queued",
        detail: String(payload?.note || payload?.message || "The import was accepted by the server projection layer."),
        tone: "healthy",
      });
      void refreshSnapshot(true);
    } catch (error) {
      setActionResult({
        title: "Import failed",
        detail: error instanceof Error ? error.message : "import_failed",
        tone: "critical",
      });
    }
  }

  const summaryCards = [
    { label: "sections", value: snapshot.summary.sectionsLoaded, detail: "sections currently returning files", tone: snapshot.summary.sectionsLoaded > 0 ? ("healthy" as const) : ("attention" as const) },
    { label: "files", value: snapshot.summary.totalItems, detail: "projected items across Drive, Docs, Sheets, Slides, and GCS", tone: snapshot.summary.totalItems > 0 ? ("healthy" as const) : ("attention" as const) },
    { label: "imports", value: snapshot.summary.importableItems, detail: "derived import candidates in queue", tone: snapshot.summary.importableItems > 0 ? ("healthy" as const) : ("attention" as const) },
    { label: "connectors", value: snapshot.summary.liveConnectors, detail: "live connector/projection lanes", tone: snapshot.summary.liveConnectors > 0 ? ("healthy" as const) : ("attention" as const) },
  ];

  return (
    <div className={styles.shell}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>ROOT workspace console</p>
          <h1 className={styles.title}>
            File-first Google workspace console
            <span>Drive, Docs, Sheets, Slides, GCS, Imports, Health</span>
          </h1>
          <p className={styles.subtitle}>
            Server-side projections only. The browser sees file metadata, import candidates, and connector health, not Google tokens.
          </p>
          <div className={styles.heroActions}>
            <button type="button" className={styles.primaryAction} onClick={() => void refreshSnapshot(true)} disabled={isRefreshing}>
              {isRefreshing ? "Refreshing…" : "Refresh projection"}
            </button>
            <Link href="/root/system" className={styles.secondaryAction}>
              Open system console
            </Link>
          </div>
        </div>

        <div className={styles.heroStatus}>
          <div className={styles.statusCard}>
            <span className={styles.statusLabel}>Projection state</span>
            <strong className={styles.statusValue}>{statusLabel(snapshot.meta.overallStatus)}</strong>
            <p className={styles.statusCopy}>{snapshot.meta.sourceFreshness}</p>
          </div>

          <div className={styles.metaRail}>
            <span className={styles.metaPill} data-tone={statusTone(snapshot.meta.overallStatus)}>
              overall · {statusLabel(snapshot.meta.overallStatus)}
            </span>
            <span className={styles.metaPill}>scope · {snapshot.meta.workspaceScope}</span>
            <span className={styles.metaPill}>mode · {snapshot.meta.connectorMode}</span>
            <span className={styles.metaPill}>generated · {formatTimestamp(snapshot.meta.generatedAt)}</span>
          </div>
        </div>
      </section>

      <section className={styles.summaryBand}>
        {summaryCards.map((card) => (
          <article key={card.label} className={styles.metricCard} data-tone={card.tone}>
            <span className={styles.metricLabel}>{card.label}</span>
            <strong className={styles.metricValue}>{card.value}</strong>
            <p className={styles.metricDetail}>{card.detail}</p>
          </article>
        ))}
      </section>

      {refreshError ? (
        <div className={styles.callout} data-tone="critical">
          <strong>Refresh failed</strong>
          <p>{refreshError}</p>
        </div>
      ) : null}

      <section className={styles.consoleGrid}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarSection}>
            <div className={styles.sectionTop}>
              <div>
                <p className={styles.sectionKicker}>Sections</p>
                <h2 className={styles.sectionTitle}>Workspaces and health</h2>
              </div>
            </div>

            <div className={styles.sectionList}>
              {snapshot.tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={tab.id === activeSectionId ? styles.sectionButtonActive : styles.sectionButton}
                  onClick={() => {
                    setActiveSectionId(tab.id);
                    const section = snapshot.sections.find((entry) => entry.id === tab.id) || snapshot.sections[0];
                    const filtered = filterItems(section?.items || [], search, scopeFilter);
                    setSelection({ sectionId: tab.id, itemId: filtered[0]?.id || null });
                  }}
                >
                  <span>{tab.label}</span>
                  <span className={styles.sectionCount}>{tab.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.sidebarSection}>
            <div className={styles.sectionTop}>
              <div>
                <p className={styles.sectionKicker}>Health</p>
                <h2 className={styles.sectionTitle}>Projection lanes</h2>
              </div>
            </div>
            <div className={styles.healthRail}>
              {snapshot.connectors.map((connector) => (
                <article key={connector.id} className={styles.healthCard} data-tone={connector.status}>
                  <div className={styles.healthTop}>
                    <strong>{connector.label}</strong>
                    <span className={styles.metaPill} data-tone={connector.status}>
                      {statusLabel(connector.status)}
                    </span>
                  </div>
                  <p>{connector.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </aside>

        <section className={styles.collectionPane}>
          <div className={styles.sectionTop}>
            <div>
              <p className={styles.sectionKicker}>{activeSection.title}</p>
              <h2 className={styles.sectionTitle}>{activeSection.summary}</h2>
            </div>
            <span className={styles.metaPill} data-tone={activeSection.status}>
              {statusLabel(activeSection.status)}
            </span>
          </div>

          <div className={styles.toolbar}>
            <label className={styles.searchField}>
              <span>Search</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="name, owner, mime type, tag, source, note"
              />
            </label>
            <div className={styles.scopeRow}>
              {SCOPE_FILTERS.map((scope) => (
                <button
                  key={scope}
                  type="button"
                  className={scopeFilter === scope ? styles.scopeChipActive : styles.scopeChip}
                  onClick={() => setScopeFilter(scope)}
                >
                  {scope}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.fileGrid}>
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => {
                const selected = selection.sectionId === activeSectionId && selection.itemId === item.id;
                return (
                  <button
                    key={itemKey(activeSectionId, item.id)}
                    type="button"
                    className={selected ? styles.fileCardActive : styles.fileCard}
                    onClick={() => setSelection({ sectionId: activeSectionId, itemId: item.id })}
                  >
                    <div className={styles.fileTop}>
                      <div>
                        <strong className={styles.fileTitle}>{item.title}</strong>
                        <p className={styles.fileSubtitle}>{item.subtitle}</p>
                      </div>
                      <span className={styles.metaPill} data-tone={item.status}>
                        {statusLabel(item.status)}
                      </span>
                    </div>
                    <div className={styles.fileMeta}>
                      <span>{item.authority}</span>
                      <span>{item.owner || "No owner"}</span>
                      <span>{item.updatedAt || "No timestamp"}</span>
                    </div>
                    <div className={styles.fileMeta}>
                      {item.scope ? <span>scope · {item.scope}</span> : null}
                      {item.mimeType ? <span>{item.mimeType}</span> : null}
                      {item.sizeLabel ? <span>{item.sizeLabel}</span> : null}
                    </div>
                    {item.tags.length > 0 ? (
                      <div className={styles.tagRow}>
                        {item.tags.slice(0, 4).map((tag) => (
                          <span key={tag} className={styles.tagPill}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </button>
                );
              })
            ) : (
              <div className={styles.emptyState}>
                <strong>{activeSection.emptyState}</strong>
                <p>
                  This console is read-heavy by design. When a connector is configured, the file projection will populate this section without browser-side token access.
                </p>
              </div>
            )}
          </div>
        </section>

        <aside className={styles.detailPane}>
          <div className={styles.sectionTop}>
            <div>
              <p className={styles.sectionKicker}>Detail</p>
              <h2 className={styles.sectionTitle}>{selectedItem?.title || activeSection.title}</h2>
            </div>
            <span className={styles.metaPill} data-tone={selectedItem?.status || activeSection.status}>
              {statusLabel(selectedItem?.status || activeSection.status)}
            </span>
          </div>

          {selectedItem ? (
            <div className={styles.detailCard}>
              <p className={styles.detailCopy}>{selectedItem.detail}</p>

              <div className={styles.detailRows}>
                <div className={styles.detailRow}>
                  <span>Authority</span>
                  <strong>{selectedItem.authority}</strong>
                </div>
                <div className={styles.detailRow}>
                  <span>Source</span>
                  <strong>{selectedItem.sourceLabel}</strong>
                </div>
                <div className={styles.detailRow}>
                  <span>Updated</span>
                  <strong>{selectedItem.updatedAt || "Not recorded"}</strong>
                </div>
                <div className={styles.detailRow}>
                  <span>Scope</span>
                  <strong>{selectedItem.scope || "shared"}</strong>
                </div>
                <div className={styles.detailRow}>
                  <span>Owner</span>
                  <strong>{selectedItem.owner || "No owner"}</strong>
                </div>
                <div className={styles.detailRow}>
                  <span>Type</span>
                  <strong>{selectedItem.mimeType || selectedItem.kind}</strong>
                </div>
              </div>

              {selectedItem.tags.length > 0 ? (
                <div className={styles.tagRow}>
                  {selectedItem.tags.map((tag) => (
                    <span key={tag} className={styles.tagPill}>
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className={styles.buttonRow}>
                {selectedItem.sourceUrl ? (
                  <Link href={selectedItem.sourceUrl} target="_blank" rel="noreferrer" className={styles.actionLink}>
                    Open source
                  </Link>
                ) : null}
                {selectedItem.previewUrl ? (
                  <Link href={selectedItem.previewUrl} target="_blank" rel="noreferrer" className={styles.actionLink}>
                    Preview
                  </Link>
                ) : null}
                {selectedItem.kind !== "health" ? (
                  <button type="button" className={styles.actionButton} onClick={() => void queueImport(selectedItem)}>
                    Import to Root
                  </button>
                ) : null}
                {selectedItem.kind === "sheet" ? (
                  <button type="button" className={styles.actionButton} onClick={() => void runSheetAction(selectedItem, "bounded-sheet-action")}>
                    Queue sheet action
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className={styles.detailCard}>
              <p className={styles.detailCopy}>{activeSection.emptyState}</p>
              <div className={styles.detailRows}>
                <div className={styles.detailRow}>
                  <span>Generated</span>
                  <strong>{formatTimestamp(snapshot.meta.generatedAt)}</strong>
                </div>
                <div className={styles.detailRow}>
                  <span>Mode</span>
                  <strong>{snapshot.meta.connectorMode}</strong>
                </div>
                <div className={styles.detailRow}>
                  <span>Sections loaded</span>
                  <strong>{snapshot.summary.sectionsLoaded}</strong>
                </div>
                <div className={styles.detailRow}>
                  <span>Import candidates</span>
                  <strong>{snapshot.summary.importableItems}</strong>
                </div>
              </div>
            </div>
          )}

          {actionResult ? (
            <div className={styles.callout} data-tone={actionResult.tone}>
              <strong>{actionResult.title}</strong>
              <p>{actionResult.detail}</p>
            </div>
          ) : null}

          <div className={styles.healthStack}>
            <div className={styles.sectionTop}>
              <div>
                <p className={styles.sectionKicker}>Health detail</p>
                <h2 className={styles.sectionTitle}>Server projections and policy</h2>
              </div>
            </div>

            {snapshot.connectors.map((connector) => (
              <article key={`detail-${connector.id}`} className={styles.healthCard} data-tone={connector.status}>
                <div className={styles.healthTop}>
                  <strong>{connector.label}</strong>
                  <span className={styles.metaPill} data-tone={connector.status}>
                    {statusLabel(connector.status)}
                  </span>
                </div>
                <p>{connector.detail}</p>
                <code>{connector.endpoint || connector.command || connector.kind}</code>
              </article>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}

function filterItems(items: RootWorkspaceItem[], query: string, scopeFilter: RootWorkspaceScope) {
  const normalizedQuery = query.trim().toLowerCase();
  return items.filter((item) => matchesScope(item.scope, scopeFilter) && matchesSearch(item, normalizedQuery));
}
