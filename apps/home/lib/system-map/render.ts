import {
  buildSystemMapMetrics,
  getFlowPalette,
  getStatusLabel,
  getStatusPalette,
  getSystemMapLayoutNode,
} from "./presentation";
import type { SystemMapSnapshot } from "./contracts";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderGraph(snapshot: SystemMapSnapshot) {
  const edgeGraphics = snapshot.graph.edges
    .map((edge) => {
      const from = getSystemMapLayoutNode(edge.from);
      const to = getSystemMapLayoutNode(edge.to);
      const flow = getFlowPalette(edge.flowType, edge.status);
      const startX = from.x + from.width;
      const startY = from.y + from.height / 2;
      const endX = to.x;
      const endY = to.y + to.height / 2;
      const controlX = startX + (endX - startX) / 2;
      const labelX = startX + (endX - startX) / 2;
      const labelY = startY + (endY - startY) / 2 - 10;
      const markerId = `marker-${edge.id}`;
      return `
        <defs>
          <marker id="${markerId}" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill="${flow.stroke}" />
          </marker>
        </defs>
        <path
          d="M ${startX} ${startY} C ${controlX} ${startY}, ${controlX} ${endY}, ${endX} ${endY}"
          fill="none"
          stroke="${flow.stroke}"
          stroke-width="${flow.width}"
          stroke-dasharray="${flow.dasharray}"
          marker-end="url(#${markerId})"
          opacity="0.92"
        />
        <text x="${labelX}" y="${labelY}" fill="rgba(237, 243, 251, 0.62)" font-size="11" letter-spacing="0.1em" text-anchor="middle" text-transform="uppercase">
          ${escapeHtml(edge.label)}
        </text>
      `;
    })
    .join("");

  const nodes = snapshot.graph.nodes
    .map((node) => {
      const layout = getSystemMapLayoutNode(node.id);
      const palette = getStatusPalette(node.status);
      return `
        <article
          class="map-node"
          style="
            left:${layout.x}px;
            top:${layout.y}px;
            width:${layout.width}px;
            height:${layout.height}px;
            border-color:${palette.border};
            background:${palette.background};
            box-shadow:0 18px 44px ${palette.glow};
          "
        >
          <span class="map-node__status" style="color:${palette.text}">${escapeHtml(getStatusLabel(node.status))}</span>
          <strong class="map-node__label">${escapeHtml(node.label)}</strong>
          <p class="map-node__detail">${escapeHtml(node.detail)}</p>
        </article>
      `;
    })
    .join("");

  return `
    <section class="graph-shell">
      <div class="graph-heading">
        <div>
          <p class="eyebrow">Live topology</p>
          <h2>Authority, runtime, lanes, and public surfaces.</h2>
        </div>
        <p class="graph-note">This export is read-only. The live route at <code>/os/system/map</code> auto-refreshes every 60 seconds.</p>
      </div>
      <div class="graph-canvas">
        <svg class="graph-lines" viewBox="0 0 1280 820" preserveAspectRatio="none" aria-hidden="true">
          ${edgeGraphics}
        </svg>
        ${nodes}
      </div>
    </section>
  `;
}

function renderPanels(snapshot: SystemMapSnapshot) {
  return snapshot.panels
    .map((panel) => `
      <section class="panel">
        <div class="panel__header">
          <div>
            <p class="eyebrow">${escapeHtml(panel.title)}</p>
            <h3>${escapeHtml(panel.summary)}</h3>
          </div>
        </div>
        <div class="panel__items">
          ${panel.items
            .map((item) => {
              const palette = getStatusPalette(item.status);
              return `
                <article class="panel-item" style="border-color:${palette.border};background:${palette.background}">
                  <div class="panel-item__top">
                    <strong>${escapeHtml(item.title)}</strong>
                    <span class="panel-item__pill" style="border-color:${palette.border};color:${palette.text}">${escapeHtml(getStatusLabel(item.status))}</span>
                  </div>
                  <p class="panel-item__summary">${escapeHtml(item.summary)}</p>
                  ${item.detail ? `<p class="panel-item__detail">${escapeHtml(item.detail)}</p>` : ""}
                  ${item.href ? `<p class="panel-item__href">${escapeHtml(item.href)}</p>` : ""}
                  ${
                    item.sourceRefs && item.sourceRefs.length > 0
                      ? `<ul class="panel-item__sources">${item.sourceRefs
                          .slice(0, 3)
                          .map((ref) => `<li>${escapeHtml(ref.label)} · ${escapeHtml(ref.location)}</li>`)
                          .join("")}</ul>`
                      : ""
                  }
                </article>
              `;
            })
            .join("")}
        </div>
      </section>
    `)
    .join("");
}

