export type SystemMapStatus =
  | "canonical"
  | "healthy"
  | "attention"
  | "critical"
  | "unknown";

export type SystemMapNodeKind =
  | "human"
  | "persona"
  | "control"
  | "subsystem"
  | "machine"
  | "truth"
  | "support"
  | "surface"
  | "lane";

export type SystemMapAuthorityLevel =
  | "human"
  | "operator"
  | "control_plane"
  | "runtime"
  | "truth"
  | "support"
  | "archive";

export type SystemMapFlowType =
  | "publish"
  | "intake"
  | "data"
  | "message"
  | "approval"
  | "continuity"
  | "support";

export type SystemMapDirection = "one_way" | "two_way";

export type SystemMapSourceRef = {
  label: string;
  location: string;
  status: SystemMapStatus;
  detail?: string;
};

export type SystemMapNode = {
  id: string;
  label: string;
  kind: SystemMapNodeKind;
  status: SystemMapStatus;
  authorityLevel: SystemMapAuthorityLevel;
  detail: string;
  sourceRefs: SystemMapSourceRef[];
};

export type SystemMapEdge = {
  id: string;
  from: string;
  to: string;
  flowType: SystemMapFlowType;
  status: SystemMapStatus;
  label: string;
  direction: SystemMapDirection;
};

export type SystemMapCheck = {
  id: string;
  group: string;
  label: string;
  status: Exclude<SystemMapStatus, "canonical">;
  detail: string;
  source: string;
};

export type SystemMapConflict = {
  id: string;
  title: string;
  severity: Extract<SystemMapStatus, "attention" | "critical">;
  detail: string;
  sourceRefs: SystemMapSourceRef[];
};

export type SystemMapPanelItem = {
  id: string;
  title: string;
  status: SystemMapStatus;
  summary: string;
  detail?: string;
  href?: string;
  sourceRefs?: SystemMapSourceRef[];
};

export type SystemMapPanel = {
  id: string;
  title: string;
  summary: string;
  items: SystemMapPanelItem[];
};

export type NetworkPlaneId =
  | "lan"
  | "wan"
  | "dns"
  | "edge"
  | "origin"
  | "app"
  | "integrations";

export type NetworkIncidentEvidence = {
  id: string;
  plane: NetworkPlaneId;
  status: Exclude<SystemMapStatus, "canonical">;
  label: string;
  detail: string;
  source?: string;
};

export type NetworkIncidentSuspect = {
  id: string;
  plane: NetworkPlaneId;
  severity: Extract<SystemMapStatus, "attention" | "critical">;
  label: string;
  detail: string;
};

export type NetworkIncidentPlane = {
  id: NetworkPlaneId;
  status: Exclude<SystemMapStatus, "canonical">;
  summary: string;
  dominantSuspect?: string;
  lastFailureAt?: string | null;
  nextCommand?: string | null;
};

export type NetworkIncidentArtifact = {
  id: string;
  label: string;
  path: string;
};

export type NetworkIncidentPack = {
  checkedAt: string;
  overallSeverity: Exclude<SystemMapStatus, "canonical">;
  primaryPlane: NetworkPlaneId | "none";
  planes: Record<NetworkPlaneId, NetworkIncidentPlane>;
  suspects: NetworkIncidentSuspect[];
  evidence: NetworkIncidentEvidence[];
  recommendedActions: string[];
  rawMetrics: Record<string, unknown>;
  artifacts?: NetworkIncidentArtifact[];
};

export type SystemMapAction =
  | {
      id: string;
      kind: "api";
      label: string;
      description: string;
      action: "env" | "status" | "health" | "audit" | "network-doctor" | "publish-alignment" | "public-sites";
      scope: "full" | "home" | "acs" | "root";
    }
  | {
      id: string;
      kind: "link";
      label: string;
      description: string;
      href: string;
  };

export type SystemMapSnapshot = {
  meta: {
    generatedAt: string;
    refreshIntervalMs: number;
    sourceFreshness: string;
    overallStatus: SystemMapStatus;
  };
  graph: {
    nodes: SystemMapNode[];
    edges: SystemMapEdge[];
  };
  panels: SystemMapPanel[];
  checks: SystemMapCheck[];
  conflicts: SystemMapConflict[];
  actions: SystemMapAction[];
  networkIncident?: NetworkIncidentPack | null;
};

export type SystemMapAuditReport = {
  name: string;
  surface: string;
  severity: "healthy" | "attention" | "critical";
  summary: string;
  checks: SystemMapCheck[];
};
