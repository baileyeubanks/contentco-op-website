"use client";

import { useEffect, useEffectEvent, useState, startTransition } from "react";
import Link from "next/link";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type EdgeMouseHandler,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react";
import {
  buildSystemMapMetrics,
  getFlowPalette,
  getStatusLabel,
  getSystemMapLayoutNode,
} from "@/lib/system-map/presentation";
import type {
  SystemMapSnapshot,
  SystemMapSourceRef,
  SystemMapStatus,
} from "@/lib/system-map/contracts";
import styles from "./page.module.css";

type Selection =
  | { kind: "node"; id: string }
  | { kind: "edge"; id: string };

type ActionResult = {
  status: "ok" | "error";
  label: string;
  detail: string;
  reportPath?: string | null;
};

const FLOW_LEGEND = [
  { id: "publish", label: "publish lane" },
  { id: "data", label: "data authority" },
  { id: "message", label: "message ingress" },
  { id: "approval", label: "approval boundary" },
  { id: "continuity", label: "continuity / failover" },
] as const;

const NETWORK_RAILS = ["lan", "wan", "dns", "edge", "origin", "app", "integrations"] as const;

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

function getNodePalette(status: SystemMapStatus, isSelected: boolean) {
  const selectedShadow = isSelected
    ? "0 0 0 1px rgba(80, 214, 138, 0.3), 0 24px 60px rgba(13, 41, 25, 0.42)"
    : "0 18px 44px rgba(0, 0, 0, 0.24)";

  switch (status) {
    case "canonical":
      return {
        border: isSelected ? "rgba(104, 140, 255, 0.56)" : "rgba(104, 140, 255, 0.24)",
        background: "linear-gradient(180deg, rgba(20, 32, 58, 0.96), rgba(14, 24, 45, 0.96))",
        text: "#dae5ff",
        shadow: selectedShadow,
      };
    case "healthy":
      return {
        border: isSelected ? "rgba(82, 205, 133, 0.56)" : "rgba(82, 205, 133, 0.24)",
        background: "linear-gradient(180deg, rgba(11, 33, 22, 0.96), rgba(8, 24, 17, 0.96))",
        text: "#d7f5e2",
        shadow: selectedShadow,
      };
    case "attention":
      return {
        border: isSelected ? "rgba(232, 182, 94, 0.58)" : "rgba(232, 182, 94, 0.24)",
        background: "linear-gradient(180deg, rgba(44, 34, 17, 0.96), rgba(31, 24, 12, 0.96))",
        text: "#f6ddb1",
        shadow: selectedShadow,
      };
    case "critical":
      return {
        border: isSelected ? "rgba(223, 105, 127, 0.62)" : "rgba(223, 105, 127, 0.24)",
        background: "linear-gradient(180deg, rgba(58, 18, 30, 0.96), rgba(42, 13, 23, 0.96))",
        text: "#ffd2dc",
        shadow: selectedShadow,
      };
    case "unknown":
    default:
      return {
        border: isSelected ? "rgba(124, 140, 155, 0.52)" : "rgba(124, 140, 155, 0.18)",
        background: "linear-gradient(180deg, rgba(20, 24, 29, 0.96), rgba(13, 17, 21, 0.96))",
        text: "#dce5ec",
        shadow: selectedShadow,
      };
  }
}

function renderSourceReference(ref: SystemMapSourceRef, key: string) {
  return (
    <article key={key} className={styles.sourceCard}>
      <div className={styles.sourceHead}>
        <strong>{ref.label}</strong>
        <span className={styles.metaPill} data-tone={ref.status}>
          {getStatusLabel(ref.status)}
        </span>
      </div>
      <p>{ref.detail || ref.location}</p>
      <code>{ref.location}</code>
    </article>
  );
}

