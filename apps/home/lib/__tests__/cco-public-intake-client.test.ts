import { afterEach, describe, expect, test, vi } from "vitest";
import {
  CCO_BRIEF_DRAFT_STORAGE_KEY,
  CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY,
  canRetryCcoBriefDelivery,
  clearCcoBriefSubmissionStorage,
  getCcoBriefDeliveryIssue,
  discardCcoBriefSubmissionId,
  getCcoBriefSubmissionId,
  isCcoBriefSubmissionConflict,
  postCcoBriefWithConflictRecovery,
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

describe("saved retry id and the server's submission conflict", () => {
  const ok = { response: { ok: true, status: 200 }, payload: { persisted: true } };
  const conflict = { response: { ok: false, status: 409 }, payload: { error: "brief_submission_conflict", code: "x", retryable: false } };

  function harness(results: Array<{ response: { ok: boolean; status: number }; payload: unknown }>) {
    const storage = new MemoryStorage();
    vi.stubGlobal("localStorage", storage);
    let n = 0;
    const post = vi.fn(async (_id: string) => results[Math.min(n++, results.length - 1)]);
    const ids = ["fresh-1", "fresh-2", "fresh-3"];
    let memory: string | null = null;
    const getId = () => (memory = getCcoBriefSubmissionId(memory, () => ids.shift()!));
    const discardId = () => { memory = null; discardCcoBriefSubmissionId(); };
    return { storage, post, getId, discardId, run: () => postCcoBriefWithConflictRecovery({ getId, discardId, post }) };
  }

  test("identifies only the 409 conflict code, never message text, 5xx or validation errors", () => {
    expect(isCcoBriefSubmissionConflict(409, { error: "brief_submission_conflict" })).toBe(true);
    expect(isCcoBriefSubmissionConflict(409, { error: "other", message: "This saved retry cannot be matched" })).toBe(false);
    expect(isCcoBriefSubmissionConflict(503, { error: "brief_submission_conflict" })).toBe(false);
    expect(isCcoBriefSubmissionConflict(400, { error: "validation_failed" })).toBe(false);
    expect(isCcoBriefSubmissionConflict(409, null)).toBe(false);
  });

  test("an unchanged returning visitor's unresolved id is sent as saved and never replaced client-side", async () => {
    const h = harness([ok]);
    h.storage.setItem(CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY, "production-saved-id");
    await h.run();
    expect(h.post.mock.calls.map((call) => call[0])).toEqual(["production-saved-id"]);
    expect(h.storage.getItem(CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY)).toBe("production-saved-id");
  });

  test("on the conflict code it discards the id, resubmits once under a fresh id, and keeps the draft", async () => {
    const h = harness([conflict, ok]);
    h.storage.setItem(CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY, "stale-id");
    h.storage.setItem(CCO_BRIEF_DRAFT_STORAGE_KEY, "draft");
    const result = await h.run();
    expect(h.post.mock.calls.map((call) => call[0])).toEqual(["stale-id", "fresh-1"]);
    expect(result.payload).toEqual({ persisted: true });
    expect(h.storage.getItem(CCO_BRIEF_DRAFT_STORAGE_KEY)).toBe("draft");
  });

  test("a second conflict is surfaced and there is no third attempt", async () => {
    const h = harness([conflict, conflict, ok]);
    const result = await h.run();
    expect(h.post).toHaveBeenCalledTimes(2);
    expect(result.response.status).toBe(409);
  });

  test.each([
    ["5xx", { response: { ok: false, status: 503 }, payload: { error: "cco_persistence_unavailable", retryable: true } }],
    ["validation", { response: { ok: false, status: 400 }, payload: { error: "validation_failed" } }],
    ["timeout-shaped null body", { response: { ok: false, status: 504 }, payload: null }],
  ])("does not resubmit on %s", async (_name, failure) => {
    const h = harness([failure, ok]);
    h.storage.setItem(CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY, "kept-id");
    const result = await h.run();
    expect(h.post).toHaveBeenCalledTimes(1);
    expect(result.response.ok).toBe(false);
    expect(h.storage.getItem(CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY)).toBe("kept-id");
  });

  test("a thrown network error is not retried automatically", async () => {
    const h = harness([ok]);
    h.post.mockRejectedValueOnce(new Error("network"));
    await expect(h.run()).rejects.toThrow("network");
    expect(h.post).toHaveBeenCalledTimes(1);
  });

  test("a successful submission clears the saved id as production does", async () => {
    const h = harness([ok]);
    await h.run();
    expect(h.storage.getItem(CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY)).not.toBeNull();
    clearCcoBriefSubmissionStorage();
    expect(h.storage.getItem(CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY)).toBeNull();
  });

  test("no state carries one email's id to another: a new email only changes the id when the server says so", async () => {
    const h = harness([conflict, ok]);
    h.storage.setItem(CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY, "email-a-id");
    await h.run(); // email B submitted with A's saved id: only the server's conflict triggers a new id
    expect(h.post.mock.calls.map((call) => call[0])).toEqual(["email-a-id", "fresh-1"]);
  });
});
