import { afterEach, describe, expect, test, vi } from "vitest";
import {
  CCO_BRIEF_DRAFT_STORAGE_KEY,
  CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY,
  canRetryCcoBriefDelivery,
  clearCcoBriefSubmissionStorage,
  getCcoBriefDeliveryIssue,
  getCcoBriefSubmissionId,
  bindLegacyCcoBriefSubmissionId,
  clearCcoBriefSubmission,
  resolveCcoBriefSubmissionId,
} from "../cco-public-intake-client";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) || null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CCO public brief retry storage", () => {
  test("clears a completed submission UUID so the next brief receives a new id", () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("localStorage", storage);

    const first = getCcoBriefSubmissionId(null, () => "first-submission-id");
    storage.setItem(CCO_BRIEF_DRAFT_STORAGE_KEY, "completed-draft");
    clearCcoBriefSubmissionStorage();
    const next = getCcoBriefSubmissionId(null, () => "next-submission-id");

    expect(first).toBe("first-submission-id");
    expect(storage.getItem(CCO_BRIEF_DRAFT_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY)).toBe("next-submission-id");
    expect(next).toBe("next-submission-id");
  });

  test("A then A reuses the unresolved id", () => {
    vi.stubGlobal("localStorage", new MemoryStorage());
    const memory: Record<string, string> = {};
    const first = resolveCcoBriefSubmissionId(memory, "a@example.com", () => "id-a");
    const again = getCcoBriefSubmissionId(null, () => "id-unused", "a@example.com");
    expect(first).toBe("id-a");
    expect(again).toBe("id-a");
  });

  test("A then B then A finds A's id again; B gets its own", () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("localStorage", storage);
    const ids = ["id-a", "id-b", "id-extra"];
    const create = () => ids.shift()!;
    const memory: Record<string, string> = {};
    expect(resolveCcoBriefSubmissionId(memory, "a@example.com", create)).toBe("id-a");
    expect(resolveCcoBriefSubmissionId(memory, "b@example.com", create)).toBe("id-b");
    // a fresh page load (empty memory) still finds both from storage
    expect(getCcoBriefSubmissionId(null, create, "a@example.com")).toBe("id-a");
    expect(getCcoBriefSubmissionId(null, create, "b@example.com")).toBe("id-b");
    expect(ids).toEqual(["id-extra"]);
  });

  test("completing one email clears only that email's id", () => {
    vi.stubGlobal("localStorage", new MemoryStorage());
    const memory: Record<string, string> = {};
    resolveCcoBriefSubmissionId(memory, "a@example.com", () => "id-a");
    resolveCcoBriefSubmissionId(memory, "b@example.com", () => "id-b");
    clearCcoBriefSubmission(memory, "a@example.com");
    expect(getCcoBriefSubmissionId(null, () => "id-a2", "a@example.com")).toBe("id-a2");
    expect(getCcoBriefSubmissionId(null, () => "unused", "b@example.com")).toBe("id-b");
  });

  test("a legacy unscoped id from production is kept and bound to its saved draft's email", () => {
    const storage = new MemoryStorage();
    storage.setItem(CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY, "legacy-id");
    storage.setItem(CCO_BRIEF_DRAFT_STORAGE_KEY, JSON.stringify({ email: " Avery@Example.com " }));
    vi.stubGlobal("localStorage", storage);

    // the unchanged returning visitor keeps the original id
    expect(getCcoBriefSubmissionId(null, () => "must-not-be-used", "avery@example.com")).toBe("legacy-id");
    expect(storage.getItem(CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY)).toBeNull();
    // a different email is a different brief and does not inherit it
    expect(getCcoBriefSubmissionId(null, () => "new-for-b", "b@example.com")).toBe("new-for-b");
    // and the original is still there afterwards
    expect(getCcoBriefSubmissionId(null, () => "must-not-be-used", "avery@example.com")).toBe("legacy-id");
  });

  test("a legacy id whose draft email cannot be established is kept for the current email, never replaced", () => {
    const storage = new MemoryStorage();
    storage.setItem(CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY, "legacy-id");
    vi.stubGlobal("localStorage", storage);
    expect(getCcoBriefSubmissionId(null, () => "must-not-be-used", "anyone@example.com")).toBe("legacy-id");
  });

  test("page-load binding uses the draft before autosave rewrites it", () => {
    const storage = new MemoryStorage();
    storage.setItem(CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY, "legacy-id");
    storage.setItem(CCO_BRIEF_DRAFT_STORAGE_KEY, JSON.stringify({ email: "a@example.com" }));
    vi.stubGlobal("localStorage", storage);
    expect(bindLegacyCcoBriefSubmissionId()).toEqual({ id: "legacy-id", scope: "a@example.com" });
    // the visitor then edits the form to B and autosave overwrites the draft
    storage.setItem(CCO_BRIEF_DRAFT_STORAGE_KEY, JSON.stringify({ email: "b@example.com" }));
    expect(getCcoBriefSubmissionId(null, () => "new-b", "b@example.com")).toBe("new-b");
    expect(getCcoBriefSubmissionId(null, () => "unused", "a@example.com")).toBe("legacy-id");
  });

  test("storage-write failure: the in-memory map still gives A, B, A stable ids", () => {
    const storage = new MemoryStorage();
    storage.setItem = () => { throw new Error("quota"); };
    vi.stubGlobal("localStorage", storage);
    const ids = ["id-a", "id-b"];
    const create = () => ids.shift()!;
    const memory: Record<string, string> = {};
    expect(resolveCcoBriefSubmissionId(memory, "a@example.com", create)).toBe("id-a");
    expect(resolveCcoBriefSubmissionId(memory, "b@example.com", create)).toBe("id-b");
    expect(resolveCcoBriefSubmissionId(memory, "a@example.com", create)).toBe("id-a");
    expect(memory).toEqual({ "a@example.com": "id-a", "b@example.com": "id-b" });
  });

  test("storage-write failure during legacy binding still returns the legacy id", () => {
    const storage = new MemoryStorage();
    storage.setItem(CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY, "legacy-id");
    storage.setItem(CCO_BRIEF_DRAFT_STORAGE_KEY, JSON.stringify({ email: "a@example.com" }));
    const realSet = storage.setItem.bind(storage);
    storage.setItem = (key: string, value: string) => { if (key.includes("ids")) throw new Error("quota"); realSet(key, value); };
    vi.stubGlobal("localStorage", storage);
    const memory: Record<string, string> = {};
    expect(resolveCcoBriefSubmissionId(memory, "a@example.com", () => "must-not-be-used")).toBe("legacy-id");
    expect(storage.getItem(CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY)).toBe("legacy-id");
  });

  test("in-memory scope change within one page: editing the email never reuses another email's id", () => {
    vi.stubGlobal("localStorage", new MemoryStorage());
    const ids = ["id-a", "id-b"];
    const create = () => ids.shift()!;
    const memory: Record<string, string> = {};
    const first = resolveCcoBriefSubmissionId(memory, "a@example.com", create);
    const second = resolveCcoBriefSubmissionId(memory, "B@example.com ".trim().toLowerCase(), create);
    expect([first, second]).toEqual(["id-a", "id-b"]);
  });

  test("makes a failed or unknown email outcome visible instead of treating it as a clean receipt", () => {
    expect(getCcoBriefDeliveryIssue({
      admin: { status: "sent" },
      owner: { status: "sent", logId: "owner-log", providerReceiptPresent: true },
      client: { status: "failed", logId: "client-log" },
    })).toBe("failed");
    expect(getCcoBriefDeliveryIssue({
      admin: { status: "unknown" },
      owner: { status: "unknown", logId: "owner-log", providerReceiptPresent: false },
      client: { status: "sent", logId: "client-log" },
    })).toBe("unknown");
    expect(getCcoBriefDeliveryIssue({
      admin: { status: "unknown" },
      owner: { status: "unknown", logId: "owner-log", providerReceiptPresent: false },
      client: { status: "failed", logId: "client-log" },
    })).toBe("mixed");
    expect(getCcoBriefDeliveryIssue({
      admin: { status: "sent" },
      owner: { status: "sent", logId: "owner-log", providerReceiptPresent: true },
      client: { status: "sent", logId: "client-log" },
    })).toBeNull();
  });

  test.each(["failed", "unknown"])("an aggregate sent result cannot hide Bailey's %s outcome", (status) => {
    expect(getCcoBriefDeliveryIssue({
      admin: { status: "sent", logId: "owner-log" },
      owner: { status, logId: "owner-log", providerReceiptPresent: false },
      client: { status: "sent", logId: "client-log" },
    })).toBe(status);
  });

  test.each([undefined, null, {}, { status: "sent" }, { status: "sent", logId: "owner-log", providerReceiptPresent: false },
    { status: "sent", logId: "owner-log", providerReceiptPresent: "true" }, { status: "sent", logId: "  ", providerReceiptPresent: true }])(
    "a missing or malformed owner receipt %j requires manual follow-up", (owner) => {
      expect(getCcoBriefDeliveryIssue({ owner, admin: { status: "sent" }, client: { status: "sent", logId: "client-log" } })).toBe("unknown");
    },
  );

  test("Bailey acceptance is independent of an additive operator's failure", () => {
    expect(getCcoBriefDeliveryIssue({
      admin: { status: "failed" },
      owner: { status: "sent", logId: "owner-log", providerReceiptPresent: true },
      client: { status: "sent", logId: "client-log" },
    })).toBeNull();
  });

  test("retries only definite failed delivery legs while preserving unknown outcomes", () => {
    expect(canRetryCcoBriefDelivery("failed")).toBe(true);
    expect(canRetryCcoBriefDelivery("mixed")).toBe(true);
    expect(canRetryCcoBriefDelivery("unknown")).toBe(false);
    expect(canRetryCcoBriefDelivery(null)).toBe(false);
  });
});
