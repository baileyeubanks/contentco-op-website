import type { SystemMapSnapshot, SystemMapStatus } from "./contracts";

export type SystemMapLayoutNode = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SystemMapMetric = {
  id: string;
  label: string;
  value: string;
  status: SystemMapStatus;
};

const NODE_WIDTH = 188;
const NODE_HEIGHT = 104;

export const SYSTEM_MAP_LAYOUT: Record<string, SystemMapLayoutNode> = {
  bailey: { id: "bailey", x: 24, y: 32, width: NODE_WIDTH, height: NODE_HEIGHT },
  caio: { id: "caio", x: 24, y: 164, width: NODE_WIDTH, height: NODE_HEIGHT },
  "blaze-hermes": { id: "blaze-hermes", x: 272, y: 32, width: NODE_WIDTH, height: NODE_HEIGHT },
  root: { id: "root", x: 520, y: 32, width: NODE_WIDTH, height: NODE_HEIGHT },
  paperclip: { id: "paperclip", x: 768, y: 32, width: NODE_WIDTH, height: NODE_HEIGHT },
  m2: { id: "m2", x: 272, y: 212, width: NODE_WIDTH, height: NODE_HEIGHT },
  m4: { id: "m4", x: 520, y: 212, width: NODE_WIDTH, height: NODE_HEIGHT },
  "blaze-phone": { id: "blaze-phone", x: 768, y: 212, width: NODE_WIDTH, height: NODE_HEIGHT },
  supabase: { id: "supabase", x: 520, y: 392, width: NODE_WIDTH, height: NODE_HEIGHT },
  nas: { id: "nas", x: 768, y: 392, width: NODE_WIDTH, height: NODE_HEIGHT },
  imessage: { id: "imessage", x: 272, y: 572, width: NODE_WIDTH, height: NODE_HEIGHT },
  gmail: { id: "gmail", x: 520, y: 572, width: NODE_WIDTH, height: NODE_HEIGHT },
  telegram: { id: "telegram", x: 768, y: 572, width: NODE_WIDTH, height: NODE_HEIGHT },
  "cco-home": { id: "cco-home", x: 1058, y: 24, width: NODE_WIDTH, height: NODE_HEIGHT },
  "root-mount": { id: "root-mount", x: 1058, y: 156, width: NODE_WIDTH, height: NODE_HEIGHT },
  acs: { id: "acs", x: 1058, y: 288, width: NODE_WIDTH, height: NODE_HEIGHT },
  coscript: { id: "coscript", x: 1058, y: 420, width: NODE_WIDTH, height: NODE_HEIGHT },
  cocut: { id: "cocut", x: 1058, y: 552, width: NODE_WIDTH, height: NODE_HEIGHT },
  codeliver: { id: "codeliver", x: 1058, y: 684, width: NODE_WIDTH, height: NODE_HEIGHT },
};

export function getSystemMapLayoutNode(id: string): SystemMapLayoutNode {
  return SYSTEM_MAP_LAYOUT[id] || { id, x: 24, y: 24, width: NODE_WIDTH, height: NODE_HEIGHT };
}

export function getStatusLabel(status: SystemMapStatus) {
  if (status === "canonical") return "canonical";
  if (status === "healthy") return "healthy";
  if (status === "attention") return "attention";
  if (status === "critical") return "critical";
  return "unknown";
}

export function getStatusPalette(status: SystemMapStatus) {
  switch (status) {
    case "canonical":
      return {
        border: "rgba(108, 146, 255, 0.34)",
        background: "rgba(34, 48, 90, 0.72)",
        glow: "rgba(84, 124, 255, 0.18)",
        text: "#c8d4ff",
      };
    case "healthy":
      return {
        border: "rgba(86, 198, 139, 0.34)",
        background: "rgba(21, 52, 42, 0.76)",
        glow: "rgba(86, 198, 139, 0.16)",
        text: "#b9efd0",
      };
    case "attention":
      return {
        border: "rgba(228, 180, 103, 0.34)",
        background: "rgba(70, 51, 20, 0.76)",
        glow: "rgba(228, 180, 103, 0.14)",
        text: "#f4d7a6",
      };
    case "critical":
      return {
        border: "rgba(221, 107, 107, 0.36)",
        background: "rgba(77, 27, 35, 0.8)",
        glow: "rgba(221, 107, 107, 0.18)",
        text: "#ffc5c5",
      };
    case "unknown":
    default:
      return {
        border: "rgba(181, 192, 205, 0.22)",
        background: "rgba(24, 28, 36, 0.72)",
        glow: "rgba(181, 192, 205, 0.1)",
        text: "#dbe4ef",
      };
  }
}

export function getFlowPalette(flowType: string, status: SystemMapStatus) {
  const palette = getStatusPalette(status);

  switch (flowType) {
    case "publish":
      return { stroke: palette.border.replace("0.34", "0.9"), dasharray: "", width: 2.4 };
    case "approval":
      return { stroke: palette.border.replace("0.34", "0.82"), dasharray: "6 6", width: 1.8 };
    case "continuity":
      return { stroke: palette.border.replace("0.34", "0.88"), dasharray: "12 6", width: 2 };
    case "message":
      return { stroke: palette.border.replace("0.34", "0.78"), dasharray: "4 8", width: 1.7 };
    case "support":
      return { stroke: palette.border.replace("0.34", "0.74"), dasharray: "3 7", width: 1.5 };
    case "data":
    default:
      return { stroke: palette.border.replace("0.34", "0.84"), dasharray: "", width: 1.9 };
  }
}

export function buildSystemMapMetrics(snapshot: SystemMapSnapshot): SystemMapMetric[] {
  const healthyChecks = snapshot.checks.filter((check) => check.status === "healthy").length;
  const attentionChecks = snapshot.checks.filter((check) => check.status === "attention").length;
  const criticalChecks = snapshot.checks.filter((check) => check.status === "critical").length;
  const surfaceCount = snapshot.graph.nodes.filter((node) => node.kind === "surface").length;

  return [
    {
      id: "overall-status",
      label: "overall status",
      value: getStatusLabel(snapshot.meta.overallStatus),
      status: snapshot.meta.overallStatus,
    },
    {
      id: "surfaces",
      label: "live surfaces",
      value: String(surfaceCount),
      status: "canonical",
    },
    {
      id: "checks-healthy",
      label: "healthy checks",
      value: String(healthyChecks),
      status: "healthy",
    },
    {
      id: "checks-attention",
      label: "attention checks",
      value: String(attentionChecks),
      status: attentionChecks > 0 ? "attention" : "healthy",
    },
    {
      id: "checks-critical",
      label: "critical checks",
      value: String(criticalChecks),
      status: criticalChecks > 0 ? "critical" : "healthy",
    },
    {
      id: "conflicts",
      label: "conflicts",
      value: String(snapshot.conflicts.length),
      status: snapshot.conflicts.length > 0 ? "attention" : "healthy",
    },
  ];
}
