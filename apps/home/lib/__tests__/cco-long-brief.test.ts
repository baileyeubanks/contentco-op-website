import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import ts from "typescript";
import { describe, expect, test, vi } from "vitest";
import * as validation from "../validation";
import { finishCcoPublicBriefSubmission } from "../cco-public-brief-submission";

// Exercise the actual component handlers, including their request bodies.
const path = new URL("../../app/brief/brief-client.tsx", import.meta.url);
const source = ts.createSourceFile(fileURLToPath(path), readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const handlers = new Map<string, string>();
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name && ["saveLeadSnapshot", "submitBrief"].includes(node.name.text)) {
    handlers.set(node.name.text, ts.transpileModule(node.getText(source), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText);
  }
  ts.forEachChild(node, visit);
}
visit(source);
function form(projectContext: string, briefPersists = true) {
  const draft = {
    name: "Jane Prospect", email: "jane@example.test", company: "Test Company", phone: "",
    projectTypes: ["brand"], projectContext, placements: ["Website"], deliverables: ["Main Film"],
    timeline: "2-4 weeks", bookingPreference: "20",
  };
  const requests: Array<{url:string;body:Record<string, any>}> = [];
  const state = {current:"idle", error:"", cleared:false};
  const fetch = vi.fn(async (url:string, init:RequestInit) => {
    const body = JSON.parse(String(init.body)); requests.push({url,body});
    if (url === "/api/cco/leads") {
      const valid = validation.LeadSchema.safeParse(body).success;
      return {ok:valid,json:async () => valid ? {persisted:true} : {error:"invalid_lead",persisted:false}};
    }
    if (url === "/api/cco/briefs") {
      expect(validation.BriefIntakeSchema.safeParse(body).success).toBe(true);
      return {ok:briefPersists,json:async () => briefPersists ? {persisted:true,id:"saved-brief",access_token:"",notification:{}} : {persisted:false,error:"storage_unavailable",retryable:true}};
    }
    throw new Error(`Unexpected endpoint: ${url}`);
  });
  const context = createContext({
    ...validation, draft, chosen:{timeline:true}, fetch, leadReady:true,projectReady:true,scopeReady:true,
    quoteDiagnostics:{missing:[]}, inferGoal:() => "brand", getSubmissionId:() => "3f1c2a9e-8b7d-4c6e-9f00-1a2b3c4d5e6f",
    responseErrorMessage:(payload:{error?:string}, fallback:string) => payload?.error || fallback,
    setSubmitState:(value:string) => {state.current=value;},setSubmitError:(value:string) => {state.error=value;},
    setRetrySubmissionAvailable:vi.fn(),setResult:vi.fn(),clearSubmittedDraft:() => {state.cleared=true;},
    finishCcoPublicBriefSubmission,window:{location:{href:""}},
  });
  for (const code of handlers.values()) runInContext(code,context);
  return {draft,requests,state,context,save:() => runInContext("saveLeadSnapshot()",context),submit:() => runInContext("submitBrief()",context)};
}

describe("C1 long brief reaches durable submission", () => {
  test.each([1001, 6600])("posts all %i characters without snapshot rejection", async length => {
    const projectContext = "A detailed film brief.\n".repeat(300).slice(0,length);
    const fx = form(projectContext); await fx.submit();
    expect(fx.requests.find(request=>request.url === "/api/cco/briefs")?.body.project.projectContext).toBe(projectContext);
    expect(fx.state.current).toBe("success");
  });
  test.each(["x".repeat(1001), "x".repeat(999)+"🎬"+" keep this in the full brief"])("caps only the actual snapshot payload and leaves the draft intact", async projectContext => {
    const fx = form(projectContext); await fx.save();
    const summary = fx.requests[0].body.basics.summary as string;
    expect(summary.length).toBeLessThanOrEqual(1000);
    expect(summary).toBe(projectContext.slice(0,1000).replace(/[\uD800-\uDBFF]$/, ""));
    expect(fx.draft.projectContext).toBe(projectContext);
    await fx.submit();
    expect(fx.requests.find(request=>request.url === "/api/cco/briefs")?.body.project.projectContext).toBe(projectContext);
  });
  test("final submission never invokes a failing or stalled optional snapshot", async () => {
    const fx = form("A valid detailed project brief.");
    const snapshot = vi.fn(() => {throw new Error("snapshot_unavailable");});
    fx.context.saveLeadSnapshot = snapshot;
    await fx.submit();
    expect(snapshot).not.toHaveBeenCalled();
    expect(fx.requests.map(request=>request.url)).toEqual(["/api/cco/briefs"]);
    expect(fx.state.current).toBe("success");
  });
  test("a failed durable brief write still fails honestly and preserves retry state", async () => {
    const fx = form("x".repeat(1001),false); await fx.submit();
    expect(fx.requests.map(request=>request.url)).toContain("/api/cco/briefs");
    expect(fx.state).toEqual({current:"error",error:"storage_unavailable",cleared:false});
  });
});
