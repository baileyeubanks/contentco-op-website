"use client";

import Link from "next/link";
import {
  Bell,
  ChevronRight,
  KeyRound,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import NotificationPreferences from "@/components/notifications/NotificationPreferences";
import {
  DetailList,
  SectionCard,
  SuitePage,
} from "@/components/suite/SuitePrimitives";

export default function SettingsPage() {
  return (
    <SuitePage
      eyebrow="Workspace Controls"
      title="Settings and operating defaults"
      description="Tune review defaults, notification behavior, and adjacent admin surfaces that support delivery quality across the suite."
      actions={
        <Link
          href="/settings/integrations"
          className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90"
        >
          Open integrations catalog
        </Link>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <SectionCard
          title="Workspace defaults"
          description="Polished control surfaces that keep review delivery opinionated without pretending every preference is already backed by a dedicated settings table."
        >
          <div className="grid gap-4">
            <div className="rounded-[18px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] p-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                <ShieldCheck size={15} className="text-[var(--accent)]" />
                Review defaults
              </div>
              <p className="text-sm leading-6 text-[var(--muted)]">
                Current product stance keeps review links expirable, versions current-by-default, and PDF exports oriented around client-ready reporting.
              </p>
              <div className="mt-4">
                <DetailList
                  items={[
                    { label: "Link expiration", value: "Default 7-day review window" },
                    { label: "Version behavior", value: "Newest upload becomes current" },
                    { label: "Primary export", value: "PDF review report with versions and comments" },
                  ]}
                />
              </div>
            </div>

            <div className="rounded-[18px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] p-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                <SlidersHorizontal size={15} className="text-[var(--accent)]" />
                Admin lanes
              </div>
              <DetailList
                items={[
                  { label: "Team access", value: "Members, invites, audit", href: "/team" },
                  { label: "Integrations", value: "Catalog and roadmap", href: "/settings/integrations" },
                  { label: "Library ops", value: "Folders, tags, archive controls", href: "/library" },
                ]}
              />
            </div>

            <div className="rounded-[18px] border border-dashed border-[var(--border-light)] bg-[color:rgba(255,255,255,0.02)] p-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                <KeyRound size={15} className="text-[var(--accent)]" />
                v1 scope note
              </div>
              <p className="text-sm leading-6 text-[var(--muted)]">
                These settings focus on working review operations. Provider authentication, policy engines, and enterprise admin workflows can layer in later without changing this information architecture.
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Notification preferences"
          description="This area is fully functional and backed by the existing preferences API."
          action={
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--dim)]">
              <Bell size={13} />
              Live settings
            </div>
          }
        >
          <NotificationPreferences />
        </SectionCard>
      </div>

      <SectionCard
        title="Adjacent surfaces"
        description="Quick jumps into other suite surfaces that usually pair with settings work."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Integrations catalog",
              body: "Review staged provider connections and ingest/export opportunities.",
              href: "/settings/integrations",
              icon: Sparkles,
            },
            {
              title: "Team administration",
              body: "Manage people, roles, invites, and audit log trails.",
              href: "/team",
              icon: ShieldCheck,
            },
            {
              title: "Library operations",
              body: "Move assets, archive work, and keep the content hub clean.",
              href: "/library",
              icon: SlidersHorizontal,
            },
          ].map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="rounded-[18px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.02)] p-5 transition hover:border-[color:rgba(52,211,153,0.16)]"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:rgba(52,211,153,0.12)] text-[var(--accent)]">
                <item.icon size={17} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-base font-semibold text-[var(--ink)]">{item.title}</div>
                <ChevronRight size={16} className="text-[var(--dim)]" />
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.body}</p>
            </Link>
          ))}
        </div>
      </SectionCard>
    </SuitePage>
  );
}
