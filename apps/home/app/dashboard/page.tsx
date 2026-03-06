"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Nav } from "@contentco-op/ui";

/* ─── Types ─── */
interface Contact {
  id: string;
  name: string;
  full_name: string;
  email: string;
  phone: string;
  company: string;
  business_unit: string[] | null;
  contact_type: string;
  status: string;
  total_revenue: number;
  total_jobs: number;
  last_contacted: string;
  priority_score: number;
  city: string;
  state: string;
  orbit_tier: string;
  tags: string[];
  created_at: string;
}

interface Quote {
  id: string;
  quote_number: string;
  client_name: string;
  client_email: string;
  estimated_total: number;
  status: string;
  client_status: string;
  business_unit: string;
  service_type: string;
  frequency: string;
  booked_date: string;
  booked_slot: string;
  address: string;
  created_at: string;
}

interface Job {
  id: string;
  title: string;
  status: string;
  scheduled_date: string;
  scheduled_start: string;
  total_price: number;
  total_amount_cents: number;
  estimated_duration_min: number;
  assigned_team: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  completed_at: string;
  notes: string;
  created_at: string;
}

interface Stats {
  contacts_total: number;
  contacts_loaded: number;
  contacts_with_email: number;
  contacts_with_bu: number;
  contacts_clients: number;
  contacts_leads: number;
  quotes_total: number;
  quotes_new: number;
  quotes_accepted: number;
  quotes_abandoned: number;
  quotes_pipeline: number;
  quotes_accepted_value: number;
  jobs_total: number;
  jobs_scheduled: number;
  jobs_completed: number;
  jobs_today: number;
}

type Tab = "contacts" | "quotes" | "jobs";
type BizFilter = "ALL" | "ACS" | "CC";

/* ─── Helpers ─── */
function fmtDateShort(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const today = new Date();
  const isThisYear = d.getFullYear() === today.getFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(isThisYear ? {} : { year: "numeric" }),
  });
}

