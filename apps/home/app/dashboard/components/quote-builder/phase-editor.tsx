"use client";

import React from "react";
import { LineItemRow, LineItem } from "./line-item-row";

export interface Phase {
  id: string;
  name: string;
  date_label?: string;
  items: LineItem[];
}

interface PhaseEditorProps {
  phases: Phase[];
  onChange: (phases: Phase[]) => void;
  buDefaults?: string[];
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

const ACS_PHASE_DEFAULTS = ["Service", "Travel", "Equipment"];
const CC_PHASE_DEFAULTS = ["Discovery & Story Architecture", "Production", "Edit, Review & Delivery"];

export function PhaseEditor({ phases, onChange, buDefaults }: PhaseEditorProps) {
  function updatePhase(index: number, updates: Partial<Phase>) {
    const next = [...phases];
    next[index] = { ...next[index], ...updates };
    onChange(next);
  }

  function removePhase(index: number) {
    onChange(phases.filter((_, i) => i !== index));
  }

  function addPhase() {
    const defaults = buDefaults || ACS_PHASE_DEFAULTS;
    const usedNames = new Set(phases.map((p) => p.name));
    const nextDefault = defaults.find((d) => !usedNames.has(d)) || `Phase ${phases.length + 1}`;
    onChange([...phases, {
      id: generateId(),
      name: nextDefault,
      items: [{
        id: generateId(),
        description: "",
        quantity: 1,
        unit_price: 0,
        unit: "ea",
      }],
    }]);
  }

  function updateItem(phaseIndex: number, itemIndex: number, item: LineItem) {
    const next = [...phases];
    const items = [...next[phaseIndex].items];
    items[itemIndex] = item;
    next[phaseIndex] = { ...next[phaseIndex], items };
    onChange(next);
  }

  function removeItem(phaseIndex: number, itemIndex: number) {
    const next = [...phases];
    next[phaseIndex] = {
      ...next[phaseIndex],
      items: next[phaseIndex].items.filter((_, i) => i !== itemIndex),
    };
    onChange(next);
  }

  function addItem(phaseIndex: number) {
    const next = [...phases];
    next[phaseIndex] = {
      ...next[phaseIndex],
      items: [...next[phaseIndex].items, {
        id: generateId(),
        description: "",
        quantity: 1,
        unit_price: 0,
        unit: "ea",
      }],
    };
    onChange(next);
  }

  const inputStyle: React.CSSProperties = {
    padding: "6px 10px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 6,
    color: "var(--ink)",
    fontSize: "0.82rem",
    outline: "none",
  };

  return (
    <div>
      {phases.map((phase, pi) => {
        const subtotal = phase.items.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0);

        return (
          <div key={phase.id} style={{
            marginBottom: 20,
            padding: 16,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 10,
          }}>
            {/* Phase header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <input
                type="text"
                value={phase.name}
                onChange={(e) => updatePhase(pi, { name: e.target.value })}
                style={{ ...inputStyle, fontWeight: 700, flex: 1 }}
                placeholder="Phase name"
              />
              <input
                type="text"
                value={phase.date_label || ""}
                onChange={(e) => updatePhase(pi, { date_label: e.target.value })}
                style={{ ...inputStyle, width: 160 }}
                placeholder="Date label (optional)"
              />
              <div style={{
                fontSize: "0.78rem",
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
                color: subtotal > 0 ? "#3ec983" : "var(--muted)",
                whiteSpace: "nowrap",
              }}>
                ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <button
                onClick={() => removePhase(pi)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#de7676",
                  cursor: "pointer",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  padding: "2px 6px",
                }}
                title="Remove phase"
              >✕</button>
            </div>

            {/* Column headers */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "3fr 80px 100px 70px 90px 32px",
              gap: 8,
              marginBottom: 6,
              padding: "0 0 4px",
            }}>
              {["Description", "Qty", "Price", "Unit", "Total", ""].map((h, i) => (
                <div key={i} style={{
                  fontSize: "0.62rem",
                  fontWeight: 600,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  textAlign: i >= 1 && i <= 4 ? "right" : "left",
                }}>{h}</div>
              ))}
            </div>

            {/* Items */}
            {phase.items.map((item, ii) => (
              <LineItemRow
                key={item.id}
                item={item}
                onChange={(updated) => updateItem(pi, ii, updated)}
                onRemove={() => removeItem(pi, ii)}
              />
            ))}

            <button
              onClick={() => addItem(pi)}
              style={{
                marginTop: 6,
                padding: "4px 12px",
                borderRadius: 6,
                fontSize: "0.68rem",
                fontWeight: 600,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "var(--muted)",
                cursor: "pointer",
              }}
            >+ Add Item</button>
          </div>
        );
      })}

      <button
        onClick={addPhase}
        style={{
          padding: "8px 18px",
          borderRadius: 8,
          fontSize: "0.78rem",
          fontWeight: 600,
          background: "rgba(61,125,216,0.12)",
          border: "1px solid rgba(61,125,216,0.2)",
          color: "#3d7dd8",
          cursor: "pointer",
        }}
      >+ Add Phase</button>
    </div>
  );
}

export { ACS_PHASE_DEFAULTS, CC_PHASE_DEFAULTS };
