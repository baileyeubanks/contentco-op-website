import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateProposal: vi.fn(async () => ({
    title: "Test proposal",
    summary: "Only used to prove the route rejects an unpersisted brief first.",
  })),
}));

vi.mock("@/lib/cco-firebase-server", () => ({
  commitCcoFirestoreWrites: vi.fn(async () => ({
    ok: true,
    committed: false,
    mode: "local_contract",
    writeCount: 0,
    paths: [],
  })),
  getCcoFirebaseAdminStatus: vi.fn(() => ({ configured: false, mode: "local_contract" })),
  getCcoFirebaseApp: vi.fn(() => null),
}));

vi.mock("@/lib/gemini", () => ({
  generateProposal: mocks.generateProposal,
}));

import { POST as leadPOST } from "@/app/api/cco/leads/route";
import { POST as briefPOST } from "@/app/api/cco/briefs/route";
import { POST as proposalPOST } from "@/app/api/cco/briefs/proposal/route";

const contact = {
  name: "Avery Brooks",
  email: "avery@example.com",
  phone: "+15015551234",
  company: "Example Industrial",
  role: "Marketing Director",
  website: "https://example.com",
  address: "Houston, TX",
};

const project = {
  projectTypes: ["Brand film"],
  projectName: "Launch proof film",
  audience: "Prospective industrial clients",
  projectContext: "We need a credible launch film that proves the work and supports sales conversations.",
  placements: ["Website"],
  deliverables: ["Main film"],
  timeline: "2-4 weeks",
  budgetRange: "$10,000-$20,000",
  successDefinition: "A clear proposal and production plan.",
};

function request(path: string, body: Record<string, unknown>, ip: string) {
  return new Request(`https://contentco-op.com${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "https://contentco-op.com",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

describe("public CCO intake persistence boundary", () => {
  beforeEach(() => {
    // An absent or mismatched CCO-DB binding must never become a local-preview success.
    for (const name of [
      "CCO_SUPABASE_URL",
      "CCO_SUPABASE_SERVICE_ROLE_KEY",
      "CCO_SUPABASE_SERVICE_KEY",
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_SERVICE_KEY",
      "NEXT_PUBLIC_SUPABASE_URL",
    ]) {
      vi.stubEnv(name, "");
    }
    mocks.generateProposal.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("lead capture rejects an unconfigured persistence binding", async () => {
    const response = await leadPOST(request("/api/cco/leads", { contact }, "198.51.100.11"));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: "cco_persistence_unavailable",
      retryable: true,
    });
  });

  test("brief submission rejects an unconfigured persistence binding", async () => {
    const response = await briefPOST(
      request(
        "/api/cco/briefs",
        { sourcePath: "/brief", contact, project, bookingPreference: "20" },
        "198.51.100.12",
      ),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: "cco_persistence_unavailable",
      retryable: true,
    });
  });

  test("proposal generation refuses an unpersisted brief", async () => {
    const response = await proposalPOST(
      request(
        "/api/cco/briefs/proposal",
        { briefId: "087f0d4f-76b6-4ed5-bb4c-0570c5752e73", accessToken: "a".repeat(32) },
        "198.51.100.13",
      ),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: "cco_persistence_unavailable",
      retryable: true,
    });
    expect(mocks.generateProposal).not.toHaveBeenCalled();
  });

  test("proposal generation rejects caller-supplied contact and scope payloads", async () => {
    const response = await proposalPOST(
      request(
        "/api/cco/briefs/proposal",
        {
          briefId: "087f0d4f-76b6-4ed5-bb4c-0570c5752e73",
          accessToken: "a".repeat(32),
          contact,
          project,
        },
        "198.51.100.14",
      ),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "invalid_proposal_request" });
    expect(mocks.generateProposal).not.toHaveBeenCalled();
  });
});
