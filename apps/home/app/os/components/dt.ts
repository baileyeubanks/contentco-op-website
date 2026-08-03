/**
 * Desktop Token Constants
 * All ROOT desktop pages use ONLY these values for spacing, sizing, and typography.
 * No mobile breakpoints. Min-width ~960px assumed.
 */
export const DT = {
  // Table
  rowH: 28,
  cellPad: "4px 10px",
  thPad: "5px 10px",

  // Typography
  font: {
    xs:    "0.46rem",
    sm:    "0.53rem",
    md:    "0.62rem",
    label: "0.46rem",
    val:   "0.82rem",
    mono:  "var(--font-mono), monospace",
    body:  "var(--font-body), sans-serif",
  },

  // Pills / badges
  pill: { pad: "2px 7px", font: "0.42rem", radius: 4 },

  // Toolbar
  toolbar: { h: 30, font: "0.48rem" },

  // Sidebar (detail pages)
  sidebar: { w: 220 },

  // Tabs
  tab: { font: "0.48rem", pad: "4px 11px" },

  // Buttons
  btn: {
    primary: { pad: "4px 12px", font: "0.52rem", radius: 5 },
    ghost:   { pad: "3px 8px",  font: "0.48rem", radius: 4 },
    danger:  { pad: "3px 8px",  font: "0.48rem", radius: 4 },
  },

  // Color shortcuts
  G:    "rgba(74,222,128,",
  line: "rgba(74,222,128,0.10)",
  hover:"rgba(74,222,128,0.05)",

  // Status palette (used in pills)
  status: {
    draft:            { bg: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)", border: "rgba(255,255,255,0.10)" },
    sent:             { bg: "rgba(74,222,128,0.08)",  color: "#4ade80",               border: "rgba(74,222,128,0.20)" },
    accepted:         { bg: "rgba(74,222,128,0.16)",  color: "#4ade80",               border: "rgba(74,222,128,0.35)" },
    converted:        { bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.50)", border: "rgba(255,255,255,0.15)" },
    invoiced:         { bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.50)", border: "rgba(255,255,255,0.15)" },
    rejected:         { bg: "rgba(239,68,68,0.10)",  color: "#f87171",               border: "rgba(239,68,68,0.25)" },
    declined:         { bg: "rgba(239,68,68,0.10)",  color: "#f87171",               border: "rgba(239,68,68,0.25)" },
    expired:          { bg: "rgba(245,158,11,0.10)", color: "#fbbf24",               border: "rgba(245,158,11,0.25)" },
    paid:             { bg: "rgba(74,222,128,0.10)",  color: "#4ade80",               border: "rgba(74,222,128,0.22)" },
    overdue:          { bg: "rgba(239,68,68,0.12)",  color: "#f87171",               border: "rgba(239,68,68,0.28)" },
    awaiting_payment: { bg: "rgba(245,158,11,0.08)", color: "#fbbf24",               border: "rgba(245,158,11,0.20)" },
    reconciled:       { bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.40)", border: "rgba(255,255,255,0.12)" },
    void:             { bg: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.20)", border: "rgba(255,255,255,0.06)" },
  } as Record<string, { bg: string; color: string; border: string }>,
} as const;
