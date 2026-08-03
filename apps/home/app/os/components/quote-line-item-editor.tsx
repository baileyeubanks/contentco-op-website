"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { DT } from "./dt";

/* ─── Types ─── */
export type LineItem = {
  id: string;
  sort_order: number;
  name: string;
  description: string | null;
  phase_name: string | null;
  quantity: number;
  unit_price: number;
  isPhaseHeader?: boolean;
};

export type QuoteOption = "good" | "better" | "best";

type CatalogItem = {
  id: string;
  code: string;
  name: string;
  unit_price: number;
  category: string;
  unit?: string;
  account_code?: string;
};

type Props = {
  quoteId?: string;
  initialItems?: LineItem[];
  businessUnit?: string;
  readOnly?: boolean;
  onSave?: (items: LineItem[], discount: number, tax: number) => Promise<void>;
  initialDiscount?: number;
  initialTax?: number;
};

function uid() { return Math.random().toString(36).slice(2, 10); }

const G = DT.G;
const LINE = DT.line;
const MONO = DT.font.mono;

/* ─── Inline editable cell ─── */
function EditCell({
  value,
  onChange,
  align = "left",
  mono = false,
  placeholder = "",
  style,
}: {
  value: string | number;
  onChange: (v: string) => void;
  align?: "left" | "right" | "center";
  mono?: boolean;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(String(value)); }, [value]);
  useEffect(() => { if (editing) ref.current?.select(); }, [editing]);

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); onChange(draft); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { setEditing(false); onChange(draft); }
          if (e.key === "Escape") { setEditing(false); setDraft(String(value)); }
        }}
        style={{
          width: "100%",
          background: `${G}0.08)`,
          border: `1px solid ${G}0.30)`,
          borderRadius: 2,
          padding: "2px 4px",
          fontSize: DT.font.sm,
          fontFamily: mono ? MONO : DT.font.body,
          color: "var(--ink)",
          textAlign: align,
          outline: "none",
          ...style,
        }}
      />
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      style={{
        minHeight: 18,
        padding: "1px 4px",
        fontSize: DT.font.sm,
        fontFamily: mono ? MONO : DT.font.body,
        color: value === "" || value === 0 ? "rgba(255,255,255,0.2)" : "var(--ink)",
        textAlign: align,
        cursor: "text",
        borderRadius: 2,
        transition: "background 100ms",
        ...style,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = DT.hover; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
    >
      {value === "" || value === 0 ? (placeholder || "—") : String(value)}
    </div>
  );
}

