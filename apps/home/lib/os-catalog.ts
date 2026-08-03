export type RootCatalogItem = {
  id: string;
  code: string;
  name: string;
  category: string;
  default_unit_price: number;
  default_unit: string;
  revenue_account_code: string;
  cost_account_code: string;
  active: boolean;
  workspace: "ACS" | "CC" | "ALL";
};

const ROOT_CATALOG: RootCatalogItem[] = [
  {
    id: "cc-strategy-retainer",
    code: "STRAT-RET",
    name: "strategy retainer",
    category: "strategy",
    default_unit_price: 2500,
    default_unit: "project",
    revenue_account_code: "4000",
    cost_account_code: "5100",
    active: true,
    workspace: "CC",
  },
  {
    id: "cc-production-day",
    code: "PROD-DAY",
    name: "production day",
    category: "production",
    default_unit_price: 1800,
    default_unit: "day",
    revenue_account_code: "4010",
    cost_account_code: "5200",
    active: true,
    workspace: "CC",
  },
  {
    id: "cc-post-edit",
    code: "POST-EDIT",
    name: "editorial package",
    category: "post-production",
    default_unit_price: 2200,
    default_unit: "project",
    revenue_account_code: "4020",
    cost_account_code: "5210",
    active: true,
    workspace: "CC",
  },
  {
    id: "cc-motion",
    code: "MOTION",
    name: "motion graphics block",
    category: "design",
    default_unit_price: 950,
    default_unit: "block",
    revenue_account_code: "4030",
    cost_account_code: "5220",
    active: true,
    workspace: "CC",
  },
  {
    id: "cc-web-sprint",
    code: "WEB-SPR",
    name: "web sprint",
    category: "web",
    default_unit_price: 1600,
    default_unit: "sprint",
    revenue_account_code: "4040",
    cost_account_code: "5230",
    active: true,
    workspace: "CC",
  },
  {
    id: "acs-standard-clean",
    code: "CLEAN-STD",
    name: "standard cleaning visit",
    category: "recurring service",
    default_unit_price: 180,
    default_unit: "visit",
    revenue_account_code: "4100",
    cost_account_code: "5300",
    active: true,
    workspace: "ACS",
  },
  {
    id: "acs-deep-clean",
    code: "CLEAN-DEEP",
    name: "deep cleaning visit",
    category: "one-time service",
    default_unit_price: 320,
    default_unit: "visit",
    revenue_account_code: "4110",
    cost_account_code: "5310",
    active: true,
    workspace: "ACS",
  },
  {
    id: "acs-move",
    code: "MOVE-OUT",
    name: "move out cleaning",
    category: "one-time service",
    default_unit_price: 420,
    default_unit: "visit",
    revenue_account_code: "4120",
    cost_account_code: "5320",
    active: true,
    workspace: "ACS",
  },
  {
    id: "acs-add-window",
    code: "ADD-WIN",
    name: "window add-on",
    category: "add-on",
    default_unit_price: 65,
    default_unit: "service",
    revenue_account_code: "4130",
    cost_account_code: "5330",
    active: true,
    workspace: "ACS",
  },
  {
    id: "shared-travel",
    code: "TRAVEL",
    name: "travel fee",
    category: "reimbursable",
    default_unit_price: 75,
    default_unit: "trip",
    revenue_account_code: "4800",
    cost_account_code: "5400",
    active: true,
    workspace: "ALL",
  },
  {
    id: "shared-rush",
    code: "RUSH",
    name: "rush turnaround",
    category: "surcharge",
    default_unit_price: 150,
    default_unit: "service",
    revenue_account_code: "4810",
    cost_account_code: "5410",
    active: true,
    workspace: "ALL",
  },
];

export function getRootCatalog(workspace?: "ACS" | "CC" | null) {
  const scope = String(workspace || "").trim().toUpperCase();
  return ROOT_CATALOG.filter((item) => {
    if (!scope) return true;
    return item.workspace === "ALL" || item.workspace === scope;
  });
}

export function getRootCatalogSuggestions(
  workspace?: "ACS" | "CC" | null,
  limit = 6,
) {
  return getRootCatalog(workspace)
    .slice()
    .sort((a, b) => {
      if (a.workspace === "ALL" && b.workspace !== "ALL") return 1;
      if (b.workspace === "ALL" && a.workspace !== "ALL") return -1;
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

export function getRootCatalogCategories(workspace?: "ACS" | "CC" | null) {
  return Array.from(new Set(getRootCatalog(workspace).map((item) => item.category)));
}
