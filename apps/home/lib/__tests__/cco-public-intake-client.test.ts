import { afterEach, describe, expect, test, vi } from "vitest";
import {
  CCO_BRIEF_DRAFT_STORAGE_KEY,
  CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY,
  canRetryCcoBriefDelivery,
  clearCcoBriefSubmissionStorage,
  getCcoBriefDeliveryIssue,
  getCcoBriefSubmissionId,
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