function fmtMoney(v: number | null | undefined) {
  if (!v || v <= 0) return null;
  return `$${Number(v).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

const Nil = () => (
  <span style={{ color: "var(--muted)", opacity: 0.18 }}>—</span>
);

function isToday(iso: string | null) {
  if (!iso) return false;
  return new Date(iso).toDateString() === new Date().toDateString();
}

/* ─── Page ─── */
export default function RootDashboard() {
  const [tab, setTab] = useState<Tab>("contacts");
  const [biz, setBiz] = useState<BizFilter>("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/root/overview");
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setContacts(data.contacts || []);
      setQuotes(data.quotes || []);
      setJobs(data.jobs || []);
      setStats(data.stats || null);
    } catch (e) {
      console.error("root load:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* ─── Filters ─── */
  function matchBiz(bu: string[] | string | null) {
    if (biz === "ALL") return true;
    if (!bu) return false;
    if (Array.isArray(bu)) {
      if (bu.length === 0) return false;
      return bu.some((b) => b?.toUpperCase() === biz);
    }
    return String(bu).toUpperCase() === biz;
  }

  function matchSearch(fields: (string | null | undefined)[]) {
    if (!search) return true;
    const q = search.toLowerCase();
    return fields.some((f) => f && f.toLowerCase().includes(q));
  }

  const fc = contacts.filter(
    (c) =>
      matchBiz(c.business_unit) &&
      matchSearch([c.name, c.full_name, c.email, c.phone, c.company]),
  );
  const fq = quotes.filter(
    (q) =>
      matchBiz(q.business_unit) &&
      matchSearch([q.client_name, q.client_email, q.quote_number, q.service_type]),
  );
  const fj = jobs.filter((j) =>
    matchSearch([j.client_name, j.title, j.status, j.notes]),
  );

  const activeCount = tab === "contacts" ? fc.length : tab === "quotes" ? fq.length : fj.length;

  /* ─── Render ─── */
  return (
    <>
      <style>{cssReset}</style>
      <Nav surface="home" />

      {/* ─── Top bar ─── */}
      <header className="r-topbar">
        <div className="r-brand">
          <span className="r-dot" />
          <span className="r-name">root</span>
          <span className="r-sub">acs + content co-op</span>
        </div>
        <div className="r-topright">
          <nav className="r-nav">
            <Link href="/root/overview" className="r-navlink active">Overview</Link>
            <Link href="/root/dispatch" className="r-navlink">Dispatch</Link>
            <Link href="/root/quotes" className="r-navlink">Quotes</Link>
          </nav>
          <div className="r-bizgroup">
            {(["ALL", "ACS", "CC"] as BizFilter[]).map((b) => (
              <button
                key={b}
                onClick={() => setBiz(b)}
                className={`r-bizpill ${biz === b ? "active" : ""}`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ─── Main content ─── */}
      <div className="r-main">
        {/* Stats */}
        {stats && (
          <div className="r-stats">
            <div className="r-stat">
              <div className="r-stat-bar" />
              <div className="r-stat-label">contacts</div>
              <div className="r-stat-value">{stats.contacts_total.toLocaleString()}</div>
              <div className="r-stat-sub">
                {stats.contacts_with_email} with email
                {stats.contacts_clients > 0 &&
                  ` · ${stats.contacts_clients} client${stats.contacts_clients !== 1 ? "s" : ""}`}
              </div>
            </div>
            <div className="r-stat">
              <div className="r-stat-bar" />
              <div className="r-stat-label">quotes</div>
              <div className="r-stat-value">{stats.quotes_total}</div>
              <div className="r-stat-sub">{stats.quotes_accepted} accepted · {stats.quotes_new} new</div>
            </div>
            <div className="r-stat">
              <div className="r-stat-bar" />
              <div className="r-stat-label">pipeline</div>
              <div className="r-stat-value" style={{ color: "var(--warning)" }}>
                {fmtMoney(stats.quotes_pipeline) || "$0"}
              </div>
              <div className="r-stat-sub">{fmtMoney(stats.quotes_accepted_value) || "$0"} accepted</div>
            </div>
            <div className="r-stat">
              <div className="r-stat-bar" />
              <div className="r-stat-label">jobs</div>
              <div className="r-stat-value">{stats.jobs_total}</div>
              <div className="r-stat-sub">{stats.jobs_scheduled} scheduled · {stats.jobs_completed} done</div>
            </div>
            <div className="r-stat">
              <div className="r-stat-bar" />
              <div className="r-stat-label">today</div>
              <div
                className="r-stat-value"
                style={{ color: stats.jobs_today > 0 ? "var(--success)" : "var(--muted)" }}
              >
                {stats.jobs_today}
              </div>
              <div className="r-stat-sub">
                {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
            </div>
          </div>
        )}

        {/* Tab bar + search */}
        <div className="r-controls">
          <div className="r-tabgroup">
            {(
              [
                ["contacts", "Contacts"],
                ["quotes", "Quotes"],
                ["jobs", "Jobs"],
              ] as [Tab, string][]
            ).map(([key, label]) => {
              const count = key === "contacts" ? fc.length : key === "quotes" ? fq.length : fj.length;
              return (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`r-tab ${tab === key ? "active" : ""}`}
                >
                  {label}
                  <span className="r-tab-count">{count}</span>
                </button>
              );
            })}
          </div>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="r-search"
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="r-loading">
            <div className="r-spinner" />
            loading...
          </div>
        ) : (
          <div className="r-table-wrap">
            <div className="r-table-scroll">
              {/* ─── CONTACTS ─── */}
              {tab === "contacts" && (
                <table className="r-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Company</th>
                      <th className="center">BU</th>
                      <th className="right">Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fc.length === 0 && (
                      <tr><td colSpan={6} className="r-empty">No contacts match</td></tr>
                    )}
                    {fc.slice(0, 200).map((c) => {
                      const prio = c.priority_score || 0;
                      const pc =
                        prio >= 80 ? "var(--success)" :
                        prio >= 50 ? "var(--accent)" :
                        prio >= 20 ? "var(--warning)" : "var(--muted)";
                      return (
                        <tr key={c.id}>
                          <td className="name-cell">
                            <div className="primary">{c.full_name || c.name || "—"}</div>
                            {c.contact_type && (
                              <div className="sub">{c.contact_type}{c.city && ` · ${c.city}`}</div>
                            )}
                          </td>
                          <td className="muted">{c.email || <Nil />}</td>
                          <td className="mono">{c.phone || <Nil />}</td>
                          <td>{c.company || <Nil />}</td>
                          <td className="center">
                            {Array.isArray(c.business_unit) && c.business_unit.length > 0
                              ? c.business_unit.map((b, i) => <BuChip key={i} val={b} />)
                              : <Nil />}
                          </td>
                          <td className="right">
                            {prio > 0 ? (
                              <span className="prio">
                                <span className="prio-dot" style={{ background: pc, boxShadow: `0 0 6px ${pc}` }} />
                                {prio}
                              </span>
                            ) : <Nil />}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* ─── QUOTES ─── */}
              {tab === "quotes" && (
                <table className="r-table">
                  <thead>
                    <tr>
                      <th>Quote</th>
                      <th>Client</th>
                      <th>Service</th>
                      <th className="right">Amount</th>
                      <th className="center">BU</th>
                      <th>Status</th>
                      <th>Booked</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fq.length === 0 && (
                      <tr><td colSpan={8} className="r-empty">No quotes match</td></tr>
                    )}
                    {fq.slice(0, 200).map((q) => (
                      <tr key={q.id}>
                        <td className="name-cell">
                          <Link href={`/root/quotes/${q.id}`} className="accent-link">
                            {q.quote_number || `Q-${q.id.slice(0, 6)}`}
                          </Link>
                        </td>
                        <td>{q.client_name || q.client_email || <Nil />}</td>
                        <td className="muted">
                          {q.service_type ? (
                            <>{q.service_type}{q.frequency && <span className="dim"> · {q.frequency}</span>}</>
                          ) : <Nil />}
                        </td>
                        <td className="right mono bold">{fmtMoney(q.estimated_total) || <Nil />}</td>
                        <td className="center"><BuChip val={q.business_unit || "ACS"} /></td>
                        <td><StatusDot status={q.status} map={quoteColors} /></td>
                        <td className="muted mono">{fmtDateShort(q.booked_date) || <Nil />}</td>
                        <td className="muted mono">{fmtDateShort(q.created_at) || <Nil />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* ─── JOBS ─── */}
              {tab === "jobs" && (
                <table className="r-table">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Status</th>
                      <th>Scheduled</th>
                      <th>Team</th>
                      <th className="right">Amount</th>
                      <th>Done</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fj.length === 0 && (
                      <tr><td colSpan={6} className="r-empty">No jobs match</td></tr>
                    )}
                    {fj.slice(0, 200).map((j) => {
                      const today = isToday(j.scheduled_date);
                      const amt = Number(j.total_price) > 0
                        ? fmtMoney(j.total_price)
                        : j.total_amount_cents ? fmtMoney(j.total_amount_cents / 100) : null;
                      return (
                        <tr key={j.id} className={today ? "today-row" : ""}>
                          <td className="name-cell">
                            <div className="primary">
                              {j.client_name || j.title || "Unassigned"}
                              {today && <span className="today-badge">today</span>}
                            </div>
                            {j.client_phone && <div className="sub">{j.client_phone}</div>}
                          </td>
                          <td><StatusDot status={j.status} map={jobColors} /></td>
                          <td className="mono">{fmtDateShort(j.scheduled_date) || <Nil />}</td>
                          <td className="muted">{j.assigned_team || <Nil />}</td>
                          <td className="right mono bold">{amt || <Nil />}</td>
                          <td className="muted mono">{fmtDateShort(j.completed_at) || <Nil />}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="r-table-footer">
              <span>{Math.min(activeCount, 200)} of {activeCount} {tab}</span>
              {tab === "quotes" && (
                <Link href="/root/quotes/new" className="accent-link upper">+ new quote</Link>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Sub-components ─── */

function BuChip({ val }: { val: string }) {
  const v = (val || "").toUpperCase();
  const isACS = v === "ACS";
  return (
    <span
      className="bu-chip"
      style={{
        background: isACS ? "rgba(76,142,245,0.1)" : "rgba(122,156,192,0.08)",
        color: isACS ? "var(--accent)" : "var(--muted)",
      }}
    >
      {v}
    </span>
  );
}

function StatusDot({ status, map }: { status: string; map: Record<string, string> }) {
  const color = map[status?.toLowerCase()] || "var(--muted)";
  return (
    <span className="status-dot">
      <span style={{ background: color, boxShadow: `0 0 5px ${color}` }} className="dot" />
      {status || "—"}
    </span>
  );
}

const quoteColors: Record<string, string> = {
  accepted: "var(--success)", new: "var(--accent)", sent: "var(--warning)",
  pending: "var(--warning)", abandoned: "var(--muted)", rejected: "var(--danger)",
  declined: "var(--danger)", expired: "var(--danger)",
};
const jobColors: Record<string, string> = {
  completed: "var(--success)", scheduled: "var(--accent)", confirmed: "#8be9c9",
  in_progress: "var(--warning)", cancelled: "var(--danger)",
};

/* ─────────────────────────────────────────
   All styles via CSS-in-JS string.
   No inline style objects. No fixed widths.
   ───────────────────────────────────────── */
const cssReset = `
/* ── Top bar ── */
.r-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 24px;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
  flex-wrap: wrap;
  gap: 8px;
}
.r-brand {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-shrink: 0;
}
.r-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
}
.r-name {
  font-size: 0.92rem;
  font-weight: 740;
  letter-spacing: -0.02em;
}
.r-sub {
  font-size: 0.58rem;
  color: var(--muted);
  opacity: 0.5;
  letter-spacing: 0.04em;
  margin-left: 2px;
}
.r-topright {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.r-nav {
  display: flex;
  gap: 2px;
}
.r-navlink {
  padding: 4px 12px;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--muted);
  text-decoration: none;
  border-radius: 6px;
  transition: all 140ms ease;
}
.r-navlink:hover { color: var(--ink); background: rgba(76,142,245,0.04); }
.r-navlink.active {
  color: var(--ink);
  font-weight: 640;
  background: rgba(76,142,245,0.06);
}

