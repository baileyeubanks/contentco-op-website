import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  persistCcoLead: vi.fn(),
  persistCcoBrief: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("@/lib/cco-public-intake", () => ({
  persistCcoLead: mocks.persistCcoLead,
  persistCcoBrief: mocks.persistCcoBrief,
}));

vi.mock("@/lib/cco-owner-lead-alert", () => ({
  notifyCcoOwnerOfStoredLeadSafely: mocks.notify,
}));

import { POST as leadsPOST } from "@/app/api/cco/leads/route";
import { POST as briefsPOST } from "@/app/api/cco/briefs/route";

let ipNonce = 0;

function request(path: string, body: unknown) {
  ipNonce += 1;
  return new Request(`https://contentco-op.com${path}`, {
    method: "POST",
    headers: {
      origin: "https://contentco-op.com",
      "content-type": "application/json",
      "x-forwarded-for": `203.0.113.${ipNonce}`,
    },
    body: JSON.stringify(body),
  });
}

const leadBody = {
  contact: {
    name: "Avery Brooks",
    email: "avery@example.com",
    phone: "+15015551234",
    company: "Example Industrial",
  },
};

const briefBody = {
  sourcePath: "/brief",
  contact: {
    name: "Avery Brooks",
    email: "avery@example.com",
    phone: "+15015551234",
    company: "Example Industrial",
    address: "Houston, TX",
  },
  project: {
    projectTypes: ["Brand film"],
    projectName: "Launch proof film",
    projectContext: "We need a credible launch film that proves the work.",
    placements: ["Website"],
    deliverables: ["Main film"],
    timeline: "2-4 weeks",
    budgetRange: "$10,000-$20,000",
  },
  bookingPreference: "20",
};

describe("CCO owner lead alert routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notify.mockResolvedValue({ ok: true, blockedSubmission: false });
  });

  test("a stored lead triggers one owner alert and still returns 200", async () => {
    mocks.persistCcoLead.mockResolvedValue({
      ok: true,
      persisted: true,
      contactId: "contact-lead-1",
      replayed: false,
    });

    const response = await leadsPOST(request("/api/cco/leads", leadBody));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      persisted: true,
      contact_id: "contact-lead-1",
    });
    expect(mocks.notify).toHaveBeenCalledTimes(1);
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({
      leadId: "contact-lead-1",
      name: "Avery Brooks",
      company: "Example Industrial",
      leadEmail: "avery@example.com",
      leadPhone: "+15015551234",
    }));
  });

  test("lead submission succeeds when the owner alert throws", async () => {
    mocks.persistCcoLead.mockResolvedValue({
      ok: true,
      persisted: true,
      contactId: "contact-lead-2",
      replayed: false,
    });
    mocks.notify.mockRejectedValue(new Error("transport_exploded"));

    const response = await leadsPOST(request("/api/cco/leads", leadBody));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, persisted: true });
  });

  test("an unstored lead does not send an owner alert", async () => {
    mocks.persistCcoLead.mockResolvedValue({
      ok: false,
      persisted: false,
      error: "cco_db_configuration_missing",
      retryable: true,
    });

    const response = await leadsPOST(request("/api/cco/leads", leadBody));
    expect(response.status).toBe(503);
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  test("a stored brief whose intake notify failed still returns 200 and alerts Bailey", async () => {
    mocks.persistCcoBrief.mockResolvedValue({
      ok: false,
      persisted: true,
      error: "notification_log_write",
      retryable: true,
      contactId: "contact-brief-1",
      briefId: "brief-1",
    });

    const response = await briefsPOST(request("/api/cco/briefs", briefBody));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      persisted: true,
      id: "brief-1",
    });
    expect(mocks.notify).toHaveBeenCalledTimes(1);
    expect(mocks.notify.mock.calls[0][0]).toMatchObject({
      leadId: "contact-brief-1",
      briefId: "brief-1",
      projectSummary: "Launch proof film",
      budget: "$10,000-$20,000",
      timeline: "2-4 weeks",
      leadEmail: "avery@example.com",
    });
  });

  test("brief submission succeeds when owner alert transports fail", async () => {
    mocks.persistCcoBrief.mockResolvedValue({
      ok: true,
      persisted: true,
      replayed: false,
      contactId: "contact-brief-2",
      briefId: "brief-2",
      accessToken: "token-2",
      status: "submitted",
      briefNumber: null,
      notification: {
        admin: { status: "failed", logId: "n1" },
        client: { status: "failed", logId: "n2" },
      },
    });
    mocks.notify.mockResolvedValue({
      ok: true,
      blockedSubmission: false,
      email: { delivered: false },
      sms: { delivered: false },
    });

    const response = await briefsPOST(request("/api/cco/briefs", briefBody));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, persisted: true });
  });
});
