import { afterEach, describe, expect, test, vi } from "vitest";
import {
  CCO_BRIEF_DRAFT_STORAGE_KEY,
  CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY,
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
      client: { status: "failed" },
    })).toBe("failed");
    expect(getCcoBriefDeliveryIssue({
      admin: { status: "unknown" },
      client: { status: "sent" },
    })).toBe("unknown");
    expect(getCcoBriefDeliveryIssue({
      admin: { status: "sent" },
      client: { status: "sent" },
    })).toBeNull();
  });
});
