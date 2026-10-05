import { afterEach, describe, expect, test, vi } from "vitest";
import { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { recordedBriefWorkspace } from "../cco-provisional-brief-contract";
import { BriefOpsPanel, RecordedBriefWorkspaceLink } from "@/app/os/marketing/briefs/[id]/brief-ops-panel";

// Run the real event handler and render its next state without browser/DB access.
const panelState = vi.hoisted(() => ({ capture: false, cursor: 0, values: [] as unknown[] }));
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: (initial: unknown) => {
    if (!panelState.capture) return actual.useState(initial);
    const slot = panelState.cursor++;
    if (!(slot in panelState.values)) panelState.values[slot] = initial;
    return [panelState.values[slot], (next: unknown) => { panelState.values[slot] = next; }];
  } };
});
afterEach(() => { panelState.capture = false; panelState.cursor = 0; panelState.values = []; vi.unstubAllGlobals(); });

function action(root: ReactNode): (() => Promise<void>) | null {
  if (!isValidElement<{ children?: ReactNode; onClick?: () => Promise<void> }>(root)) return null;
  if (root.type === "button" && root.props.children === "open approved production project") return root.props.onClick ?? null;
  for (const child of Children.toArray(root.props.children)) {
    const found = action(child);
    if (found) return found;
  }
  return null;
}

async function convertAndRender(response: unknown) {
  panelState.capture = true;
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => response });
  vi.stubGlobal("fetch", fetch);
  const click = action(BriefOpsPanel({ briefId }));
  expect(click).not.toBeNull();
  await click!();
  panelState.cursor = 0;
  return { html: renderToStaticMarkup(BriefOpsPanel({ briefId })), fetch };
}

const briefId = "d2d31c2d-78a6-4923-809d-c713379ad405";
const projectId = "7e4824c9-5624-4a0c-bb4c-cf87c477d67e";
const inquiryId = "4d89558c-5d4c-4519-b3de-3dc8b5dbd97e";
const estimateId = "3fa45927-1200-4477-aeaf-9cc63559dc7e";
const versionId = "761b9773-70ea-4cbb-9526-7872f115eb30";

function completed() {
  return {
    briefId, error: null, partial: false, retryable: false, stage: "complete", replayed: false,
    project: { id: projectId, schema: "co_production", title: "CCO estimate" },
    receipt: {
      status: "created", replayed: false, cvpProjectId: projectId, cvpInquiryId: inquiryId,
      estimateId, estimateVersionId: versionId,
      idempotencyKey: "cco:cc-est-2026-0007:v1:A", payloadHash: `sha256:${"a".repeat(64)}`,
      commercialRef: {
        brief_id: briefId, estimate_id: estimateId, estimate_version_id: versionId, source: "cco_os",
        idempotency_key: "cco:cc-est-2026-0007:v1:A", payload_hash: `sha256:${"a".repeat(64)}`,
      },
    },
  };
}

