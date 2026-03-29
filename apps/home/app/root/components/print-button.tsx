"use client";

import type { CSSProperties } from "react";

export function PrintButton({ label = "print / save pdf", style }: { label?: string; style?: CSSProperties }) {
  return (
    <button type="button" onClick={() => window.print()} style={style}>
      {label}
    </button>
  );
}
