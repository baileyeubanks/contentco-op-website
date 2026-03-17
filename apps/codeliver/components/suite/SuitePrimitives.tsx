"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  ChevronRight,
  FolderOpen,
  Sparkles,
} from "lucide-react";

export function SuitePage({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-2">
          {eyebrow ? (
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
              {eyebrow}
            </div>
          ) : null}
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
            {title}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-[var(--muted)]">
            {description}
          </p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[20px] border border-[color:rgba(52,211,153,0.12)] bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.88))] p-5 shadow-[0_20px_60px_rgba(2,6,23,0.28)] ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--ink)]">
            {title}
          </h2>
          {description ? (
            <p className="max-w-2xl text-sm leading-6 text-[var(--muted)]">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function MetricTile({
  label,
  value,
  note,
  accent = "var(--accent)",
}: {
  label: string;
  value: string | number;
  note: string;
  accent?: string;
}) {
  return (
    <div className="rounded-[18px] border border-[var(--border)] bg-[color:rgba(15,23,42,0.72)] p-4">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dim)]">
        {label}
      </div>
      <div className="text-2xl font-semibold tracking-[-0.04em]" style={{ color: accent }}>
        {value}
      </div>
      <div className="mt-2 text-sm leading-5 text-[var(--muted)]">{note}</div>
    </div>
  );
}

export function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const styles = normalized.includes("approved") || normalized.includes("final")
    ? "border-[color:rgba(34,197,94,0.2)] bg-[color:rgba(34,197,94,0.12)] text-[var(--green)]"
    : normalized.includes("review") || normalized.includes("pending")
      ? "border-[color:rgba(245,158,11,0.2)] bg-[color:rgba(245,158,11,0.12)] text-[var(--orange)]"
      : normalized.includes("change") || normalized.includes("reject")
        ? "border-[color:rgba(239,68,68,0.2)] bg-[color:rgba(239,68,68,0.12)] text-[var(--red)]"
        : "border-[var(--border)] bg-[color:rgba(255,255,255,0.04)] text-[var(--muted)]";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${styles}`}>
      {value.replaceAll(/_/g, " ")}
    </span>
  );
}

export function EmptyState({
  title,
  body,
  actionLabel,
  actionHref,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="rounded-[18px] border border-dashed border-[var(--border-light)] bg-[color:rgba(255,255,255,0.02)] px-6 py-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:rgba(52,211,153,0.12)] text-[var(--accent)]">
        <FolderOpen size={20} />
      </div>
      <div className="text-lg font-semibold text-[var(--ink)]">{title}</div>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">{body}</p>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90"
        >
          <Sparkles size={14} />
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function InlineActionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]"
    >
      {label}
      <ArrowRight size={12} />
    </Link>
  );
}

export function DetailList({
  items,
}: {
  items: Array<{ label: string; value: ReactNode; href?: string }>;
}) {
  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[color:rgba(255,255,255,0.02)] px-4 py-3"
        >
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--dim)]">
            {item.label}
          </span>
          {item.href ? (
            <Link
              href={item.href}
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--ink)] transition hover:text-[var(--accent)]"
            >
              {item.value}
              <ChevronRight size={14} />
            </Link>
          ) : (
            <span className="text-sm font-medium text-[var(--ink)]">{item.value}</span>
          )}
        </div>
      ))}
    </div>
  );
}