export function SystemMapClient({
  initialSnapshot,
}: {
  initialSnapshot: SystemMapSnapshot;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [selection, setSelection] = useState<Selection>({ kind: "node", id: "m4" });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<ActionResult | null>(null);

  async function refreshSnapshot(reason: "manual" | "poll") {
    if (reason === "poll" && isRefreshing) return;

    setIsRefreshing(true);
    setRefreshError(null);

    try {
      const response = await fetch(`/api/root/system-map${reason === "manual" ? "?fresh=1" : ""}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`snapshot_http_${response.status}`);
      }
      const next = (await response.json()) as SystemMapSnapshot;
      startTransition(() => {
        setSnapshot(next);
        setSelection((current) => {
          const exists =
            current.kind === "node"
              ? next.graph.nodes.some((node) => node.id === current.id)
              : next.graph.edges.some((edge) => edge.id === current.id);
          return exists ? current : { kind: "node", id: "m4" };
        });
      });
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "snapshot_refresh_failed");
    } finally {
      setIsRefreshing(false);
    }
  }

  const pollSnapshot = useEffectEvent(async () => {
    await refreshSnapshot("poll");
  });

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void pollSnapshot();
    }, snapshot.meta.refreshIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [snapshot.meta.refreshIntervalMs]);

  const metrics = buildSystemMapMetrics(snapshot);
  const networkIncident = snapshot.networkIncident || null;
  const nodeLookup = new Map(snapshot.graph.nodes.map((node) => [node.id, node]));
  const selectedNode =
    selection.kind === "node"
      ? snapshot.graph.nodes.find((node) => node.id === selection.id) || null
      : null;
  const selectedEdge =
    selection.kind === "edge"
      ? snapshot.graph.edges.find((edge) => edge.id === selection.id) || null
      : null;

  const flowNodes: Node[] = snapshot.graph.nodes.map((node) => {
    const layout = getSystemMapLayoutNode(node.id);
    const palette = getNodePalette(node.status, selection.kind === "node" && selection.id === node.id);

    return {
      id: node.id,
      position: { x: layout.x, y: layout.y },
      draggable: false,
      selectable: true,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        label: (
          <div className={styles.flowNodeBody}>
            <span className={styles.flowNodeStatus}>{getStatusLabel(node.status)}</span>
            <strong className={styles.flowNodeLabel}>{node.label}</strong>
            <span className={styles.flowNodeDetail}>{node.detail}</span>
          </div>
        ),
      },
      style: {
        width: layout.width,
        minHeight: layout.height,
        borderRadius: 26,
        border: `1px solid ${palette.border}`,
        background: palette.background,
        color: palette.text,
        boxShadow: palette.shadow,
        padding: 0,
      },
    };
  });

  const flowEdges: Edge[] = snapshot.graph.edges.map((edge) => {
    const flow = getFlowPalette(edge.flowType, edge.status);
    const isSelected = selection.kind === "edge" && selection.id === edge.id;

    return {
      id: edge.id,
      source: edge.from,
      target: edge.to,
      type: "simplebezier",
      label: edge.label,
      selectable: true,
      animated: edge.flowType === "publish" && edge.status === "healthy",
      style: {
        stroke: flow.stroke,
        strokeWidth: isSelected ? flow.width + 0.7 : flow.width,
        strokeDasharray: flow.dasharray,
        opacity: isSelected ? 1 : 0.84,
      },
      labelStyle: {
        fill: "rgba(223, 231, 236, 0.7)",
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: flow.stroke,
      },
    };
  });

  const handleNodeClick: NodeMouseHandler = (_, node) => {
    setSelection({ kind: "node", id: node.id });
  };

  const handleEdgeClick: EdgeMouseHandler = (_, edge) => {
    setSelection({ kind: "edge", id: edge.id });
  };

  async function runAction(actionId: string) {
    const action = snapshot.actions.find((item) => item.id === actionId);
    if (!action || action.kind !== "api") return;

    setActiveActionId(action.id);
    setActionResult(null);

    try {
      const response = await fetch("/api/root/system/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: action.action, scope: action.scope }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload?.error || `action_http_${response.status}`));
      }
      setActionResult({
        status: "ok",
        label: action.label,
        detail: String(payload?.stdout || "Action completed."),
        reportPath: typeof payload?.report_path === "string" ? payload.report_path : null,
      });
      void refreshSnapshot("manual");
    } catch (error) {
      setActionResult({
        status: "error",
        label: action.label,
        detail: error instanceof Error ? error.message : "action_failed",
      });
    } finally {
      setActiveActionId(null);
    }
  }

  return (
    <div className={styles.shell}>
      <section className={styles.hero}>
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Blaze System Map V2</p>
            <h1 className={styles.title}>
              See <span>Blaze</span> as one live system.
            </h1>
            <p className={styles.subtitle}>
              Runtime proof, public-surface health, authority boundaries, message lanes, and deploy
              evidence stay on one surface. No side rail. No broken operator shell. No false green.
            </p>
            <div className={styles.heroActions}>
              <button
                type="button"
                className={styles.primaryAction}
                onClick={() => void refreshSnapshot("manual")}
                disabled={isRefreshing}
              >
                {isRefreshing ? "Refreshing…" : "Refresh now"}
              </button>
              <Link href="/root/system" className={styles.secondaryAction}>
                Open system console
              </Link>
            </div>
          </div>

          <div className={styles.heroStatus}>
            <div className={styles.statusCard}>
              <span className={styles.statusLabel}>System state</span>
              <strong className={styles.statusValue}>{getStatusLabel(snapshot.meta.overallStatus)}</strong>
              <p className={styles.statusCopy}>{snapshot.meta.sourceFreshness}</p>
            </div>
            <div className={styles.metaRail}>
              <span className={styles.metaPill} data-tone={snapshot.meta.overallStatus}>
                overall · {getStatusLabel(snapshot.meta.overallStatus)}
              </span>
              <span className={styles.metaPill}>
                generated · {formatTimestamp(snapshot.meta.generatedAt)}
              </span>
              <span className={styles.metaPill}>
                refresh · {Math.round(snapshot.meta.refreshIntervalMs / 1000)}s
              </span>
            </div>
          </div>
        </div>

        <div className={styles.metricsBand}>
          {metrics.map((metric) => (
            <article key={metric.id} className={styles.metricStat} data-tone={metric.status}>
              <span className={styles.metricLabel}>{metric.label}</span>
              <strong className={styles.metricValue}>{metric.value}</strong>
            </article>
          ))}
        </div>
      </section>

      {refreshError ? (
        <div className={styles.callout} data-tone="critical">
          <strong>Refresh failed</strong>
          <p>{refreshError}</p>
        </div>
      ) : null}

      {networkIncident ? (
        <section className={styles.continuitySection}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.eyebrow}>Continuity</p>
              <h2 className={styles.sectionTitle}>Classify the break before touching runtime.</h2>
            </div>
            <p className={styles.sectionDetail}>
              The continuity rail keeps LAN, WAN, DNS, edge, origin, app, and integrations separate
              so no operator has to guess whether the internet is actually down.
            </p>
          </div>

          <div className={styles.metaRail}>
            <span className={styles.metaPill} data-tone={networkIncident.overallSeverity}>
              overall · {getStatusLabel(networkIncident.overallSeverity)}
            </span>
            <span className={styles.metaPill}>
              primary · {networkIncident.primaryPlane === "none" ? "none" : networkIncident.primaryPlane}
            </span>
            <span className={styles.metaPill}>
              checked · {formatTimestamp(networkIncident.checkedAt)}
            </span>
          </div>

          <div className={styles.continuityGrid}>
            {NETWORK_RAILS.map((railId) => {
              const plane = networkIncident.planes[railId];
              return (
                <article key={plane.id} className={styles.continuityCard} data-tone={plane.status}>
                  <div className={styles.checkTop}>
                    <strong>{plane.id.toUpperCase()}</strong>
                    <span className={styles.metaPill} data-tone={plane.status}>
                      {getStatusLabel(plane.status)}
                    </span>
                  </div>
                  <p>{plane.summary}</p>
                  {plane.dominantSuspect ? (
                    <p className={styles.panelDetail}>Dominant suspect: {plane.dominantSuspect}</p>
                  ) : null}
                  {plane.nextCommand ? <code>{plane.nextCommand}</code> : null}
                </article>
              );
            })}
          </div>

          {networkIncident.recommendedActions.length > 0 ? (
            <div className={styles.callout} data-tone={networkIncident.overallSeverity}>
              <strong>Recommended next move</strong>
              <ul className={styles.recommendationList}>
                {networkIncident.recommendedActions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className={styles.graphSection}>
        <div className={styles.sectionIntro}>
          <div>
            <p className={styles.eyebrow}>Runtime graph</p>
            <h2 className={styles.sectionTitle}>Authority, runtime, and proof on one canvas.</h2>
          </div>
          <p className={styles.sectionDetail}>
            Publish, intake, data, approval, message, and continuity edges stay on the same surface
            so the operator can read the system as one object.
          </p>
        </div>

        <div className={styles.legendRow}>
          {FLOW_LEGEND.map((item) => (
            <span key={item.id} className={styles.legendPill}>
              {item.label}
            </span>
          ))}
        </div>

        <div className={styles.graphWrap}>
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            fitView
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            proOptions={{ hideAttribution: true }}
            defaultViewport={{ x: -18, y: -18, zoom: 0.76 }}
            minZoom={0.48}
            maxZoom={1.4}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={18}
              size={1.2}
              color="rgba(26, 121, 72, 0.16)"
            />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </section>

      <section className={styles.focusSection}>
        <div className={styles.sectionIntro}>
          <div>
            <p className={styles.eyebrow}>Selection</p>
            <h2 className={styles.sectionTitle}>
              {selectedNode?.label || selectedEdge?.label || "Nothing selected"}
            </h2>
          </div>
          <span
            className={styles.metaPill}
            data-tone={selectedNode?.status || selectedEdge?.status || "unknown"}
          >
            {getStatusLabel(selectedNode?.status || selectedEdge?.status || "unknown")}
          </span>
        </div>

        {selectedNode ? (
          <div className={styles.focusBody}>
            <div className={styles.focusSummary}>
              <div className={styles.entityMeta}>
                <span>{selectedNode.kind}</span>
                <span>{selectedNode.authorityLevel}</span>
              </div>
              <p className={styles.bodyCopy}>{selectedNode.detail}</p>
            </div>
            <div className={styles.sourceGrid}>
              {selectedNode.sourceRefs.map((ref) =>
                renderSourceReference(ref, `${selectedNode.id}-${ref.location}`),
              )}
            </div>
          </div>
        ) : null}

        {selectedEdge ? (
          <div className={styles.focusBody}>
            <div className={styles.focusSummary}>
              <div className={styles.entityMeta}>
                <span>{selectedEdge.flowType}</span>
                <span>{selectedEdge.direction.replace("_", " ")}</span>
              </div>
              <p className={styles.bodyCopy}>
                {nodeLookup.get(selectedEdge.from)?.label || selectedEdge.from} →{" "}
                {nodeLookup.get(selectedEdge.to)?.label || selectedEdge.to}
              </p>
            </div>
            <div className={styles.sourceGrid}>
              <article className={styles.sourceCard}>
                <div className={styles.sourceHead}>
                  <strong>Flow meaning</strong>
                  <span className={styles.metaPill} data-tone={selectedEdge.status}>
                    {getStatusLabel(selectedEdge.status)}
                  </span>
                </div>
                <p>{selectedEdge.label}</p>
                <code>{selectedEdge.from} → {selectedEdge.to}</code>
              </article>
            </div>
          </div>
        ) : null}
      </section>

      <section className={styles.actionsSection}>
        <div className={styles.sectionIntro}>
          <div>
            <p className={styles.eyebrow}>Actions</p>
            <h2 className={styles.sectionTitle}>Safe operator controls</h2>
          </div>
          <p className={styles.sectionDetail}>
            The map can re-run checks and open evidence, but restart and log-tail flows stay in the
            narrower system console.
          </p>
        </div>

        <div className={styles.actionGrid}>
          {snapshot.actions.map((action) =>
            action.kind === "api" ? (
              <button
                key={action.id}
                type="button"
                className={styles.actionButton}
                disabled={activeActionId === action.id}
                onClick={() => void runAction(action.id)}
              >
                <strong>{action.label}</strong>
                <span>{activeActionId === action.id ? "Running…" : action.description}</span>
              </button>
            ) : (
              <Link key={action.id} href={action.href} className={styles.actionLink}>
                <strong>{action.label}</strong>
                <span>{action.description}</span>
              </Link>
            ),
          )}
        </div>

        {actionResult ? (
          <div className={styles.callout} data-tone={actionResult.status === "ok" ? "healthy" : "critical"}>
            <strong>{actionResult.label}</strong>
            <p>{actionResult.detail}</p>
            {actionResult.reportPath ? <code>{actionResult.reportPath}</code> : null}
          </div>
        ) : null}
      </section>

      <section className={styles.conflictSection}>
        <div className={styles.sectionIntro}>
          <div>
            <p className={styles.eyebrow}>Proof gaps</p>
            <h2 className={styles.sectionTitle}>Conflicts stay exposed until they are proven down.</h2>
          </div>
          <p className={styles.sectionDetail}>
            Contradictory docs, stale claims, or runtime mismatches should be visible here instead
            of being normalized into false confidence.
          </p>
        </div>

        {snapshot.conflicts.length > 0 ? (
          <div className={styles.conflictGrid}>
            {snapshot.conflicts.map((conflict) => (
              <article key={conflict.id} className={styles.conflictCard} data-tone={conflict.severity}>
                <strong>{conflict.title}</strong>
                <p>{conflict.detail}</p>
                {conflict.sourceRefs?.length ? (
                  <div className={styles.conflictSources}>
                    {conflict.sourceRefs.map((ref) =>
                      renderSourceReference(ref, `${conflict.id}-${ref.location}`),
                    )}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.callout} data-tone="healthy">
            <strong>No active source conflicts</strong>
            <p>Runtime authority and live proof are aligned in the current snapshot.</p>
          </div>
        )}
      </section>

      <section className={styles.checkSection}>
        <div className={styles.sectionIntro}>
          <div>
            <p className={styles.eyebrow}>Audit feed</p>
            <h2 className={styles.sectionTitle}>Normalized checks and endpoint evidence.</h2>
          </div>
          <p className={styles.sectionDetail}>
            The route is driven by real collectors and endpoint probes, not a static architecture
            poster.
          </p>
        </div>

        <div className={styles.checkGrid}>
          {snapshot.checks.map((check) => (
            <article key={check.id} className={styles.checkCard} data-tone={check.status}>
              <div className={styles.checkTop}>
                <strong>{check.label}</strong>
                <span className={styles.metaPill} data-tone={check.status}>
                  {getStatusLabel(check.status)}
                </span>
              </div>
              <p>{check.detail}</p>
              <code>{check.source}</code>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.panelsSection}>
        {snapshot.panels.map((panel) => (
          <article key={panel.id} className={styles.panelBand}>
            <div className={styles.sectionIntro}>
              <div>
                <p className={styles.eyebrow}>{panel.title}</p>
                <h2 className={styles.sectionTitle}>{panel.summary}</h2>
              </div>
            </div>

            <div className={styles.panelItems}>
              {panel.items.map((item) => (
                <article key={item.id} className={styles.panelItem} data-tone={item.status}>
                  <div className={styles.itemTop}>
                    <strong>{item.title}</strong>
                    <span className={styles.metaPill} data-tone={item.status}>
                      {getStatusLabel(item.status)}
                    </span>
                  </div>
                  <p className={styles.panelSummary}>{item.summary}</p>
                  {item.detail ? <p className={styles.panelDetail}>{item.detail}</p> : null}
                  {item.sourceRefs?.length ? (
                    <div className={styles.itemSourceList}>
                      {item.sourceRefs.slice(0, 2).map((ref) => (
                        <span key={`${item.id}-${ref.location}`} className={styles.sourceToken}>
                          {ref.label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {item.href ? (
                    <Link href={item.href} className={styles.inlineLink}>
                      {item.href}
                    </Link>
                  ) : null}
                </article>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
