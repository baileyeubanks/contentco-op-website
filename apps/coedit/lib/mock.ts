export const projects = [
  { id: "p1", name: "HLSR Safety Refresh", owner: "creative", status: "in_review" },
  { id: "p2", name: "Automation Explainer Q2", owner: "account", status: "pre_production" }
];

export const assets = [
  { id: "bpms150-cutdown-v12", projectId: "p1", title: "BPMS150_Cutdown_v12", status: "in_review" },
  { id: "accuratemeter-v4", projectId: "p2", title: "AccurateMeter_v4", status: "needs_change" }
];

export const comments = [
  {
    id: "c1",
    assetId: "bpms150-cutdown-v12",
    at: "00:13",
    body: "Open with logo two frames earlier. Keep safety vest visible.",
    state: "open"
  }
];

export const approvals = [
  { gateId: "g1", assetId: "bpms150-cutdown-v12", role: "safety", decision: "open" },
  { gateId: "g2", assetId: "bpms150-cutdown-v12", role: "brand", decision: "needs_change" }
];

export const auditLog = [
  { id: "e1", assetId: "bpms150-cutdown-v12", event: "version_uploaded", at: "2026-02-24T14:02:00.000Z" },
  { id: "e2", assetId: "bpms150-cutdown-v12", event: "safety_gate_open", at: "2026-02-24T14:04:00.000Z" }
];

