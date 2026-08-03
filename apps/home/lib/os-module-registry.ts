import { resolveOsBrand, type OsBrandKey } from "@/lib/os-brand";

export type RootModuleEngine =
  | "control"
  | "contact"
  | "commercial"
  | "operations"
  | "intelligence"
  | "marketing"
  | "creative";

export type RootModuleTier = "core" | "advanced" | "hidden";

export type RootModuleId =
  | "overview"
  | "dispatch"
  | "quotes"
  | "contacts"
  | "invoices"
  | "finance"
  | "marketing"
  | "work-claims"
  | "workspace"
  | "goals"
  | "agents"
  | "system"
  | "lab"
  | "co-script"
  | "co-cut"
  | "co-deliver";

export type RootModuleDef = {
  id: RootModuleId;
  label: string;
  href: string;
  engine: RootModuleEngine;
  navTier: RootModuleTier;
  hostVisibility: OsBrandKey[];
  icon: string;
  shortcut?: string;
  description: string;
};

const ROOT_MODULES: RootModuleDef[] = [
  {
    id: "overview",
    label: "overview",
    href: "/os/overview",
    engine: "control",
    navTier: "core",
    hostVisibility: ["acs", "cc"],
    icon: "◆",
    shortcut: "O",
    description: "shared operator summary and action queue",
  },
  {
    id: "dispatch",
    label: "dispatch",
    href: "/os/dispatch",
    engine: "operations",
    navTier: "core",
    // On-rail for both hosts: overview "Open dispatch" must land in MODULES,
    // not a hidden ACS-only sibling that operators can't trust.
    hostVisibility: ["acs", "cc"],
    icon: "◉",
    shortcut: "D",
    description: "crew, schedule, and route state",
  },
  {
    id: "quotes",
    label: "quotes",
    href: "/os/quotes",
    engine: "commercial",
    navTier: "core",
    hostVisibility: ["acs", "cc"],
    icon: "◈",
    shortcut: "Q",
    description: "commercial pipeline and approval readiness",
  },
  {
    id: "contacts",
    label: "contacts",
    href: "/os/contacts",
    engine: "contact",
    navTier: "core",
    hostVisibility: ["acs", "cc"],
    icon: "◎",
    shortcut: "C",
    description: "shared contact graph and stewardship",
  },
  {
    id: "invoices",
    label: "invoices",
    href: "/os/invoices",
    engine: "commercial",
    navTier: "core",
    hostVisibility: ["acs", "cc"],
    icon: "⬡",
    shortcut: "I",
    description: "billing, collections, and reconciliation state",
  },
  {
    id: "finance",
    label: "finance",
    href: "/os/finance",
    engine: "commercial",
    navTier: "core",
    hostVisibility: ["acs", "cc"],
    icon: "◌",
    shortcut: "F",
    description: "financial control plane and reporting",
  },
  {
    id: "marketing",
    label: "marketing",
    href: "/os/marketing",
    engine: "marketing",
    navTier: "core",
    hostVisibility: ["acs", "cc"],
    icon: "◬",
    shortcut: "M",
    description: "brand authority, public surfaces, and content workflow",
  },
  {
    id: "work-claims",
    label: "work claims",
    href: "/os/work-claims",
    engine: "control",
    navTier: "advanced",
    hostVisibility: ["acs", "cc"],
    icon: "◍",
    shortcut: "W",
    description: "ownership, blockers, and execution claims",
  },
  {
    id: "workspace",
    label: "workspace",
    href: "/os/workspace",
    engine: "control",
    navTier: "advanced",
    hostVisibility: ["acs", "cc"],
    icon: "▣",
    shortcut: "G",
    description: "google files, imports, and workspace projections",
  },
  {
    id: "goals",
    label: "goals",
    href: "/os/goals",
    engine: "control",
    navTier: "advanced",
    hostVisibility: ["acs", "cc"],
    icon: "◰",
    shortcut: "A",
    description: "bounded swarm goals, priorities, and execution lanes",
  },
  {
    id: "agents",
    label: "agents",
    href: "/os/agents",
    engine: "control",
    navTier: "advanced",
    hostVisibility: ["acs", "cc"],
    icon: "◫",
    shortcut: "Z",
    description: "agent roster, assignments, and authority boundaries",
  },
  {
    id: "system",
    label: "system",
    href: "/os/system",
    engine: "control",
    navTier: "advanced",
    hostVisibility: ["acs", "cc"],
    icon: "◇",
    shortcut: "S",
    description: "runtime health, dependencies, and rollout truth",
  },
  {
    id: "lab",
    label: "lab",
    href: "/os/lab",
    engine: "intelligence",
    navTier: "advanced",
    hostVisibility: ["acs", "cc"],
    icon: "✦",
    shortcut: "L",
    description: "scenario tools, experimentation, and verification",
  },

  // ── Creative Engine — CC Co-Apps ──────────────────────────────
  {
    id: "co-script",
    label: "co-script",
    href: "/os/co-script",
    engine: "creative",
    navTier: "core",
    hostVisibility: ["cc"],
    icon: "◧",
    shortcut: "1",
    description: "pre-production: shot structure, interview watchlists, AI-assisted scripts",
  },
  {
    id: "co-cut",
    label: "co-cut",
    href: "/os/co-edit",
    engine: "creative",
    navTier: "core",
    hostVisibility: ["cc"],
    icon: "◨",
    shortcut: "2",
    description: "post-production: transcript-first editorial workspace, review, and version control",
  },
  {
    id: "co-deliver",
    label: "co-deliver",
    href: "/os/co-deliver",
    engine: "creative",
    navTier: "core",
    hostVisibility: ["cc"],
    icon: "◩",
    shortcut: "3",
    description: "delivery: export, distribution, and client handoff pipeline",
  },
];

export function getRootWorkspaceForHost(hostname?: string | null, brandOverride?: string | null): OsBrandKey {
  return resolveOsBrand(hostname, brandOverride).key;
}

export function getRootModulesForWorkspace(
  workspace: OsBrandKey,
  navTier?: RootModuleTier,
): RootModuleDef[] {
  return ROOT_MODULES.filter((module) => {
    if (!module.hostVisibility.includes(workspace)) return false;
    if (!navTier) return module.navTier !== "hidden";
    return module.navTier === navTier;
  });
}
