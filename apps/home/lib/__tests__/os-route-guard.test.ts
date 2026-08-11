import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Deny-by-default coverage for /api/os/*.
 *
 * 1. Static: every route file must reference the platform guard
 *    (enforceRoutePolicy / authorizeRootWorkspaceRoute) or appear in the
 *    explicit exemption map below — and exempt files must still contain the
 *    mechanism that justifies the exemption.
 * 2. Runtime: a representative sample of previously-open routes must answer
 *    401 to an unauthenticated caller.
 */

const APP_ROOT = path.resolve(__dirname, "../..");
const OS_API_ROOT = path.join(APP_ROOT, "app/api/os");

/**
 * Routes that do NOT reference the platform guard, with justification.
 * Each entry must list markers that prove the file's own mechanism exists —
 * if the marker disappears, this test fails.
 */
const GUARD_EXEMPTIONS: Record<string, { justification: string; markers: string[] }> = {
  "app/api/os/login/route.ts": {
    justification:
      "Public by design: this IS the login endpoint — it verifies credentials and issues the operator session cookie that every other /api/os route requires.",
    markers: ["createInviteSession", "verifyRootOperatorCredentials"],
  },
  "app/api/os/system/actions/route.ts": {
    justification:
      "Already enforces auth inline: rejects with 403 unless a verified invite session belongs to an advanced root operator (verifyInviteSession + isAdvancedRootOperatorForHost).",
    markers: ["verifyInviteSession", "isAdvancedRootOperatorForHost"],
  },
  "app/api/os/system/phone-actions/route.ts": {
    justification:
      "Already enforces auth inline: rejects with 403 unless a verified invite session belongs to an advanced root operator (verifyInviteSession + isAdvancedRootOperatorForHost).",
    markers: ["verifyInviteSession", "isAdvancedRootOperatorForHost"],
  },
  "app/api/os/workspace/import/route.ts": {
    justification:
      "Re-exports GET/POST from ../imports/route, which enforces authorizeRootWorkspaceRoute (root.workspace.imports, system_config). No independent code path exists in this file.",
    markers: ['from "../imports/route"'],
  },
};

/**
 * Files whose handlers are guarded indirectly through a file-local helper that
 * wraps enforceRoutePolicy (e.g. `requireAccess()`). The test asserts both the
 * helper call in every method body AND the guard literal in the file.
 */
const GUARD_VIA_LOCAL_HELPER: Record<string, { helper: string; justification: string }> = {
  "app/api/os/lab/fsm/route.ts": {
    helper: "requireAccess",
    justification:
      "GET and POST both call the file-local requireAccess() helper, which wraps enforceRoutePolicy(root.lab.fsm.control, system_config).",
  },
};

function walkRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkRouteFiles(full));
    else if (entry.name === "route.ts") out.push(full);
  }
  return out;
}

/**
 * Extract the body text of every `export async function <METHOD>` in a route
 * file, keyed by method. Paren/brace balanced; per-method granularity so a
 * guarded GET cannot mask an unguarded POST in the same file.
 */
function exportedMethodBodies(src: string): Record<string, string> {
  const bodies: Record<string, string> = {};
  const re = /export async function (GET|POST|PATCH|PUT|DELETE)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let i = src.indexOf("(", m.index);
    let depth = 0;
    while (i < src.length) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")") {
        depth--;
        if (depth === 0) break;
      }
      i++;
    }
    const bodyStart = src.indexOf("{", i);
    depth = 0;
    let j = bodyStart;
    while (j < src.length) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}") {
        depth--;
        if (depth === 0) break;
      }
      j++;
    }
    bodies[m[1]] = src.slice(bodyStart, j + 1);
  }
  return bodies;
}