describe("staff navigation from an existing complete commercial handoff", () => {
  // Removing canonical receipt validation must fail these scope/conflict cases.
  test("offers a recorded CVP destination without upgrading independent approval states", () => {
    const result = completed();
    Object.assign(result.project, { href: "https://untrusted.example/", signature: "signed", deposit: "paid" });
    expect(recordedBriefWorkspace(briefId, result)).toEqual({
      id: projectId, href: `https://co-videopro.com/projects/${projectId}`,
      projectAccess: "unverified", agreement: "unverified", deposit: "unverified", creativeApproval: "unverified",
    });
  });

  test("replayed completion opens the same workspace", () => {
    const result = completed();
    result.replayed = result.receipt.replayed = true;
    expect(recordedBriefWorkspace(briefId, result)).toEqual(recordedBriefWorkspace(briefId, completed()));
  });

  test.each([
    { partial: true }, { retryable: true }, { error: "receipt_write_failed" },
    { stage: "receipt" }, { receipt: null }, { briefId: estimateId },
    { project: { id: projectId, schema: "public" } },
    { project: { id: "javascript:alert(1)", schema: "co_production" } },
    { project: { id: estimateId, schema: "co_production" } },
  ])("rejects failed, partial, legacy or mismatched response %j", patch => {
    expect(recordedBriefWorkspace(briefId, { ...completed(), ...patch })).toBeNull();
  });

  test.each(["brief_id", "estimate_id", "estimate_version_id"])("rejects conflicting commercial %s", field => {
    const result = completed();
    Object.assign(result.receipt.commercialRef, { [field]: inquiryId });
    expect(recordedBriefWorkspace(briefId, result)).toBeNull();
  });

  test.each(["cvpProjectId", "cvpInquiryId", "estimateId", "estimateVersionId"])("rejects invalid receipt %s", field => {
    const result = completed();
    Object.assign(result.receipt, { [field]: "not-a-uuid" });
    expect(recordedBriefWorkspace(briefId, result)).toBeNull();
  });

  test.each([
    { commercial: { source: "other_product" } },
    { commercial: { source: undefined } },
    { commercial: { idempotency_key: "cco:other-estimate:v99:A" } },
    { commercial: { idempotency_key: undefined } },
    { commercial: { payload_hash: `sha256:${"b".repeat(64)}` } },
    { commercial: { payload_hash: undefined } },
    { receipt: { idempotencyKey: undefined } },
    { receipt: { payloadHash: undefined } },
    { receipt: { idempotencyKey: "not a key" }, commercial: { idempotency_key: "not a key" } },
    { receipt: { payloadHash: "opaque" }, commercial: { payload_hash: "opaque" } },
    { receipt: { payloadHash: `sha256:${"G".repeat(64)}` }, commercial: { payload_hash: `sha256:${"G".repeat(64)}` } },
  ])("rejects absent, malformed or contradictory commercial provenance %j", patch => {
    const result = completed();
    expect(recordedBriefWorkspace(briefId, {
      ...result,
      receipt: { ...result.receipt, ...patch.receipt, commercialRef: { ...result.receipt.commercialRef, ...patch.commercial } },
    })).toBeNull();
  });

  test.each([null, [], {}, true, "saved", { project: completed().project }])("does not infer a link from incomplete data %j", response => {
    expect(recordedBriefWorkspace(briefId, response)).toBeNull();
  });

  test("a requested brief must itself be a canonical UUID", () => {
    expect(recordedBriefWorkspace("brief-1", completed())).toBeNull();
  });

  test("the staff receipt renders a useful link with separate readiness evidence", () => {
    const workspace = recordedBriefWorkspace(briefId, completed());
    expect(workspace).not.toBeNull();
    const html = renderToStaticMarkup(createElement(RecordedBriefWorkspaceLink, { workspace: workspace! }));
    expect(html).toContain(`href="https://co-videopro.com/projects/${projectId}"`);
    expect(html).toContain("Open recorded Co-VideoPro workspace");
    expect(html).toContain("Agreement/signature: unverified");
    expect(html).toContain("Deposit: unverified");
    expect(html).toContain("Creative approval: unverified");
    expect(html).toContain("Current workspace access is unverified");
    expect(html).not.toContain("is ready");
  });

  test("the initial staff panel keeps the commercial action and offers no invented project link", () => {
    const html = renderToStaticMarkup(createElement(BriefOpsPanel, { briefId, briefStatus: "submitted" }));
    expect(html).toContain("open approved production project");
    expect(html).not.toContain("Open recorded Co-VideoPro workspace");
    expect(html).not.toContain(`https://co-videopro.com/projects/${projectId}`);
  });

  test("the real staff action connects a valid response to the recorded link", async () => {
    const { html, fetch } = await convertAndRender(completed());
    expect(fetch).toHaveBeenCalledWith(`/api/os/briefs/${briefId}/convert`, {
      method: "POST", headers: { "Content-Type": "application/json" },
    });
    expect(html).toContain(`href="https://co-videopro.com/projects/${projectId}"`);
    expect(html).toContain("workspace recorded");
    expect(html).toContain("Agreement/signature: unverified");
  });

  test.each([
    { partial: true }, { receipt: null }, { briefId: estimateId },
    { receipt: { ...completed().receipt, commercialRef: { ...completed().receipt.commercialRef, source: "other_product" } } },
  ])("the real staff action keeps an unverifiable response retryable without a link %j", async patch => {
    const { html } = await convertAndRender({ ...completed(), ...patch });
    expect(html).not.toContain("Open recorded Co-VideoPro workspace");
    expect(html).toContain("The workspace receipt could not be verified");
    expect(html.match(/<button[^>]*>open approved production project<\/button>/)?.[0]).not.toContain("disabled");
  });
});
