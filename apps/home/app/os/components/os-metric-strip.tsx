"use client";

import React from "react";
import { DT } from "./dt";

const G    = DT.G;
const MONO = DT.font.mono;
const LINE = DT.line;

export type MetricItem = {
  label: string;
  value: string;
  accent?: boolean;   // highlight green
  warn?: boolean;     // highlight amber
  danger?: boolean;   // highlight red
  sub?: string;       // optional sub-text below value
};

type Props = {
  metrics: MetricItem[];
};

export function RootMetricStrip({ metrics }: Props) {
  if (!metrics.length) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        padding: "5px 12px",
        borderBottom: `1px solid ${LINE}`,
        background: "rgba(0,0,0,0.10)",
        overflowX: "auto",
        flexWrap: "nowrap",
        scrollbarWidth: "none",
      }}
    >
      {metrics.map((m, i) => {
        const valueColor = m.accent
          ? "#4ade80"
          : m.warn
          ? "#fbbf24"
          : m.danger
          ? "#f87171"
          : "var(--ink)";

        return (
          <React.Fragment key={m.label}>
            {i > 0 && (
              <div
                style={{
                  width: 1,
                  height: 22,
                  background: `${G}0.12)`,
                  margin: "0 14px",
                  flexShrink: 0,
                }}
              />
            )}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 1,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: "0.43rem",
                  letterSpacing: "0.11em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  opacity: 0.42,
                  whiteSpace: "nowrap",
                  lineHeight: 1,
                }}
              >
                {m.label}
              </span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: DT.font.val,
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    color: valueColor,
                    whiteSpace: "nowrap",
                    lineHeight: 1,
                    textShadow: m.accent
                      ? `0 0 16px ${G}0.35)`
                      : m.warn
                      ? "0 0 16px rgba(251,191,36,0.30)"
                      : m.danger
                      ? "0 0 16px rgba(248,113,113,0.30)"
                      : "none",
                  }}
                >
                  {m.value}
                </span>
                {m.sub && (
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: "0.40rem",
                      color: "var(--muted)",
                      opacity: 0.35,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {m.sub}
                  </span>
                )}
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
