"use client";

import React from "react";

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  unit: string;
}

interface LineItemRowProps {
  item: LineItem;
  onChange: (item: LineItem) => void;
  onRemove: () => void;
}

const inputStyle: React.CSSProperties = {
  padding: "6px 10px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 6,
  color: "var(--ink)",
  fontSize: "0.78rem",
  outline: "none",
  width: "100%",
};

export function LineItemRow({ item, onChange, onRemove }: LineItemRowProps) {
  const total = (item.quantity || 0) * (item.unit_price || 0);

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "3fr 80px 100px 70px 90px 32px",
      gap: 8,
      alignItems: "center",
      marginBottom: 6,
    }}>
      <input
        type="text"
        placeholder="Description"
        value={item.description}
        onChange={(e) => onChange({ ...item, description: e.target.value })}
        style={inputStyle}
      />
      <input
        type="number"
        placeholder="Qty"
        value={item.quantity || ""}
        onChange={(e) => onChange({ ...item, quantity: Number(e.target.value) || 0 })}
        style={{ ...inputStyle, textAlign: "right" }}
      />
      <input
        type="number"
        placeholder="Unit Price"
        value={item.unit_price || ""}
        onChange={(e) => onChange({ ...item, unit_price: Number(e.target.value) || 0 })}
        style={{ ...inputStyle, textAlign: "right" }}
        step="0.01"
      />
      <input
        type="text"
        placeholder="Unit"
        value={item.unit}
        onChange={(e) => onChange({ ...item, unit: e.target.value })}
        style={inputStyle}
      />
      <div style={{
        fontSize: "0.78rem",
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
        textAlign: "right",
        color: total > 0 ? "var(--ink)" : "var(--muted)",
      }}>
        ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <button
        onClick={onRemove}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--muted)",
          cursor: "pointer",
          fontSize: "0.88rem",
          padding: 0,
        }}
        title="Remove item"
      >✕</button>
    </div>
  );
}