describe("static: every /api/os route references the guard or is exempt", () => {
  const routeFiles = walkRouteFiles(OS_API_ROOT).map((full) => path.relative(APP_ROOT, full));

  test("route inventory is non-trivial (sanity: 90+ routes)", () => {
    expect(routeFiles.length).toBeGreaterThanOrEqual(90);
  });

  test("per-method: every exported handler in non-exempt routes references the guard", () => {
    const failures: string[] = [];
    for (const rel of routeFiles) {
      if (rel in GUARD_EXEMPTIONS) continue;
      const src = readFileSync(path.join(APP_ROOT, rel), "utf8");
      const bodies = exportedMethodBodies(src);
      if (Object.keys(bodies).length === 0) {
        failures.push(`${rel} (no exported HTTP handlers found)`);
        continue;
      }
      const viaHelper = GUARD_VIA_LOCAL_HELPER[rel];
      if (viaHelper) {
        /* The indirection is only valid if the guard really exists in-file. */
        expect(src, `${rel} claims guard-via-helper but lacks the guard literal`).toMatch(
          /enforceRoutePolicy|authorizeRootWorkspaceRoute/,
        );
        expect(src, `${rel} no longer defines helper ${viaHelper.helper}`).toContain(viaHelper.helper);
      }
      for (const [method, body] of Object.entries(bodies)) {
        const direct = /enforceRoutePolicy|authorizeRootWorkspaceRoute/.test(body);
        const indirect = viaHelper ? body.includes(`${viaHelper.helper}(`) : false;
        if (!direct && !indirect) {
          failures.push(`${rel} ${method}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  test("every exemption still contains its justifying mechanism", () => {
    for (const [rel, { markers }] of Object.entries(GUARD_EXEMPTIONS)) {
      const src = readFileSync(path.join(APP_ROOT, rel), "utf8");
      expect(src, `${rel} must not reference the platform guard (remove the exemption if it does)`)
        .not.toMatch(/enforceRoutePolicy|authorizeRootWorkspaceRoute/);
      for (const marker of markers) {
        expect(src, `${rel} is exempt but no longer contains "${marker}"`).toContain(marker);
      }
    }
  });

  test("exemption map covers only files that exist", () => {
    for (const rel of Object.keys(GUARD_EXEMPTIONS)) {
      expect(routeFiles, `exemption for missing file ${rel}`).toContain(rel);
    }
  });
});

/* ── Runtime: unauthenticated calls must 401 ── */

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => ({ get: () => null }),
}));

vi.mock("@/lib/supabase-server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
  }),
}));

/* Chainable, thenable supabase stub — every query resolves to `result`. */
function supabaseStub(result: unknown) {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (value: unknown) => unknown) => resolve(result);
      }
      return vi.fn(() => new Proxy({}, handler));
    },
  };
  return { from: vi.fn(() => new Proxy({}, handler)) };
}

let supabaseResult: unknown = { data: null, error: null };

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => supabaseStub(supabaseResult),
  supabase: new Proxy({}, {
    get: () => vi.fn(() => supabaseStub(supabaseResult)),
  }),
}));

vi.mock("@/lib/os-document-renderer", () => ({
  renderQuoteHtml: async () => "<html><body>quote</body></html>",
}));

import { GET as financeOverviewGET } from "@/app/api/os/finance/overview/route";
import { GET as contactsGET } from "@/app/api/os/contacts/route";
import { GET as invoicesGET } from "@/app/api/os/invoices/route";
import { GET as quoteDetailGET } from "@/app/api/os/quotes/[id]/route";
import { GET as paymentsGET } from "@/app/api/os/payments/route";
import { GET as quotePreviewGET } from "@/app/api/os/quotes/[id]/preview/route";
import { POST as quoteViewsPOST } from "@/app/api/os/quotes/[id]/views/route";
import { POST as quoteCommentPOST } from "@/app/api/share/quote/[id]/comment/route";
import { signShareToken } from "../share-token";

const QUOTE_ID = "4d2f0b7e-9c1a-4e2b-b7a1-0f3c5d6e7a8b";

function getRequest(urlPath: string) {
  return new Request(`https://admin.contentco-op.com${urlPath}`);
}

describe("runtime: unauthenticated /api/os calls fail closed", () => {
  const savedSecret = process.env.QUOTE_SHARE_SECRET;

  beforeEach(() => {
    process.env.QUOTE_SHARE_SECRET = "test-share-secret";
    supabaseResult = { data: { id: QUOTE_ID, business_unit: "CC" }, error: null };
  });

  test("finance/overview -> 401", async () => {
    const res = await financeOverviewGET(getRequest("/api/os/finance/overview"));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("unauthorized");
  });

  test("contacts -> 401", async () => {
    const res = await contactsGET(getRequest("/api/os/contacts"));
    expect(res.status).toBe(401);
  });

  test("invoices -> 401", async () => {
    const res = await invoicesGET(getRequest("/api/os/invoices"));
    expect(res.status).toBe(401);
  });

  test("quotes/[id] -> 401", async () => {
    const res = await quoteDetailGET(getRequest(`/api/os/quotes/${QUOTE_ID}`), {
      params: Promise.resolve({ id: QUOTE_ID }),
    });
    expect(res.status).toBe(401);
  });

  test("payments -> 401", async () => {
    const res = await paymentsGET(getRequest("/api/os/payments"));
    expect(res.status).toBe(401);
  });

  test("quotes/[id]/preview without token -> 401", async () => {
    const res = await quotePreviewGET(getRequest(`/api/os/quotes/${QUOTE_ID}/preview`), {
      params: Promise.resolve({ id: QUOTE_ID }),
    });
    expect(res.status).toBe(401);
  });

  test("quotes/[id]/preview with a valid share token -> renders (public share path)", async () => {
    const token = signShareToken(QUOTE_ID)!;
    const res = await quotePreviewGET(
      getRequest(`/api/os/quotes/${QUOTE_ID}/preview?token=${encodeURIComponent(token)}`),
      { params: Promise.resolve({ id: QUOTE_ID }) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  test("quotes/[id]/preview with a tampered token -> 401", async () => {
    const res = await quotePreviewGET(
      getRequest(`/api/os/quotes/${QUOTE_ID}/preview?token=${QUOTE_ID}.9999999999.deadbeef`),
      { params: Promise.resolve({ id: QUOTE_ID }) },
    );
    expect(res.status).toBe(401);
  });

  test("quotes/[id]/views POST -> 401 (anonymous insert into quote_views blocked)", async () => {
    const res = await quoteViewsPOST(
      new Request(`https://admin.contentco-op.com/api/os/quotes/${QUOTE_ID}/views`, { method: "POST" }),
      { params: Promise.resolve({ id: QUOTE_ID }) },
    );
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("unauthorized");
  });

  test("share comment POST without token -> 401 (anonymous write blocked)", async () => {
    const res = await quoteCommentPOST(
      new Request(`https://admin.contentco-op.com/api/share/quote/${QUOTE_ID}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "hello" }),
      }),
      { params: Promise.resolve({ id: QUOTE_ID }) },
    );
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("invalid_share_token");
  });

  test("share comment POST with a tampered token -> 401", async () => {
    const res = await quoteCommentPOST(
      new Request(
        `https://admin.contentco-op.com/api/share/quote/${QUOTE_ID}/comment?token=${QUOTE_ID}.9999999999.deadbeef`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "hello" }),
        },
      ),
      { params: Promise.resolve({ id: QUOTE_ID }) },
    );
    expect(res.status).toBe(401);
  });

  test("share comment POST with a valid share token -> 201", async () => {
    supabaseResult = {
      data: { id: "c1", sender: "client", body: "hello", created_at: "2026-08-11T00:00:00Z" },
      error: null,
    };
    const token = signShareToken(QUOTE_ID)!;
    const res = await quoteCommentPOST(
      new Request(
        `https://admin.contentco-op.com/api/share/quote/${QUOTE_ID}/comment?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "hello" }),
        },
      ),
      { params: Promise.resolve({ id: QUOTE_ID }) },
    );
    expect(res.status).toBe(201);
    expect((await res.json()).comment.id).toBe("c1");
  });

  test("env restored", () => {
    if (savedSecret === undefined) delete process.env.QUOTE_SHARE_SECRET;
    else process.env.QUOTE_SHARE_SECRET = savedSecret;
    expect(true).toBe(true);
  });
});
