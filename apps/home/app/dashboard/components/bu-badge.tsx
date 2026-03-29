"use client";

import React from "react";

export function BuBadge({ bu }: { bu: string }) {
  const isACS = bu.toUpperCase() === "ACS";
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 6,
      fontSize: "0.68rem",
      fontWeight: 700,
      letterSpacing: "0.04em",
      background: isACS ? "rgba(61,125,216,0.12)" : "rgba(139,164,196,0.12)",
      color: isACS ? "#3d7dd8" : "#8ba4c4",
      border: `1px solid ${isACS ? "rgba(61,125,216,0.2)" : "rgba(139,164,196,0.2)"}`,
    }}>
      {bu.toUpperCase()}
    </span>
  );
}