/* ── BU pills ── */
.r-bizgroup {
  display: flex; gap: 1px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 2px;
}
.r-bizpill {
  padding: 2px 11px;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 0.66rem;
  font-weight: 540;
  cursor: pointer;
  font-family: inherit;
  letter-spacing: 0.04em;
  transition: all 140ms ease;
}
.r-bizpill.active {
  background: rgba(76,142,245,0.12);
  color: var(--ink);
  font-weight: 660;
}

/* ── Main ── */
.r-main {
  padding: 16px 24px 40px;
  max-width: 1400px;
  margin: 0 auto;
}

/* ── Stats ── */
.r-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px;
  margin-bottom: 14px;
}
.r-stat {
  position: relative;
  padding: 12px 14px 10px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
}
.r-stat-bar {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--accent) 0%, transparent 100%);
  opacity: 0.35;
}
.r-stat-label {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 3px;
}
.r-stat-value {
  font-size: 1.25rem;
  font-weight: 740;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.025em;
  line-height: 1.1;
}
.r-stat-sub {
  font-size: 0.62rem;
  color: var(--muted);
  margin-top: 4px;
  opacity: 0.7;
}

/* ── Controls ── */
.r-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  gap: 10px;
  flex-wrap: wrap;
}
.r-tabgroup {
  display: flex; gap: 1px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 2px;
}
.r-tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 14px;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  letter-spacing: 0.02em;
  transition: all 140ms ease;
}
.r-tab.active {
  background: rgba(76,142,245,0.1);
  color: var(--ink);
  font-weight: 640;
}
.r-tab-count {
  font-size: 0.64rem;
  font-variant-numeric: tabular-nums;
  opacity: 0.35;
}
.r-tab.active .r-tab-count { opacity: 0.55; }

