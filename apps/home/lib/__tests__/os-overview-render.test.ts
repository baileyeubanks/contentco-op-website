import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
import type { RootOverviewReadModel } from "../os-overview";

const controls = vi.hoisted(() => ({ read: vi.fn(), pathname: "/os/overview" }));
vi.mock("@/lib/os-overview", () => ({ buildRootOverviewReadModel: controls.read }));
vi.mock("next/navigation", () => ({ usePathname: () => controls.pathname }));
import OverviewPage from "../../app/os/overview/page";
import { OsShell } from "../../app/os/components/os-shell";
import { getRootModulesForWorkspace } from "../os-module-registry";

function fixture(): RootOverviewReadModel {
  return {
    summary: {
      cards: [
        { label: "New quotes", value: 17, detail: "5 accepted this cycle", tone: "warning" },
        { label: "Jobs scheduled", value: 11, detail: "3 landing today", tone: "positive" },
        { label: "Contacts in play", value: 29, detail: "20 clients · 9 leads", tone: "neutral" },
        { label: "Quotes at risk", value: 4, detail: "37 total in the commercial lane", tone: "warning" },
      ],
      contactsTotal: 29, clientsTotal: 20, leadsTotal: 9, quotesTotal: 37,
      quotesNew: 17, quotesAccepted: 5, quotesAbandoned: 4,
      jobsTotal: 21, jobsScheduled: 11, jobsToday: 3,
    },
    recentQuotes: Array.from({ length: 8 }, (_, i) => ({
      id: `quote-${i}`, quoteNumber: `CC-Q-${i}`, clientName: `Quote client ${i}`,
      businessUnit: "CC", status: i % 2 ? "accepted" : "new",
      estimatedTotal: 1234 + i, createdAt: "2026-10-03T12:00:00Z",
    })),
    recentJobs: Array.from({ length: 10 }, (_, i) => ({
      id: `job-${i}`, title: `Work record ${i}`, clientName: i === 0 ? null : `Job client ${i}`,
      status: i < 6 ? "scheduled" : "completed", scheduledDate: "2026-10-05",
      scheduledStart: null, completedAt: i < 6 ? null : "2026-10-02T12:00:00Z",
      totalAmount: 4321 + i, bucket: i < 6 ? "upcoming" : "completed",
    })),
    contactsSnapshot: Array.from({ length: 8 }, (_, i) => ({
      id: `contact-${i}`, name: `Contact record ${i}`, email: null, company: `Company ${i}`,
      contactType: "client", priorityScore: i * 10, lastContacted: null,
    })),
    diagnostics: { status: "healthy", totalMs: 213, payloadBytes: 7890,
      timingsMs: { quotes_recent: 20, jobs_upcoming: 87, contacts_snapshot: 32 }, warnings: [] },
  };
}

let model: RootOverviewReadModel;
beforeEach(() => {
  model = fixture();
  controls.read.mockReset().mockImplementation(async () => model);
  controls.pathname = "/os/overview";
});
const render = async () => renderToStaticMarkup(await OverviewPage());
const renderShell = (children: ReactNode) => {
  const props = { brandKey: "cc" as const, children };
  return renderToStaticMarkup(createElement(OsShell, props));
};

test("uses one canonical snapshot and puts the work destination before quote activity", async () => {
  const html = await render();
  expect(controls.read).toHaveBeenCalledTimes(1);
  expect(html).toContain("Operations overview");
  expect(html.indexOf('href="/os/dispatch"')).toBeLessThan(html.indexOf('href="/os/quotes"'));
  expect(html).not.toContain("runtime reset");
  expect(html).not.toContain("mounted inside HOME");
});

test("retains all canonical metrics and detail text without deriving counts from short lists", async () => {
  const html = await render();
  for (const card of model.summary.cards) {
    expect(html).toContain(card.label);
    expect(html).toContain(`>${card.value.toLocaleString()}<`);
    expect(html).toContain(card.detail);
  }
});

test("keeps every supplied work, quote and contact row including completed work", async () => {
  const html = await render();
  for (const job of model.recentJobs) expect(html).toContain(job.title);
  for (const quote of model.recentQuotes) {
    expect(html).toContain(quote.clientName);
    expect(html).toContain(quote.quoteNumber);
  }
  for (const contact of model.contactsSnapshot) expect(html).toContain(contact.name);
  expect(html).toContain("Unassigned contact");
  expect(html).toContain("scheduled");
  expect(html).toContain("completed");
  expect(html).toContain("$4,321");
  expect(html).toContain("$1,234");
});

test("prioritizes the earliest supplied scheduled date without mutating the snapshot", async () => {
  const original = model.recentJobs[0];
  model.recentJobs = [
    { ...original, id: "later", title: "Later scheduled record", scheduledDate: "2026-10-08" },
    { ...original, id: "next", title: "Next scheduled record", scheduledDate: "2026-10-04" },
    { ...original, id: "same-day", title: "Same date record", scheduledDate: "2026-10-04" },
  ];
  const originalOrder = model.recentJobs.map(job => job.id);
  const html = await render();
  expect(html.indexOf("Next scheduled record")).toBeLessThan(html.indexOf("Later scheduled"));
  expect(html.indexOf("Same date record")).toBeLessThan(html.indexOf("Later scheduled"));
  expect(model.recentJobs.map(job => job.id)).toEqual(originalOrder);
  expect(html).not.toMatch(/overdue|urgent|due today/i);
});

