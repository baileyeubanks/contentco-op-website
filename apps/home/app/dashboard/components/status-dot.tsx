"use client";

import React from "react";

export function StatusDot({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  let color = "var(--muted)";
  if (["active", "paid", "confirmed", "completed", "arrived"].includes(s)) color = "#3ec983";
  else if (["pending", "sent", "awaiting_approval", "on_my_way", "in_progress", "scheduled"].includes(s)) color = "#e4ad5b";
  else if (["overdue", "cancelled", "declined", "failed", "departed"].includes(s)) color = "#de7676";

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.82rem" }}>
      <span style={{
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 6px ${color}40`,
      }} />
      {status}
    </span>
  );
}
