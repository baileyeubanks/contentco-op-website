import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import ts from "typescript";
import { describe, expect, test, vi } from "vitest";
import { canRetryCcoBriefDelivery, getCcoBriefDeliveryIssue } from "../cco-public-intake-client";
import { normalizeBriefWebsite } from "@/lib/validation";

// Execute the actual form handler, rather than duplicating its post-save logic.
// Restoring its old global catch must fail the preview-rejection regression.
const componentPath = new URL("../../app/brief/brief-client.tsx", import.meta.url);
const source = ts.createSourceFile(fileURLToPath(componentPath), readFileSync(componentPath, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler: ts.FunctionDeclaration | undefined;
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "submitBrief") handler = node;
  ts.forEachChild(node, visit);
}
visit(source);
if (!handler) throw new Error("The actual public brief submit handler was not found");
const handlerCode = ts.transpileModule(handler.getText(source), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

const acceptedNotification = {
  admin: { status: "sent", logId: "owner-log" },
  owner: { status: "sent", logId: "owner-log", providerReceiptPresent: true },
  client: { status: "sent", logId: "client-log" },
};

async function exercise(input: {
  proposalFailure?: Error;
  accessToken?: string;
  notification?: unknown;
  proposalReady?: boolean;
  receiptId?: unknown;
}) {
  const state: { current: string; error: string; result: { briefId?: string; proposalHref?: string; deliveryIssue?: unknown } | null; retryKey: string | null } = {
    current: "idle", error: "", result: null, retryKey: "stable-submission-id",
  };
  const requests: Array<{ url: string; signal: AbortSignal | null | undefined }> = [];
  const fetchRequest = vi.fn(async (url: string, init?: RequestInit) => {
    requests.push({ url, signal: init?.signal });
    if (url === "/api/cco/briefs") return {
      ok: true,
      json: async () => ({ persisted: true, id: input.receiptId ?? "saved-canonical-brief", access_token: input.accessToken ?? "saved-access-token", notification: input.notification ?? acceptedNotification }),
    };
    if (url !== "/api/cco/briefs/proposal") throw new Error("Unexpected request");
    if (input.proposalFailure) throw input.proposalFailure;
    return { ok: input.proposalReady === true, json: async () => ({ persisted: input.proposalReady === true, proposal_ready: input.proposalReady === true }) };
  });
  const location = { href: "" };
  const context = createContext({
    leadReady: true, projectReady: true, scopeReady: true,
    draft: { projectTypes: ["Brand film"], bookingPreference: "20" }, quoteDiagnostics: { missing: [] },
    setSubmitState: (value: string) => { state.current = value; },
    setSubmitError: (value: string) => { state.error = value; },
    setRetrySubmissionAvailable: vi.fn(),
    setResult: (value: typeof state.result) => { state.result = value; },
    saveLeadSnapshot: async () => undefined,
    inferGoal: () => "Synthetic goal", getSubmissionId: () => state.retryKey,
    clearSubmittedDraft: () => { state.retryKey = null; },
    getCcoBriefDeliveryIssue, canRetryCcoBriefDelivery, normalizeBriefWebsite,
    responseErrorMessage: () => "Synthetic pre-save failure",
    fetch: fetchRequest, window: { location }, encodeURIComponent,
  });
  // The red baseline has no extracted helper; the actual handler does not use it.
  // Once introduced, inject the same implementation that the component imports.
  const helperPath = new URL("../cco-public-brief-submission.ts", import.meta.url);
  if (existsSync(helperPath)) {
    const implementation = await import(fileURLToPath(helperPath));
    context.finishCcoPublicBriefSubmission = implementation.finishCcoPublicBriefSubmission;
  }
  await runInContext(`${handlerCode}\nsubmitBrief`, context)();
  return { state, fetchRequest, location, requests };
}

describe("actual public brief handler after a durable receipt", () => {
  test("the optional preview request has a bounded abort signal", async () => {
    const { requests } = await exercise({});
    const signal = requests.find(({ url }) => url === "/api/cco/briefs/proposal")?.signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal?.aborted).toBe(false);
  });

  test.each([new Error("synthetic private transport failure"), Object.assign(new Error("synthetic timeout"), { name: "AbortError" })])(
    "an optional proposal rejection keeps received success and the acknowledged brief ID: %s", async (proposalFailure) => {
      const { state, location } = await exercise({ proposalFailure });
      expect(state.current).toBe("success");
      expect(state.result).toMatchObject({ briefId: "saved-canonical-brief", deliveryIssue: null });
      expect(state.result?.proposalHref).toBeUndefined();
      expect(state.error).toBe("");
      expect(state.retryKey).toBeNull();
      expect(location.href).toBe("");
    },
  );

  test("a missing optional access capability keeps the received brief and skips preview fetch", async () => {
    const { state, fetchRequest } = await exercise({ accessToken: "" });
    expect(state.current).toBe("success");
    expect(state.result).toMatchObject({ briefId: "saved-canonical-brief", deliveryIssue: null });
    expect(state.result?.proposalHref).toBeUndefined();
    expect(fetchRequest.mock.calls.map(([url]) => url)).toEqual(["/api/cco/briefs"]);
  });

  test("a failed owner email preserves the retry UUID even if the optional preview rejects", async () => {
    const { state } = await exercise({ proposalFailure: new Error("synthetic failure"), notification: {
      ...acceptedNotification, owner: { status: "failed", logId: "owner-log", providerReceiptPresent: false },
    } });
    expect(state.current).toBe("success");
    expect(state.result).toMatchObject({ briefId: "saved-canonical-brief", deliveryIssue: "failed" });
    expect(state.retryKey).toBe("stable-submission-id");
  });

  test("an unknown owner email requires manual follow-up without retaining a resend path", async () => {
    const { state } = await exercise({ proposalFailure: new Error("synthetic failure"), notification: {
      ...acceptedNotification, owner: { status: "unknown", logId: "owner-log", providerReceiptPresent: false },
    } });
    expect(state.current).toBe("success");
    expect(state.result).toMatchObject({ briefId: "saved-canonical-brief", deliveryIssue: "unknown" });
    expect(state.retryKey).toBeNull();
  });

  test("a ready preview still redirects only after the durable brief receipt", async () => {
    const { state, location } = await exercise({ proposalReady: true });
    expect(location.href).toBe("/brief/proposal/saved-canonical-brief?token=saved-access-token");
    expect(state.retryKey).toBeNull();
    expect(state.error).toBe("");
  });

  test("a malformed saved brief ID cannot become a fabricated proposal URL", async () => {
    const { state, location, fetchRequest } = await exercise({ receiptId: {} });
    expect(state.current).toBe("error");
    expect(state.result).toBeNull();
    expect(location.href).toBe("");
    expect(fetchRequest.mock.calls.map(([url]) => url)).toEqual(["/api/cco/briefs"]);
  });
});
