"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Activity,
  BellPlus,
  CirclePlus,
  Compass,
  FolderKanban,
  House,
  Library,
  Search,
  Settings,
  Sparkles,
  Users,
  Video,
  WandSparkles,
  ChevronDown,
  LogOut,
  FolderOpen,
} from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import NotificationBell from "@/components/notifications/NotificationBell";

const NAV = [
  { href: "/", label: "Home", icon: House },
  { href: "/library", label: "Content Library", icon: Library },
  { href: "/webinars", label: "Webinars", icon: Video },
  { href: "/analytics", label: "Analytics", icon: Activity },
  { href: "/remix", label: "Remix", icon: WandSparkles },
  { href: "/team", label: "Team", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

const QUICK_ACTIONS = [
  {
    href: "/projects",
    label: "Upload and review",
    description: "Jump into the internal project workspace and add a review asset.",
    icon: CirclePlus,
  },
  {
    href: "/projects/new",
    label: "New project",
    description: "Create a fresh delivery workspace before inviting reviewers.",
    icon: FolderKanban,
  },
  {
    href: "/webinars",
    label: "Record or request",
    description: "Open the staged webinar and capture entry points for future production.",
    icon: Video,
  },
  {
    href: "/library",
    label: "Prepare share-ready review",
    description: "Find an asset in the library and generate a controlled review link.",
    icon: Compass,
  },
] as const;

const PRODUCT_LINKS = [
  {
    href: process.env.NEXT_PUBLIC_MONOREPO_URL ?? "https://github.com/baileyeubanks/blaze-v4",
    label: "Monorepo",
    external: true,
  },
  {
    href: process.env.NEXT_PUBLIC_COCUT_URL ?? "http://localhost:5173",
    label: "co-cut",
    external: false,
  },
  {
    href: process.env.NEXT_PUBLIC_COSCRIPT_URL ?? "http://localhost:4102",
    label: "co-script",
    external: false,
  },
  {
    href: process.env.NEXT_PUBLIC_CODELIVER_URL ?? "http://localhost:4103",
    label: "co-deliver",
    external: false,
  },
] as const;

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const pageLabel = useMemo(() => {
    const active = NAV.find((item) => (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)));
    if (active) return active.label;
    if (pathname.startsWith("/projects")) return "Projects";
    return "Co-Deliver";
  }, [pathname]);

  async function handleLogout() {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    if (!query) {
      router.push("/library");
      return;
    }
    router.push(`/library?search=${encodeURIComponent(query)}`);
    setCreateOpen(false);
  }

  return (
    <div className="flex min-h-screen bg-transparent">
      <aside className="sticky top-0 hidden h-screen w-72 flex-shrink-0 border-r border-[var(--border)] bg-[linear-gradient(180deg,rgba(7,13,24,0.96),rgba(9,18,33,0.92))] px-5 py-5 lg:flex">
        <div className="flex w-full flex-col gap-6">
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:rgba(52,211,153,0.14)] text-[var(--accent)] shadow-[0_0_0_1px_rgba(52,211,153,0.18)]">
                <BellPlus size={18} />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                  Content Co-op
                </div>
                <div className="text-lg font-semibold tracking-[-0.04em] text-[var(--ink)]">
                  co-deliver
                </div>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => setCreateOpen((value) => !value)}
              className="flex w-full items-center justify-between rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90"
            >
              <span className="inline-flex items-center gap-2">
                <CirclePlus size={16} />
                Create
              </span>
              <ChevronDown size={16} className={createOpen ? "rotate-180 transition-transform" : "transition-transform"} />
            </button>

            {createOpen ? (
              <div className="grid gap-2 rounded-[18px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.02)] p-3">
                {QUICK_ACTIONS.map((action) => (
                  <Link
                    key={action.label}
                    href={action.href}
                    className="rounded-2xl border border-transparent px-3 py-3 transition hover:border-[color:rgba(52,211,153,0.16)] hover:bg-[color:rgba(52,211,153,0.06)]"
                    onClick={() => setCreateOpen(false)}
                  >
                    <div className="mb-1 inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                      <action.icon size={14} className="text-[var(--accent)]" />
                      {action.label}
                    </div>
                    <div className="text-xs leading-5 text-[var(--muted)]">{action.description}</div>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <nav className="grid gap-1">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition ${
                    active
                      ? "border border-[color:rgba(52,211,153,0.14)] bg-[color:rgba(52,211,153,0.1)] text-[var(--accent)]"
                      : "text-[var(--muted)] hover:bg-[color:rgba(255,255,255,0.03)] hover:text-[var(--ink)]"
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto grid gap-3">
            <Link
              href="/projects"
              className="flex items-center gap-3 rounded-2xl border border-[var(--border)] px-3 py-3 text-sm font-medium text-[var(--muted)] transition hover:text-[var(--ink)]"
            >
              <FolderOpen size={16} />
              Internal Projects
            </Link>
            <div className="rounded-[18px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.02)] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--dim)]">
                Review Core
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Wistia-style suite on the outside, Wipster-grade versions, timecodes, approvals, and share controls inside the review room.
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-[var(--muted)] transition hover:bg-[color:rgba(255,255,255,0.03)] hover:text-[var(--red)]"
            >
              <LogOut size={16} />
              Log out
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color:rgba(8,17,31,0.92)] px-4 py-4 backdrop-blur lg:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--dim)]">
                  Monorepo Apps
                </span>
                {PRODUCT_LINKS.map((item) => {
                  const active = item.label === "co-deliver";
                  return (
                    <a
                      key={item.label}
                      href={item.href}
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noreferrer" : undefined}
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] transition ${
                        active
                          ? "border-[color:rgba(52,211,153,0.24)] bg-[color:rgba(52,211,153,0.12)] text-[var(--accent)]"
                          : "border-[var(--border)] text-[var(--muted)] hover:border-[color:rgba(52,211,153,0.18)] hover:text-[var(--ink)]"
                      }`}
                    >
                      {item.label}
                    </a>
                  );
                })}
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dim)]">
                Suite Surface
              </div>
              <div className="text-lg font-semibold tracking-[-0.04em] text-[var(--ink)]">
                {pageLabel}
              </div>
            </div>

            <div className="flex flex-1 items-center gap-3 lg:max-w-3xl lg:justify-end">
              <form onSubmit={submitSearch} className="relative flex-1 lg:max-w-xl">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--dim)]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search library, projects, and review assets"
                  className="w-full rounded-full border border-[var(--border)] bg-[color:rgba(255,255,255,0.04)] py-2.5 pl-10 pr-4 text-sm text-[var(--ink)] placeholder:text-[var(--dim)] outline-none transition focus:border-[var(--accent)]"
                />
              </form>

              <div className="hidden lg:block">
                <NotificationBell />
              </div>
              <Link
                href="/remix"
                className="hidden items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:border-[color:rgba(52,211,153,0.16)] lg:inline-flex"
              >
                <Sparkles size={14} className="text-[var(--accent)]" />
                Remix
              </Link>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