.r-search {
  padding: 5px 12px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--ink);
  font-size: 0.76rem;
  outline: none;
  width: 200px;
  max-width: 100%;
  font-family: inherit;
  transition: border-color 140ms ease;
}
.r-search:focus { border-color: var(--accent); }
.r-search::placeholder { color: var(--muted); opacity: 0.4; }

/* ── Loading ── */
.r-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80px 0;
  color: var(--muted);
  font-size: 0.8rem;
  gap: 10px;
}
.r-spinner {
  width: 20px; height: 20px;
  border: 2px solid var(--line);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Table container ── */
.r-table-wrap {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
}
.r-table-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

/* ── Table ── */
.r-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 600px;
}
.r-table thead th {
  text-align: left;
  padding: 9px 12px;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
  background: rgba(0,0,0,0.15);
}
.r-table thead th.center { text-align: center; }
.r-table thead th.right { text-align: right; }

.r-table tbody td {
  padding: 8px 12px;
  font-size: 0.8rem;
  border-bottom: 1px solid rgba(30,47,71,0.35);
  line-height: 1.4;
  vertical-align: top;
}
.r-table tbody tr { transition: background 100ms ease; }
.r-table tbody tr:nth-child(even) { background: rgba(255,255,255,0.006); }
.r-table tbody tr:hover { background: rgba(76,142,245,0.04); }

.r-table tbody td.center { text-align: center; }
.r-table tbody td.right { text-align: right; }
.r-table tbody td.muted { color: var(--muted); font-size: 0.76rem; }
.r-table tbody td.mono { font-variant-numeric: tabular-nums; font-size: 0.76rem; }
.r-table tbody td.bold { font-weight: 620; }

/* ── Table cell helpers ── */
.name-cell .primary { font-weight: 580; line-height: 1.3; }
.name-cell .sub { font-size: 0.62rem; color: var(--muted); opacity: 0.65; margin-top: 1px; }
.accent-link { color: var(--accent); text-decoration: none; font-weight: 600; }
.accent-link.upper { font-size: 0.64rem; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 680; }
.dim { opacity: 0.5; }
.r-empty { text-align: center; color: var(--muted); padding: 36px 12px !important; opacity: 0.5; }

/* BU chip */
.bu-chip {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 0.6rem;
  font-weight: 680;
  letter-spacing: 0.08em;
  margin: 0 1px;
}

/* Status dot */
.status-dot {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.74rem;
}
.status-dot .dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Priority */
.prio {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  justify-content: flex-end;
  font-variant-numeric: tabular-nums;
  font-size: 0.76rem;
  font-weight: 580;
}
.prio-dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Today badge */
.today-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 0.56rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: rgba(62,201,131,0.12);
  color: var(--success);
  vertical-align: middle;
}
.today-row { background: rgba(62,201,131,0.03) !important; }

/* Footer */
.r-table-footer {
  padding: 8px 12px;
  font-size: 0.66rem;
  color: var(--muted);
  opacity: 0.6;
  border-top: 1px solid var(--line);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.r-table-footer .accent-link { opacity: 1; }
`;