/* ─── Main Component ─── */
export function QuoteLineItemEditor({
  quoteId,
  initialItems = [],
  businessUnit = "CC",
  readOnly = false,
  onSave,
  initialDiscount = 0,
  initialTax = 0,
}: Props) {
  const [items, setItems] = useState<LineItem[]>(initialItems);
  const [discount, setDiscount] = useState(initialDiscount);
  const [tax, setTax] = useState(initialTax);
  const [option, setOption] = useState<QuoteOption>("good");
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setItems(initialItems); }, [initialItems]);
  useEffect(() => { setDiscount(initialDiscount); setTax(initialTax); }, [initialDiscount, initialTax]);

  /* Load catalog when panel opens */
  useEffect(() => {
    if (!catalogOpen || catalogItems.length > 0) return;
    setCatalogLoading(true);
    fetch(`/api/root/catalog/products-services?bu=${businessUnit}`)
      .then((r) => r.json())
      .then((d) => setCatalogItems(d.items ?? []))
      .catch(() => {})
      .finally(() => setCatalogLoading(false));
  }, [catalogOpen, businessUnit, catalogItems.length]);

  function markDirty() { setDirty(true); }

  /* ── Item mutations ── */
  function updateItem(id: string, field: keyof LineItem, raw: string) {
    setItems((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      if (field === "quantity" || field === "unit_price") {
        return { ...item, [field]: parseFloat(raw) || 0 };
      }
      return { ...item, [field]: raw };
    }));
    markDirty();
  }

  function addLine() {
    setItems((prev) => [
      ...prev,
      { id: uid(), sort_order: prev.length + 1, name: "", description: null, phase_name: null, quantity: 1, unit_price: 0 },
    ]);
    markDirty();
  }

  function addPhaseSection() {
    setItems((prev) => [
      ...prev,
      { id: uid(), sort_order: prev.length + 1, name: "New Phase", description: null, phase_name: null, quantity: 0, unit_price: 0, isPhaseHeader: true },
    ]);
    markDirty();
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    markDirty();
  }

  function appendCatalogItem(ci: CatalogItem) {
    setItems((prev) => [
      ...prev,
      {
        id: uid(),
        sort_order: prev.length + 1,
        name: ci.name,
        description: null,
        phase_name: null,
        quantity: 1,
        unit_price: ci.unit_price,
      },
    ]);
    markDirty();
  }

  /* ── Totals ── */
  const subtotal = items.filter((i) => !i.isPhaseHeader).reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const discountAmt = subtotal * (discount / 100);
  const taxAmt = (subtotal - discountAmt) * (tax / 100);
  const grandTotal = subtotal - discountAmt + taxAmt;

  /* ── Save ── */
  async function handleSave() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      if (onSave) {
        await onSave(items, discount, tax);
      } else if (quoteId) {
        await fetch(`/api/root/quotes/${quoteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: items.filter((i) => !i.isPhaseHeader).map((i, idx) => ({
              ...i, sort_order: idx + 1,
            })),
            discount_percent: discount,
            tax_percent: tax,
            estimated_total: grandTotal,
          }),
        });
      }
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  /* ── Catalog filtered ── */
  const filteredCatalog = catalogSearch
    ? catalogItems.filter((ci) => ci.name.toLowerCase().includes(catalogSearch.toLowerCase()) || ci.code?.toLowerCase().includes(catalogSearch.toLowerCase()))
    : catalogItems;

  const catalogByCategory = filteredCatalog.reduce<Record<string, CatalogItem[]>>((acc, ci) => {
    const cat = ci.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ci);
    return acc;
  }, {});

  const fmtAmt = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 0 }}>
      {/* ── Option tabs (Good/Better/Best) ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0 8px" }}>
        <div style={{ display: "flex", gap: 2 }}>
          {(["good", "better", "best"] as QuoteOption[]).map((o) => (
            <button
              key={o}
              onClick={() => setOption(o)}
              style={{
                padding: "2px 9px",
                fontSize: DT.font.xs,
                fontFamily: MONO,
                fontWeight: option === o ? 700 : 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: option === o ? "#4ade80" : "var(--muted)",
                background: option === o ? `${G}0.10)` : "transparent",
                border: `1px solid ${option === o ? `${G}0.25)` : LINE}`,
                borderRadius: 3,
                cursor: "pointer",
              }}
            >
              {o}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={() => setCatalogOpen((v) => !v)}
            style={{
              padding: DT.btn.ghost.pad,
              fontSize: DT.font.xs,
              fontFamily: MONO,
              color: catalogOpen ? "#4ade80" : "var(--muted)",
              background: catalogOpen ? `${G}0.08)` : "transparent",
              border: `1px solid ${catalogOpen ? `${G}0.22)` : LINE}`,
              borderRadius: DT.btn.ghost.radius,
              cursor: "pointer",
              letterSpacing: "0.06em",
            }}
          >
            ⊞ Catalog
          </button>
          {!readOnly && dirty && (
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: DT.btn.primary.pad,
                fontSize: DT.btn.primary.font,
                fontFamily: MONO,
                fontWeight: 700,
                color: "#0d1109",
                background: saving ? "rgba(74,222,128,0.5)" : "#4ade80",
                border: "none",
                borderRadius: DT.btn.primary.radius,
                cursor: saving ? "default" : "pointer",
              }}
            >
              {saving ? "Saving…" : "Save Items"}
            </button>
          )}
        </div>
      </div>

      {/* ── Main layout: table + catalog panel ── */}
      <div style={{ display: "flex", gap: 0, border: `1px solid ${LINE}`, borderRadius: 5, overflow: "hidden" }}>

        {/* ── Line items table ── */}
        <div style={{ flex: 1, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "34%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "28px" }} />
            </colgroup>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: `1px solid ${LINE}` }}>
                {["Description", "Phase", "Qty", "Unit", "Unit Price", "Total", ""].map((h) => (
                  <th key={h} style={{
                    padding: DT.thPad,
                    fontSize: DT.font.label,
                    fontFamily: MONO,
                    letterSpacing: "0.10em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    color: "var(--muted)",
                    opacity: 0.5,
                    textAlign: h === "Qty" || h === "Unit Price" || h === "Total" ? "right" : "left",
                    whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: "20px 12px", textAlign: "center", fontFamily: MONO, fontSize: DT.font.sm, color: "var(--muted)", opacity: 0.35 }}>
                    No line items yet — add a line or pick from catalog
                  </td>
                </tr>
              )}
              {items.map((item, idx) => {
                const lineTotal = item.isPhaseHeader ? null : item.quantity * item.unit_price;
                return (
                  <tr
                    key={item.id}
                    style={{
                      height: DT.rowH,
                      borderBottom: `1px solid ${LINE}`,
                      background: item.isPhaseHeader ? "rgba(74,222,128,0.04)" : "transparent",
                    }}
                  >
                    {item.isPhaseHeader ? (
                      <>
                        <td colSpan={5} style={{ padding: DT.cellPad }}>
                          <EditCell
                            value={item.name}
                            onChange={(v) => updateItem(item.id, "name", v)}
                            style={{ fontSize: DT.font.xs, fontFamily: MONO, letterSpacing: "0.10em", textTransform: "uppercase", color: "#4ade80", fontWeight: 700 }}
                          />
                        </td>
                        <td />
                        <td style={{ padding: "0 4px", textAlign: "center" }}>
                          {!readOnly && (
                            <button onClick={() => removeItem(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(239,68,68,0.4)", fontSize: "0.55rem", padding: "0 2px" }} title="Remove">✕</button>
                          )}
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: DT.cellPad }}>
                          <EditCell value={item.name} onChange={(v) => updateItem(item.id, "name", v)} placeholder="Description" />
                        </td>
                        <td style={{ padding: DT.cellPad }}>
                          <EditCell value={item.phase_name ?? ""} onChange={(v) => updateItem(item.id, "phase_name", v)} placeholder="Phase" />
                        </td>
                        <td style={{ padding: DT.cellPad }}>
                          <EditCell value={item.quantity} onChange={(v) => updateItem(item.id, "quantity", v)} align="right" mono placeholder="1" />
                        </td>
                        <td style={{ padding: DT.cellPad }}>
                          <span style={{ fontSize: DT.font.xs, fontFamily: MONO, color: "var(--muted)", opacity: 0.4 }}>ea</span>
                        </td>
                        <td style={{ padding: DT.cellPad }}>
                          <EditCell value={item.unit_price === 0 ? "" : item.unit_price} onChange={(v) => updateItem(item.id, "unit_price", v)} align="right" mono placeholder="0.00" />
                        </td>
                        <td style={{ padding: DT.cellPad, textAlign: "right" }}>
                          <span style={{ fontFamily: MONO, fontSize: DT.font.sm, fontWeight: 600 }}>
                            {lineTotal !== null ? fmtAmt(lineTotal) : "—"}
                          </span>
                        </td>
                        <td style={{ padding: "0 4px", textAlign: "center" }}>
                          {!readOnly && (
                            <button onClick={() => removeItem(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(239,68,68,0.35)", fontSize: "0.55rem", padding: "0 2px" }} title="Remove">✕</button>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* ── Add buttons ── */}
          {!readOnly && (
            <div style={{ display: "flex", gap: 4, padding: "6px 10px", borderTop: `1px solid ${LINE}` }}>
              <button
                onClick={addLine}
                style={{
                  padding: "2px 8px",
                  fontSize: DT.font.xs,
                  fontFamily: MONO,
                  color: "#4ade80",
                  background: `${G}0.06)`,
                  border: `1px solid ${G}0.18)`,
                  borderRadius: 3,
                  cursor: "pointer",
                  letterSpacing: "0.06em",
                }}
              >
                + Add Line
              </button>
              <button
                onClick={addPhaseSection}
                style={{
                  padding: "2px 8px",
                  fontSize: DT.font.xs,
                  fontFamily: MONO,
                  color: "var(--muted)",
                  background: "transparent",
                  border: `1px solid ${LINE}`,
                  borderRadius: 3,
                  cursor: "pointer",
                  letterSpacing: "0.06em",
                }}
              >
                ⊕ Add Phase Section
              </button>
            </div>
          )}

          {/* ── Totals footer ── */}
          <div style={{ borderTop: `1px solid ${LINE}`, padding: "8px 12px", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <span style={{ fontFamily: MONO, fontSize: DT.font.label, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--muted)", opacity: 0.5 }}>Subtotal</span>
              <span style={{ fontFamily: MONO, fontSize: DT.font.sm, fontWeight: 500, minWidth: 80, textAlign: "right" }}>{fmtAmt(subtotal)}</span>
            </div>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <span style={{ fontFamily: MONO, fontSize: DT.font.label, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--muted)", opacity: 0.5 }}>Discount</span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="number"
                  min={0} max={100}
                  value={discount}
                  onChange={(e) => { setDiscount(parseFloat(e.target.value) || 0); markDirty(); }}
                  disabled={readOnly}
                  style={{ width: 38, padding: "1px 4px", fontSize: DT.font.xs, fontFamily: MONO, background: "rgba(255,255,255,0.04)", border: `1px solid ${LINE}`, borderRadius: 2, color: "var(--ink)", textAlign: "right" }}
                />
                <span style={{ fontFamily: MONO, fontSize: DT.font.xs, color: "var(--muted)" }}>%</span>
                <span style={{ fontFamily: MONO, fontSize: DT.font.sm, color: "#f87171", minWidth: 80, textAlign: "right" }}>
                  {discount > 0 ? `−${fmtAmt(discountAmt)}` : "—"}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <span style={{ fontFamily: MONO, fontSize: DT.font.label, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--muted)", opacity: 0.5 }}>Tax</span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="number"
                  min={0} max={100}
                  value={tax}
                  onChange={(e) => { setTax(parseFloat(e.target.value) || 0); markDirty(); }}
                  disabled={readOnly}
                  style={{ width: 38, padding: "1px 4px", fontSize: DT.font.xs, fontFamily: MONO, background: "rgba(255,255,255,0.04)", border: `1px solid ${LINE}`, borderRadius: 2, color: "var(--ink)", textAlign: "right" }}
                />
                <span style={{ fontFamily: MONO, fontSize: DT.font.xs, color: "var(--muted)" }}>%</span>
                <span style={{ fontFamily: MONO, fontSize: DT.font.sm, minWidth: 80, textAlign: "right" }}>
                  {tax > 0 ? `+${fmtAmt(taxAmt)}` : "—"}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, alignItems: "center", borderTop: `1px solid ${LINE}`, paddingTop: 6, marginTop: 2 }}>
              <span style={{ fontFamily: MONO, fontSize: DT.font.sm, letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 700, color: "var(--ink)" }}>Grand Total</span>
              <span style={{ fontFamily: MONO, fontSize: DT.font.val, fontWeight: 700, color: "#4ade80", minWidth: 80, textAlign: "right" }}>{fmtAmt(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* ── Catalog panel ── */}
        {catalogOpen && (
          <div style={{
            width: 240,
            borderLeft: `1px solid ${LINE}`,
            display: "flex",
            flexDirection: "column",
            background: "rgba(0,0,0,0.15)",
            flexShrink: 0,
          }}>
            {/* Catalog header */}
            <div style={{ padding: "6px 8px", borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: MONO, fontSize: DT.font.label, letterSpacing: "0.12em", textTransform: "uppercase", color: "#4ade80", opacity: 0.7 }}>Catalog</span>
              <button onClick={() => setCatalogOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "0.55rem" }}>✕</button>
            </div>
            {/* Search */}
            <div style={{ padding: "5px 8px", borderBottom: `1px solid ${LINE}` }}>
              <input
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Search catalog…"
                style={{
                  width: "100%",
                  padding: "3px 7px",
                  fontSize: DT.font.xs,
                  fontFamily: MONO,
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${LINE}`,
                  borderRadius: 3,
                  color: "var(--ink)",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            {/* Items list */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {catalogLoading ? (
                <div style={{ padding: 10, fontFamily: MONO, fontSize: DT.font.xs, opacity: 0.35, textAlign: "center" }}>Loading…</div>
              ) : Object.entries(catalogByCategory).map(([cat, catItems]) => (
                <div key={cat}>
                  <div style={{ padding: "5px 8px 2px", fontFamily: MONO, fontSize: DT.font.label, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", opacity: 0.4, borderBottom: `1px solid ${LINE}` }}>
                    {cat}
                  </div>
                  {catItems.map((ci) => (
                    <div
                      key={ci.id || ci.code}
                      onClick={() => { appendCatalogItem(ci); }}
                      style={{
                        padding: "4px 8px",
                        cursor: "pointer",
                        borderBottom: `1px solid rgba(74,222,128,0.04)`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: 4,
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = DT.hover; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: DT.font.xs, color: "var(--ink)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ci.name}</div>
                        {ci.code && <div style={{ fontSize: DT.font.label, fontFamily: MONO, color: "var(--muted)", opacity: 0.4 }}>{ci.code}</div>}
                      </div>
                      <span style={{ fontFamily: MONO, fontSize: DT.font.xs, color: "#4ade80", flexShrink: 0, fontWeight: 600 }}>
                        {ci.unit_price > 0 ? `$${ci.unit_price.toLocaleString()}` : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
              {!catalogLoading && filteredCatalog.length === 0 && (
                <div style={{ padding: 10, fontFamily: MONO, fontSize: DT.font.xs, opacity: 0.25, textAlign: "center" }}>No items found</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
