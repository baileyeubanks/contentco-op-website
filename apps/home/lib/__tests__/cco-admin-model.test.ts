import { describe, expect, test } from "vitest";
import {
  buildCcoAdminReadModel,
  buildCcoIntakeTransaction,
  validateCcoIntakePayload,
} from "../cco-admin-model";

const intake = {
  sourcePath: "/brief",
  contact: {
    name: "Avery Brooks",
    email: "AVERY@EXAMPLE.COM",
    phone: "(501) 351-5927",
    company: "Example Industrial",
    role: "Marketing Director",
    website: "https://example.com",
    address: "Houston, TX",
  },
  project: {
    projectTypes: ["Brand film", "Social content"],
    projectName: "Launch proof film",
    goal: "Build trust",
    audience: "Prospects and hiring candidates",
    placements: ["Website", "Social"],
    deliverables: ["Main film", "Social cutdown"],
    timeline: "2-4 weeks",
    budgetRange: "$10,000-$20,000",
    projectContext:
      "We need a credible story that shows the work, explains the offer, and can be used by sales and recruiting without sounding generic.",
    successDefinition: "A clear proposal and approved production plan.",
  },
  bookingPreference: "30",
};

describe("CCO admin model", () => {
  test("builds the full Firestore handoff graph from public intake", () => {
    const transaction = buildCcoIntakeTransaction(intake);

    expect(transaction.intake.contact.email).toBe("avery@example.com");
    expect(transaction.records.person.roles).toContain("lead");
    expect(transaction.records.organization?.name).toBe("Example Industrial");
    expect(transaction.records.brief.status).toBe("enriching");
    expect(transaction.records.estimate.totalCents).toBeGreaterThan(0);
    expect(transaction.records.proposalVersion).toMatchObject({ version: 1, status: "draft" });
    expect(transaction.records.emailOutbox.map((email) => email.template)).toEqual(
      expect.arrayContaining(["brief_submitted_admin", "brief_submitted_client"]),
    );
    expect(transaction.records.handoffs.map((handoff) => handoff.appKey)).toEqual([
      "co_produce",
      "co_edit",
      "co_deliver",
    ]);
    expect(transaction.writes.map((write) => write.collection)).toEqual(
      expect.arrayContaining([
        "people",
        "organizations",
        "relationships",
        "briefs",
        "estimates",
        "proposalVersions",
        "approvals",
        "enrichmentRuns",
        "emailOutbox",
        "auditEvents",
        "appHandoffs",
      ]),
    );
  });

  test("rejects missing client contact and project context before proposal creation", () => {
    const transaction = buildCcoIntakeTransaction({
      contact: { name: "", email: "bad", phone: "1", company: "", address: "" },
      project: { projectContext: "" },
    });

    expect(validateCcoIntakePayload(transaction.intake)).toMatchObject({
      name: "Name is required.",
      email: "A valid email is required.",
      phone: "A valid phone number is required.",
      company: "Company is required.",
      address: "Company address or location is required.",
      projectContext: "Project context is required.",
    });
  });

  test("admin read model is CCO-only and exposes the expected modules", () => {
    const model = buildCcoAdminReadModel();

    expect(model.adminUsers.map((admin) => admin.email)).toEqual([
      "bailey@contentco-op.com",
      "blaze@contentco-op.com",
    ]);
    expect(model.collections.map((collection) => collection.name)).toEqual(
      expect.arrayContaining(["people", "briefs", "estimates", "appHandoffs", "auditEvents"]),
    );
    expect(model.apps.map((app) => app.appKey)).toEqual(["co_produce", "co_edit", "co_deliver"]);
  });
});
