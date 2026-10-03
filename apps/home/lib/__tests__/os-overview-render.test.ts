import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
import type { RootOverviewReadModel } from "../os-overview";

const controls = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/os-overview", () => ({ buildRootOverviewReadModel: controls.read }));
import OverviewPage from "../../app/os/overview/page";

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
});
const render = async () => renderToStaticMarkup(await OverviewPage());

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
