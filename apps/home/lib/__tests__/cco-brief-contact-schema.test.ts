import { describe, expect, test } from "vitest";
import { BriefContactSchema, normalizeBriefWebsite } from "@/lib/validation";

const base = { name: "Jane Smith", email: "jane@acme.com", company: "Acme" };

describe("public brief contact: only name, email and company are required", () => {
  test("accepts a contact with no phone and no location", () => {
    expect(BriefContactSchema.safeParse(base).success).toBe(true);
    expect(BriefContactSchema.safeParse({ ...base, phone: "", address: "" }).success).toBe(true);
  });

  test("a phone, when given, still needs 10 digits", () => {
    expect(BriefContactSchema.safeParse({ ...base, phone: "555-01" }).success).toBe(false);
    expect(BriefContactSchema.safeParse({ ...base, phone: "(713) 555-0199" }).success).toBe(true);
  });

  test("still rejects a missing name, email or company", () => {
    expect(BriefContactSchema.safeParse({ ...base, name: "" }).success).toBe(false);
    expect(BriefContactSchema.safeParse({ ...base, email: "nope" }).success).toBe(false);
    expect(BriefContactSchema.safeParse({ ...base, company: "" }).success).toBe(false);
  });

  test("a bare domain website no longer fails the final submit", () => {
    expect(BriefContactSchema.safeParse({ ...base, website: "acme.com" }).success).toBe(true);
    expect(normalizeBriefWebsite("acme.com")).toBe("https://acme.com");
    expect(normalizeBriefWebsite(" https://acme.com ")).toBe("https://acme.com");
    expect(normalizeBriefWebsite("")).toBe("");
  });
});

describe("lead snapshot basics", () => {
  test("accepts optional quote basics and rejects oversized ones", async () => {
    const { LeadSchema } = await import("@/lib/validation");
    const contact = { name: "Jane Smith", email: "jane@acme.com", company: "Acme" };
    expect(LeadSchema.safeParse({ contact }).success).toBe(true);
    expect(LeadSchema.safeParse({ contact, basics: { projectTypes: ["brand"], summary: "Plant video", timeline: "ASAP" } }).success).toBe(true);
    expect(LeadSchema.safeParse({ contact, basics: { summary: "x".repeat(1001) } }).success).toBe(false);
  });
});
