import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  persistCcoBrief: vi.fn(),
  rateLimit: vi.fn(() => ({ success: true, resetAt: Date.now() + 60_000 })),
  getClientIp: vi.fn(() => "198.51.100.77"),
  validateCsrf: vi.fn(() => ({ valid: true })),
}));

vi.mock("@/lib/cco-public-intake", () => ({ persistCcoBrief: mocks.persistCcoBrief }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit, getClientIp: mocks.getClientIp }));
vi.mock("@/lib/csrf", () => ({ validateCsrf: mocks.validateCsrf }));

import { POST } from "@/app/api/cco/briefs/route";

const body = {
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
    projectContext: "A durable persistence test for a creative brief.",
    placements: ["Website"],
    deliverables: ["Main film"],
    timeline: "2-4 weeks",
  },
  bookingPreference: "20",
  submissionId: "b4a6bb35-0062-4b95-9de0-3b12976465bb",
};

describe("CCO public brief replay conflict", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("tells the browser to clear an unsafe replay key instead of retrying it forever", async () => {
    mocks.persistCcoBrief.mockResolvedValue({
      ok: false,
      persisted: false,
      error: "brief_submission_conflict",
      retryable: false,
    });

    const response = await POST(new Request("https://contentco-op.com/api/cco/briefs", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: "https://contentco-op.com" },
      body: JSON.stringify(body),
    }));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "brief_submission_conflict",
      code: "brief_submission_conflict",
      retryable: false,
      persisted: false,
    });
  });
});