test("completed records cannot become next scheduled even when supplied in the upcoming bucket", async () => {
  const original = model.recentJobs[0];
  model.recentJobs = [
    { ...original, id: "completed-upcoming", title: "Already completed record", status: "completed", bucket: "upcoming", scheduledDate: "2026-10-04" },
    { ...original, id: "next", title: "Actual next record", scheduledDate: "2026-10-06" },
  ];
  const html = await render();
  const completed = html.match(/<details[^>]*><summary>Recent completed work<\/summary>([\s\S]*?)<\/details>/);
  expect(completed?.[1]).toContain("Already completed record");
  expect(completed?.[1]).not.toContain("Actual next record");
  expect(html.indexOf("Actual next record")).toBeLessThan(html.indexOf("Recent completed work"));
  expect(html).not.toMatch(/<details[^>]*\bopen\b/);
});

test("unscheduled, cancelled and invalid-date records remain visible without a next-scheduled claim", async () => {
  const original = model.recentJobs[0];
  model.recentJobs = [
    { ...original, id: "cancelled", title: "Cancelled record", status: "cancelled", scheduledDate: "2026-10-04" },
    { ...original, id: "missing-date", title: "Missing date record", scheduledDate: null },
    { ...original, id: "invalid-date", title: "Invalid date record", scheduledDate: "invalid" },
  ];
  const html = await render();
  for (const job of model.recentJobs) expect(html).toContain(job.title);
  expect(html).toContain("Other work");
  expect(html).not.toContain("Next scheduled");
});

test("read diagnostics remain complete behind a closed disclosure with the system destination available", async () => {
  const html = await render();
  const details = html.match(/<details[^>]*><summary>Read diagnostics<\/summary>([\s\S]*?)<\/details>/);
  expect(details?.[1]).toContain("Route classification");
  expect(details?.[1]).toContain("213ms");
  expect(details?.[1]).toContain("7,890 bytes");
  expect(html).not.toMatch(/<details[^>]*\bopen\b/);
  expect(html.indexOf('href="/os/system"')).toBeGreaterThan(html.indexOf("</details>", html.indexOf("Read diagnostics")));
});

test("keeps the four existing navigation actions and adds no write controls", async () => {
  const html = await render();
  const destinations = [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1]);
  expect(destinations).toEqual(["/os/dispatch", "/os/quotes", "/os/contacts", "/os/system"]);
  for (const label of ["Open dispatch", "Open quotes", "Open contacts", "Open system"]) {
    expect(html).toContain(label);
  }
  expect(html).not.toMatch(/<(button|form|input)\b/);
});

test.each(["healthy", "degraded", "slow"] as const)("reports %s read status without losing detailed diagnostics", async status => {
  model.diagnostics.status = status;
  const html = await render();
  expect(html).toContain(`Data reads: ${status}`);
  expect(html).toContain("213ms");
  expect(html).toContain("7,890 bytes");
  expect(html).toContain("Slowest read: jobs_upcoming");
  expect(html).toContain("87ms");
  expect(html).toContain("37 total");
  expect(html).toContain("21 total");
});

test("empty snapshots preserve each unavailable-data message, warning and its next destination", async () => {
  model.recentJobs = [];
  model.recentQuotes = [];
  model.contactsSnapshot = [];
  model.diagnostics.status = "degraded";
  model.diagnostics.warnings = ['jobs_upcoming: <unavailable>'];
  const html = await render();
  expect(html).toContain("No recent job activity was loaded for this workspace.");
  expect(html).toContain("No recent quote activity was loaded for this workspace.");
  expect(html).toContain("No contact snapshot is available for this workspace yet.");
  expect(html).toContain("jobs_upcoming: &lt;unavailable&gt;");
  expect(html.indexOf("jobs_upcoming: &lt;unavailable&gt;")).toBeLessThan(html.indexOf('href="/os/dispatch"'));
  expect(html).not.toContain("No query warnings on this render.");
  for (const href of ["/os/dispatch", "/os/quotes", "/os/contacts", "/os/system"]) {
    expect(html).toContain(`href="${href}"`);
  }
});

test("an absent timing map produces no invented slowest read", async () => {
  model.diagnostics.timingsMs = {};
  const html = await render();
  expect(html).not.toContain("Slowest read:");
  expect(html).not.toContain("NaN");
  expect(html).toContain("No query warnings on this render.");
});

test("the complete overview and shell expose one main landmark", async () => {
  const html = renderShell(await OverviewPage());
  expect(html.match(/<main[ >]/g)).toHaveLength(1);
  expect(html).toContain("Operations overview");
  expect(html).toContain("Work record 9");
});

test.each(["/os/overview", "/os/quotes", "/os/contacts", "/os/dispatch"])(
  "CCO shell keeps the registered navigation and page content on %s", pathname => {
    controls.pathname = pathname;
    const html = renderShell("Existing route content");
    const modules = [
      ...getRootModulesForWorkspace("cc", "core"),
      ...getRootModulesForWorkspace("cc", "advanced"),
    ];
    for (const entry of modules) expect(html).toContain(`href="${entry.href}"`);
    expect(html).toContain("Existing route content");
    for (const scope of ["ALL", "ACS", "CC"]) expect(html).toContain(`>${scope}</button>`);
  },
);

test.each(["/os", "/os/login", "/os/system/map"])("bare route %s retains its own surface", pathname => {
  controls.pathname = pathname;
  const html = renderShell("Bare route content");
  expect(html).toBe("Bare route content");
});