function renderConflicts(snapshot: SystemMapSnapshot) {
  if (snapshot.conflicts.length === 0) {
    return `
      <section class="conflicts">
        <div class="conflict conflict--healthy">
          <strong>No live source conflicts</strong>
          <p>Authority and runtime sources are aligned in this export.</p>
        </div>
      </section>
    `;
  }

  return `
    <section class="conflicts">
      ${snapshot.conflicts
        .map((conflict) => {
          const palette = getStatusPalette(conflict.severity);
          return `
            <article class="conflict" style="border-color:${palette.border};background:${palette.background}">
              <strong>${escapeHtml(conflict.title)}</strong>
              <p>${escapeHtml(conflict.detail)}</p>
              <ul>
                ${conflict.sourceRefs
                  .map((ref) => `<li>${escapeHtml(ref.label)} · ${escapeHtml(ref.location)}</li>`)
                  .join("")}
              </ul>
            </article>
          `;
        })
        .join("")}
    </section>
  `;
}

export function renderSystemMapHtml(snapshot: SystemMapSnapshot): string {
  const metrics = buildSystemMapMetrics(snapshot);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Blaze System State</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #070a12;
        --panel: rgba(13, 18, 28, 0.84);
        --panel-soft: rgba(255,255,255,0.04);
        --line: rgba(214, 223, 234, 0.08);
        --ink: #edf3fb;
        --muted: rgba(237, 243, 251, 0.68);
        --accent: #5d88ff;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "SF Pro Display", "Inter", "Helvetica Neue", sans-serif;
        background:
          radial-gradient(circle at top right, rgba(93,136,255,0.18), transparent 34%),
          radial-gradient(circle at bottom left, rgba(78,198,144,0.08), transparent 32%),
          var(--bg);
        color: var(--ink);
      }
      main {
        width: min(1500px, calc(100vw - 48px));
        margin: 0 auto;
        padding: 28px 0 40px;
      }
      .hero {
        display: grid;
        gap: 18px;
        padding: 28px;
        border-radius: 28px;
        border: 1px solid rgba(93,136,255,0.18);
        background:
          radial-gradient(circle at top right, rgba(93,136,255,0.18), transparent 38%),
          linear-gradient(180deg, rgba(10,14,24,0.96), rgba(10,14,24,0.86));
        box-shadow: 0 28px 88px rgba(0,0,0,0.28);
      }
      .hero__top {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        align-items: flex-start;
        flex-wrap: wrap;
      }
      .eyebrow {
        margin: 0;
        color: rgba(237,243,251,0.58);
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }
      h1 {
        margin: 10px 0 0;
        max-width: 14ch;
        font-size: clamp(2.7rem, 6vw, 4.8rem);
        line-height: 0.94;
        letter-spacing: -0.06em;
      }
      h2, h3, h4 {
        margin: 6px 0 0;
        line-height: 1.02;
        letter-spacing: -0.04em;
      }
      .hero__copy {
        max-width: 68ch;
        color: rgba(237,243,251,0.78);
        line-height: 1.66;
      }
      .hero__meta {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        min-height: 34px;
        padding: 0.56rem 0.82rem;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.04);
        font-size: 0.82rem;
      }
      .metrics {
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(6, minmax(0, 1fr));
      }
      .metric {
        display: grid;
        gap: 8px;
        padding: 16px;
        border-radius: 18px;
        border: 1px solid var(--line);
        background: var(--panel);
      }
      .metric strong {
        font-size: 1.9rem;
        letter-spacing: -0.05em;
      }
      .layout {
        display: grid;
        gap: 18px;
        grid-template-columns: minmax(0, 1.7fr) minmax(320px, 0.9fr);
        align-items: start;
        margin-top: 18px;
      }
      .graph-shell,
      .panel,
      .conflicts {
        border-radius: 24px;
        border: 1px solid var(--line);
        background: var(--panel);
      }
      .graph-shell {
        padding: 20px;
      }
      .graph-heading {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
        margin-bottom: 16px;
      }
      .graph-note {
        max-width: 28ch;
        color: var(--muted);
        line-height: 1.5;
      }
      .graph-canvas {
        position: relative;
        min-height: 820px;
        overflow: hidden;
        border-radius: 20px;
        border: 1px solid rgba(255,255,255,0.06);
        background:
          linear-gradient(180deg, rgba(255,255,255,0.02), transparent),
          rgba(7,10,18,0.92);
      }
      .graph-lines {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }
      .map-node {
        position: absolute;
        display: grid;
        gap: 8px;
        padding: 14px;
        border-radius: 18px;
        border: 1px solid var(--line);
      }
      .map-node__status {
        font-size: 0.7rem;
        font-weight: 800;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }
      .map-node__label {
        font-size: 1rem;
        letter-spacing: -0.02em;
      }
      .map-node__detail {
        margin: 0;
        color: var(--muted);
        font-size: 0.82rem;
        line-height: 1.45;
      }
      .sidebar {
        display: grid;
        gap: 18px;
      }
      .panel {
        padding: 18px;
      }
      .panel__items {
        display: grid;
        gap: 12px;
        margin-top: 14px;
      }
      .panel-item {
        display: grid;
        gap: 8px;
        padding: 14px;
        border-radius: 16px;
        border: 1px solid var(--line);
      }
      .panel-item__top {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        align-items: center;
      }
      .panel-item__pill {
        display: inline-flex;
        align-items: center;
        padding: 0.34rem 0.56rem;
        border-radius: 999px;
        border: 1px solid var(--line);
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .panel-item__summary,
      .panel-item__detail,
      .panel-item__href,
      .conflict p,
      .conflict li {
        margin: 0;
        color: var(--muted);
        line-height: 1.55;
      }
      .panel-item__href {
        color: #b9c7ff;
      }
      .panel-item__sources,
      .conflict ul {
        margin: 0;
        padding-left: 1rem;
        display: grid;
        gap: 4px;
      }
      .conflicts {
        display: grid;
        gap: 12px;
        padding: 18px;
        margin-top: 18px;
      }
      .conflict {
        display: grid;
        gap: 8px;
        padding: 14px;
        border-radius: 16px;
        border: 1px solid var(--line);
      }
      .conflict--healthy {
        background: rgba(21,52,42,0.78);
        border-color: rgba(86,198,139,0.26);
      }
      @media (max-width: 1180px) {
        .layout,
        .metrics {
          grid-template-columns: 1fr;
        }
        .graph-canvas {
          overflow: auto;
        }
        .graph-lines {
          width: 1280px;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <div class="hero__top">
          <div>
            <p class="eyebrow">Blaze System State</p>
            <h1>Live authority, runtime, and proof map.</h1>
          </div>
          <div class="hero__meta">
            <span class="pill">generated · ${escapeHtml(snapshot.meta.generatedAt)}</span>
            <span class="pill">refresh · ${Math.round(snapshot.meta.refreshIntervalMs / 1000)}s</span>
            <span class="pill">overall · ${escapeHtml(getStatusLabel(snapshot.meta.overallStatus))}</span>
          </div>
        </div>
        <p class="hero__copy">${escapeHtml(snapshot.meta.sourceFreshness)}</p>
      </section>

      <section class="metrics">
        ${metrics
          .map((metric) => {
            const palette = getStatusPalette(metric.status);
            return `
              <article class="metric" style="border-color:${palette.border};background:${palette.background}">
                <span class="eyebrow">${escapeHtml(metric.label)}</span>
                <strong>${escapeHtml(metric.value)}</strong>
              </article>
            `;
          })
          .join("")}
      </section>

      <section class="layout">
        ${renderGraph(snapshot)}
        <div class="sidebar">${renderPanels(snapshot)}</div>
      </section>
      ${renderConflicts(snapshot)}
    </main>
  </body>
</html>`;
}
