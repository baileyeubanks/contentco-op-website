import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  buildCcoOwnerLeadNotice,
  createCcoOwnerLeadNotifier,
  createInMemoryCcoOwnerLeadNoticeTransport,
  type CcoLeadSummary,
  type CcoOwnerLeadNoticeResult,
} from "../cco-owner-lead-notice";

const lead: CcoLeadSummary = {
  id: "test-lead-1",
  name: "Synthetic Test Lead",
  sourceHost: "contentco-op.com",
  receivedAt: "2026-10-08T22:16:00Z",
};

afterEach(() => vi.unstubAllGlobals());

describe("CCO owner lead notice (local only)", () => {
  test("builds a notice from the summary without requiring or copying a message body", () => {
    const notice = buildCcoOwnerLeadNotice({ ...lead, message: "Private text" } as CcoLeadSummary);
    expect(notice).toEqual({
      leadId: lead.id,
      name: lead.name,
      sourceHost: lead.sourceHost,
      receivedAt: lead.receivedAt,
      subject: "New Content Co-op lead",
      text: `A Content Co-op lead exists.\nName: ${lead.name}\nSource host: ${lead.sourceHost}\nReceived: ${lead.receivedAt}\nLead ID: ${lead.id}`,
    });
    expect(JSON.stringify(notice)).not.toContain("Private text");
  });

  test("default dry-run does not report delivered or invoke network globals", async () => {
    const network = vi.fn(() => { throw new Error("network_forbidden"); });
    for (const name of ["fetch", "WebSocket", "XMLHttpRequest", "EventSource"]) {
      vi.stubGlobal(name, network);
    }
    const notify = createCcoOwnerLeadNotifier();
    expect(await notify(lead)).toEqual({ delivered: false, reason: "send_not_authorized" });
    expect(await notify(lead)).toEqual({ delivered: false, reason: "send_not_authorized" });
    expect(network).not.toHaveBeenCalled();
  });

  test("an injected fake transport records one notice in memory", async () => {
    const fake = createInMemoryCcoOwnerLeadNoticeTransport();
    const notify = createCcoOwnerLeadNotifier(fake.transport);
    expect(await notify(lead)).toEqual({ delivered: true });
    expect(fake.notices).toEqual([buildCcoOwnerLeadNotice(lead)]);
  });

  test("a second call with the same lead id does not double-record", async () => {
    const fake = createInMemoryCcoOwnerLeadNoticeTransport();
    const notify = createCcoOwnerLeadNotifier(fake.transport);
    await notify(lead);
    expect(await notify({ ...lead, name: "Updated name" })).toEqual({
      delivered: false, reason: "already_delivered",
    });
    expect(fake.notices).toHaveLength(1);
    await notify({ ...lead, id: "test-lead-2" });
    expect(fake.notices.map((notice) => notice.leadId)).toEqual([lead.id, "test-lead-2"]);
  });

  test("concurrent calls for the same lead invoke the transport once", async () => {
    const fake = createInMemoryCcoOwnerLeadNoticeTransport();
    let complete!: (result: CcoOwnerLeadNoticeResult) => void;
    const transport = vi.fn(async (notice: Parameters<typeof fake.transport>[0]) => {
      await fake.transport(notice);
      return new Promise<CcoOwnerLeadNoticeResult>((resolve) => { complete = resolve; });
    });
    const notify = createCcoOwnerLeadNotifier(transport);
    const first = notify(lead);
    const second = notify(lead);
    await Promise.resolve();
    await Promise.resolve();
    expect(transport).toHaveBeenCalledTimes(1);
    complete({ delivered: true });
    expect(await Promise.all([first, second])).toEqual([{ delivered: true }, { delivered: true }]);
    expect(fake.notices).toHaveLength(1);
  });

  test("an undelivered attempt can retry without claiming earlier delivery", async () => {
    const fake = createInMemoryCcoOwnerLeadNoticeTransport();
    const transport = vi.fn()
      .mockReturnValueOnce({ delivered: false, reason: "unavailable" })
      .mockImplementation(fake.transport);
    const notify = createCcoOwnerLeadNotifier(transport);
    expect(await notify(lead)).toEqual({ delivered: false, reason: "unavailable" });
    expect(fake.notices).toHaveLength(0);
    expect(await notify(lead)).toEqual({ delivered: true });
    await notify(lead);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(fake.notices).toHaveLength(1);
  });

  test("a thrown transport error clears the pending attempt so it can retry", async () => {
    const fake = createInMemoryCcoOwnerLeadNoticeTransport();
    const transport = vi.fn()
      .mockImplementationOnce(() => { throw new Error("test_failure"); })
      .mockImplementation(fake.transport);
    const notify = createCcoOwnerLeadNotifier(transport);
    await expect(notify(lead)).rejects.toThrow("test_failure");
    expect(await notify(lead)).toEqual({ delivered: true });
    expect(fake.notices).toHaveLength(1);
  });

  test("rejects a blank lead id before invoking the transport", () => {
    const transport = vi.fn();
    expect(() => createCcoOwnerLeadNotifier(transport)({ ...lead, id: " " })).toThrow("lead_id_required");
    expect(transport).not.toHaveBeenCalled();
  });

  test("module imports no dependencies, including network modules", () => {
    const source = readFileSync(new URL("../cco-owner-lead-notice.ts", import.meta.url), "utf8");
    const ast = ts.createSourceFile("cco-owner-lead-notice.ts", source, ts.ScriptTarget.Latest, true);
    const forbidden: string[] = [];
    function visit(node: ts.Node) {
      if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node)
        || (ts.isExportDeclaration(node) && node.moduleSpecifier)
        || (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
          || (ts.isIdentifier(node.expression) && ["require", "fetch"].includes(node.expression.text))))
        || (ts.isNewExpression(node) && ts.isIdentifier(node.expression)
          && ["WebSocket", "XMLHttpRequest", "EventSource"].includes(node.expression.text))) {
        forbidden.push(node.getText(ast));
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
    expect(forbidden).toEqual([]);
  });
});
