import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const testFramework = process.env.VITEST
  ? await import("vitest")
  : await import("node:test");
const describe = testFramework.describe as (name: string, fn: () => void) => unknown;
const test = testFramework.test as (name: string, fn: () => void | Promise<void>) => unknown;

/**
 * Deny-by-default coverage for every route under /api.
 *
 * Every route file must reference the platform guard
 * (enforceRoutePolicy / authorizeRootWorkspaceRoute) or appear in an explicit
 * allowlist below. Guard exemptions must retain their justifying mechanism.
 */

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const API_ROOT = path.join(APP_ROOT, "app/api");

/**
 * Routes intentionally reachable without the platform session guard. This is
 * an exact allowlist: adding any route.ts below app/api fails closed until the
 * route either uses enforceRoutePolicy or is deliberately classified here.
 *
 * Some entries enforce a route-specific credential (share token, portal
 * token, cron secret, or webhook signature); they remain on this list because
 * they intentionally do not require an operator/client platform session.
 */
const PUBLIC_ROUTE_ALLOWLIST: Record<string, string> = {
  "app/api/auth/login/route.ts": "Public login entry point.",
  "app/api/briefs/[id]/files/route.ts": "Brief access-token file exchange.",
  "app/api/briefs/[id]/messages/route.ts": "Brief access-token messages.",
  "app/api/briefs/[id]/route.ts": "Brief access-token detail.",
  "app/api/briefs/route.ts": "Public brief intake.",
  "app/api/cco/bookings/availability/route.ts": "Public booking availability.",
  "app/api/cco/bookings/route.ts": "Public booking intake.",
  "app/api/cco/briefs/[id]/deposit/route.ts": "Public deposit session creation.",
  "app/api/cco/briefs/email-progress/route.ts": "Public brief progress lookup.",
  "app/api/cco/briefs/proposal/route.ts": "Public proposal intake.",
  "app/api/cco/briefs/route.ts": "Public CCO brief intake.",
  "app/api/cco/firebase/status/route.ts": "Public integration status.",
  "app/api/cco/leads/route.ts": "Public lead intake.",
  "app/api/cco/proposals/[id]/pdf/route.ts": "Public proposal PDF delivery.",
  "app/api/chat/route.ts": "Public site chat.",
  "app/api/client/[token]/messages/route.ts": "Portal-token client messages.",
  "app/api/client/[token]/route.ts": "Portal-token client workspace.",
  "app/api/client/portal/route.ts": "Opaque portal-token client workspace; email/contact ID are not capabilities.",
  "app/api/client/estimate/[id]/route.ts": "Public client estimate display.",
  "app/api/client/invoice/[id]/pay/confirm/route.ts": "Public invoice payment confirmation.",
  "app/api/client/invoice/[id]/pay/route.ts": "Public invoice payment session creation.",
  "app/api/client/invoice/[id]/route.ts": "Public client invoice display.",
  "app/api/client/quote/[id]/pay/confirm/route.ts": "Public quote payment confirmation.",
  "app/api/client/quote/[id]/pay/route.ts": "Public quote payment session creation.",
  "app/api/client/quote/[id]/route.ts": "Public client quote display.",
  "app/api/cron/brief-progress-reminders/route.ts": "Cron-secret authenticated reminder trigger.",
  "app/api/cron/invoice-reminders/route.ts": "Cron-secret authenticated reminder trigger.",
  "app/api/health/route.ts": "Public health probe.",
  "app/api/media/hero/transcode/route.ts": "Invite-session authenticated media transcode trigger.",
  "app/api/media/thumbnail/approve/route.ts": "Invite-session authenticated thumbnail approval.",
  "app/api/media/thumbnail/approved/route.ts": "Public approved-thumbnail lookup.",
  "app/api/media/thumbnail/extract/route.ts": "Invite-session authenticated thumbnail extraction trigger.",
  "app/api/platform/manifest/route.ts": "Public platform manifest.",
  "app/api/runtime-proof/route.ts": "Public release identity proof.",
  "app/api/share/quote/[id]/accept/route.ts": "Share-token quote acceptance.",
  "app/api/share/quote/[id]/comment/route.ts": "Share-token quote comments.",
  "app/api/share/quote/[id]/view/route.ts": "Public quote-view telemetry.",
  "app/api/webhooks/stripe/route.ts": "Stripe-signature authenticated webhook.",
};

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

describe("static: every /api route references the guard or is explicitly public", () => {
  const routeFiles = walkRouteFiles(API_ROOT).map((full) => path.relative(APP_ROOT, full));

  test("route inventory is non-trivial (sanity: 130+ routes)", () => {
    assert.ok(routeFiles.length >= 130);
  });

  test("per-method: every exported handler in non-exempt routes references the guard", () => {
    const failures: string[] = [];
    for (const rel of routeFiles) {
      if (rel in PUBLIC_ROUTE_ALLOWLIST || rel in GUARD_EXEMPTIONS) continue;
      const src = readFileSync(path.join(APP_ROOT, rel), "utf8");
      const bodies = exportedMethodBodies(src);
      if (Object.keys(bodies).length === 0) {
        failures.push(`${rel} (no exported HTTP handlers found)`);
        continue;
      }
      const viaHelper = GUARD_VIA_LOCAL_HELPER[rel];
      if (viaHelper) {
        /* The indirection is only valid if the guard really exists in-file. */
        assert.match(
          src,
          /enforceRoutePolicy|authorizeRootWorkspaceRoute/,
          `${rel} claims guard-via-helper but lacks the guard literal`,
        );
        assert.ok(
          src.includes(viaHelper.helper),
          `${rel} no longer defines helper ${viaHelper.helper}`,
        );
      }
      for (const [method, body] of Object.entries(bodies)) {
        const direct = /enforceRoutePolicy|authorizeRootWorkspaceRoute/.test(body);
        const indirect = viaHelper ? body.includes(`${viaHelper.helper}(`) : false;
        if (!direct && !indirect) {
          failures.push(`${rel} ${method}`);
        }
      }
    }
    assert.deepEqual(failures, []);
  });

  test("every exemption still contains its justifying mechanism", () => {
    for (const [rel, { markers }] of Object.entries(GUARD_EXEMPTIONS)) {
      const src = readFileSync(path.join(APP_ROOT, rel), "utf8");
      assert.doesNotMatch(
        src,
        /enforceRoutePolicy|authorizeRootWorkspaceRoute/,
        `${rel} must not reference the platform guard (remove the exemption if it does)`,
      );
      for (const marker of markers) {
        assert.ok(src.includes(marker), `${rel} is exempt but no longer contains "${marker}"`);
      }
    }
  });

  test("exemption map covers only files that exist", () => {
    for (const rel of Object.keys(GUARD_EXEMPTIONS)) {
      assert.ok(routeFiles.includes(rel), `exemption for missing file ${rel}`);
    }
  });

  test("public allowlist covers only existing, unguarded routes with a justification", () => {
    for (const [rel, justification] of Object.entries(PUBLIC_ROUTE_ALLOWLIST)) {
      assert.ok(routeFiles.includes(rel), `public allowlist entry is missing: ${rel}`);
      assert.ok(justification.trim().length > 0, `${rel} needs a public-route justification`);
      const src = readFileSync(path.join(APP_ROOT, rel), "utf8");
      assert.doesNotMatch(
        src,
        /enforceRoutePolicy|authorizeRootWorkspaceRoute/,
        `${rel} now uses the platform guard and must leave the public allowlist`,
      );
    }
  });
});

const RETIRED_LEGACY_ROUTES = [
  ["dashboard GET", "app/api/dashboard/route.ts"],
  ["quote PDF POST", "app/api/quotes/[id]/pdf/route.ts"],
  ["quote preview POST", "app/api/quotes/[id]/preview/route.ts"],
  ["client estimate decision POST", "app/api/client/estimate/[id]/decision/route.ts"],
] as const;

describe("retired legacy methods cannot expose handlers", () => {
  for (const [method, rel] of RETIRED_LEGACY_ROUTES) {
    test(`${method} is absent from the application route tree`, () => {
      assert.equal(existsSync(path.join(APP_ROOT, rel)), false, rel);
    });
  }
});

/* Runtime checks are retained for the repository's Vitest suite. The required
 * bare Node runner executes the dependency-free static guard above. */
if (process.env.VITEST) {
  const { afterEach, beforeEach, expect, vi } = testFramework as typeof import("vitest");
  // Dynamic specifiers preserve Node's required .ts extensions without changing app tsconfig.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const importTypeScriptModule = (specifier: string): Promise<Record<string, any>> =>
    import(specifier);

  let authenticatedEmail: string | null = null;
  let requestHost = "admin.contentco-op.com";
  let dataAllowed = false;
  let supabaseResult: unknown = { data: null, error: null };
  let tableResult: ((table: string) => unknown) | null = null;
  const serviceClientAccess = vi.fn();
  const databaseAccess = vi.fn((table: string) => {
    if (!dataAllowed) throw new Error("unexpected_database_access_before_authorization");
    const result = tableResult ? tableResult(table) : supabaseResult;
    const handler: ProxyHandler<object> = {
      get(_target, prop) {
        if (prop === "then") return (resolve: (value: unknown) => unknown) => resolve(result);
        return vi.fn(() => new Proxy({}, handler));
      },
    };
    return new Proxy({}, handler);
  });
  const serviceClient = { from: databaseAccess };
  const crewRead = vi.fn(() => { throw new Error("unexpected_crew_service_access"); });
  const crewOverride = vi.fn(() => { throw new Error("unexpected_override_service_access"); });
  const dispatch = vi.fn(() => { throw new Error("unexpected_dispatch_service_access"); });

  vi.doMock("next/headers", () => ({
    cookies: async () => ({ get: () => undefined }),
    headers: async () => new Headers({ host: requestHost }),
  }));
  vi.doMock("@/lib/supabase-server", () => ({
    createClient: async () => ({
      auth: { getUser: async () => ({
        data: { user: authenticatedEmail ? { id: "fixture-user", email: authenticatedEmail } : null },
        error: null,
      }) },
    }),
  }));
  vi.doMock("@/lib/os-auth", () => ({
    getRootOperatorRoleForHost: () => "operator_admin",
    isEmailAuthorizedForRootHost: (email: string, host: string | null) =>
      email === "operator@fixture.test" && host === "admin.contentco-op.com",
  }));
  vi.doMock("@/lib/supabase", () => ({
    getSupabase: () => { serviceClientAccess(); return serviceClient; },
    supabase: serviceClient,
  }));
  vi.doMock("@/lib/acs-operations", () => ({
    fetchCrewPositions: crewRead,
    postCrewOverride: crewOverride,
    dispatchCrew: dispatch,
  }));

  vi.doMock("@/lib/os-document-renderer", () => ({
    renderQuoteHtml: async () => "<html><body>quote</body></html>",
  }));

  const [
    { GET: financeOverviewGET },
    { GET: contactsGET },
    { GET: invoicesGET },
    { GET: osQuoteDetailGET },
    { GET: paymentsGET },
    { GET: quotePreviewGET },
    { POST: quoteViewsPOST },
    { POST: quoteCommentPOST },
    { signShareToken },
    { GET: legacyQuotesGET, POST: legacyQuotesPOST },
    { GET: legacyQuoteGET, PATCH: legacyQuotePATCH },
    { POST: legacyQuoteConvertPOST },
    { POST: legacyQuoteAcceptPOST },
    { POST: legacyDispatchPOST },
    { GET: legacyCrewGET },
    { POST: legacyCrewOverridePOST },
    { GET: portalGET },
  ] = await Promise.all([
    importTypeScriptModule("../../app/api/os/finance/overview/route.ts"),
    importTypeScriptModule("../../app/api/os/contacts/route.ts"),
    importTypeScriptModule("../../app/api/os/invoices/route.ts"),
    importTypeScriptModule("../../app/api/os/quotes/[id]/route.ts"),
    importTypeScriptModule("../../app/api/os/payments/route.ts"),
    importTypeScriptModule("../../app/api/os/quotes/[id]/preview/route.ts"),
    importTypeScriptModule("../../app/api/os/quotes/[id]/views/route.ts"),
    importTypeScriptModule("../../app/api/share/quote/[id]/comment/route.ts"),
    importTypeScriptModule("../share-token.ts"),
    importTypeScriptModule("../../app/api/quotes/route.ts"),
    importTypeScriptModule("../../app/api/quotes/[id]/route.ts"),
    importTypeScriptModule("../../app/api/quotes/[id]/convert/route.ts"),
    importTypeScriptModule("../../app/api/client/quote/[id]/accept/route.ts"),
    importTypeScriptModule("../../app/api/operations/dispatch/route.ts"),
    importTypeScriptModule("../../app/api/operations/crew/route.ts"),
    importTypeScriptModule("../../app/api/operations/crew/override/route.ts"),
    importTypeScriptModule("../../app/api/client/portal/route.ts"),
  ]);

  const QUOTE_ID = "4d2f0b7e-9c1a-4e2b-b7a1-0f3c5d6e7a8b";
  const savedSecret = process.env.QUOTE_SHARE_SECRET;

  function getRequest(urlPath: string, init?: RequestInit) {
    return new Request(`https://admin.contentco-op.com${urlPath}`, init);
  }

  function quoteContext() {
    return { params: Promise.resolve({ id: QUOTE_ID }) };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    authenticatedEmail = null;
    requestHost = "admin.contentco-op.com";
    dataAllowed = false;
    tableResult = null;
    process.env.QUOTE_SHARE_SECRET = "test-share-secret";
    supabaseResult = { data: { id: QUOTE_ID, business_unit: "CC" }, error: null };
  });

  afterEach(() => {
    if (savedSecret === undefined) delete process.env.QUOTE_SHARE_SECRET;
    else process.env.QUOTE_SHARE_SECRET = savedSecret;
  });

  describe("runtime: unauthenticated guarded API calls fail closed", () => {
    const cases: Array<[string, () => Promise<Response>]> = [
      ["os finance overview", () => financeOverviewGET(getRequest("/api/os/finance/overview"))],
      ["os contacts", () => contactsGET(getRequest("/api/os/contacts"))],
      ["os invoices", () => invoicesGET(getRequest("/api/os/invoices"))],
      ["os quote detail", () => osQuoteDetailGET(getRequest(`/api/os/quotes/${QUOTE_ID}`), quoteContext())],
      ["os payments", () => paymentsGET(getRequest("/api/os/payments"))],
      ["legacy quotes GET", () => legacyQuotesGET(getRequest("/api/quotes"))],
      ["legacy quotes POST", () => legacyQuotesPOST(getRequest("/api/quotes", { method: "POST" }))],
      ["legacy quote GET", () => legacyQuoteGET(getRequest(`/api/quotes/${QUOTE_ID}`), quoteContext())],
      ["legacy quote PATCH", () => legacyQuotePATCH(getRequest(`/api/quotes/${QUOTE_ID}`, { method: "PATCH" }), quoteContext())],
      ["legacy quote convert", () => legacyQuoteConvertPOST(getRequest(`/api/quotes/${QUOTE_ID}/convert`, { method: "POST" }), quoteContext())],
      ["legacy client quote accept", () => legacyQuoteAcceptPOST(getRequest(`/api/client/quote/${QUOTE_ID}/accept`, { method: "POST" }), quoteContext())],
      ["legacy dispatch", () => legacyDispatchPOST(getRequest("/api/operations/dispatch", { method: "POST" }))],
      ["legacy crew positions", () => legacyCrewGET()],
      ["legacy crew override", () => legacyCrewOverridePOST(getRequest("/api/operations/crew/override", { method: "POST" }))],
    ];

    for (const [name, invoke] of cases) {
      test(`${name} -> 401`, async () => {
        const res = await invoke();
        expect(res.status).toBe(401);
        expect((await res.json()).error).toBe("unauthorized");
        expect(serviceClientAccess).not.toHaveBeenCalled();
        expect(databaseAccess).not.toHaveBeenCalled();
        expect(crewRead).not.toHaveBeenCalled();
        expect(crewOverride).not.toHaveBeenCalled();
        expect(dispatch).not.toHaveBeenCalled();
      });
      if (name.startsWith("legacy")) {
        test(`${name} rejects an authenticated non-operator before data or services`, async () => {
          authenticatedEmail = "client@fixture.test";
          const res = await invoke();
          expect(res.status).toBe(403);
          expect(serviceClientAccess).not.toHaveBeenCalled();
          expect(databaseAccess).not.toHaveBeenCalled();
          expect(crewRead).not.toHaveBeenCalled();
          expect(crewOverride).not.toHaveBeenCalled();
          expect(dispatch).not.toHaveBeenCalled();
        });
      }
    }

    test("os quote preview without token -> 401", async () => {
      const res = await quotePreviewGET(
        getRequest(`/api/os/quotes/${QUOTE_ID}/preview`),
        quoteContext(),
      );
      expect(res.status).toBe(401);
    });

    test("os quote preview with a valid share token -> 200", async () => {
      dataAllowed = true;
      const token = signShareToken(QUOTE_ID)!;
      const res = await quotePreviewGET(
        getRequest(`/api/os/quotes/${QUOTE_ID}/preview?token=${encodeURIComponent(token)}`),
        quoteContext(),
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
    });

    test("os quote preview with a tampered token -> 401", async () => {
      const res = await quotePreviewGET(
        getRequest(`/api/os/quotes/${QUOTE_ID}/preview?token=${QUOTE_ID}.9999999999.deadbeef`),
        quoteContext(),
      );
      expect(res.status).toBe(401);
    });

    test("os quote views POST -> 401", async () => {
      const res = await quoteViewsPOST(
        getRequest(`/api/os/quotes/${QUOTE_ID}/views`, { method: "POST" }),
        quoteContext(),
      );
      expect(res.status).toBe(401);
    });

    test("share comment POST without token -> 401", async () => {
      const res = await quoteCommentPOST(
        getRequest(`/api/share/quote/${QUOTE_ID}/comment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "hello" }),
        }),
        quoteContext(),
      );
      expect(res.status).toBe(401);
      expect((await res.json()).error).toBe("invalid_share_token");
    });

    test("share comment POST with a tampered token -> 401", async () => {
      const res = await quoteCommentPOST(
        getRequest(
          `/api/share/quote/${QUOTE_ID}/comment?token=${QUOTE_ID}.9999999999.deadbeef`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "hello" }),
          },
        ),
        quoteContext(),
      );
      expect(res.status).toBe(401);
    });

    test("share comment POST with a valid share token -> 201", async () => {
      dataAllowed = true;
      supabaseResult = {
        data: { id: "c1", sender: "client", body: "hello", created_at: "2026-08-11T00:00:00Z" },
        error: null,
      };
      const token = signShareToken(QUOTE_ID)!;
      const res = await quoteCommentPOST(
        getRequest(
          `/api/share/quote/${QUOTE_ID}/comment?token=${encodeURIComponent(token)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "hello" }),
          },
        ),
        quoteContext(),
      );
      expect(res.status).toBe(201);
      expect((await res.json()).comment.id).toBe("c1");
    });
    test("authorized internal quote reader reaches only the synthetic data fixture", async () => {
      authenticatedEmail = "operator@fixture.test";
      dataAllowed = true;
      supabaseResult = { data: [{ id: QUOTE_ID }], error: null };
      const res = await legacyQuotesGET(getRequest("/api/quotes"));
      expect(res.status).toBe(200);
      expect((await res.json()).quotes).toEqual([{ id: QUOTE_ID }]);
      expect(databaseAccess).toHaveBeenCalledWith("quotes");
    });

    test("operator identity on the wrong host does not reach legacy quote data", async () => {
      authenticatedEmail = "operator@fixture.test";
      requestHost = "contentco-op.com";
      const res = await legacyQuotesGET(getRequest("/api/quotes"));
      expect(res.status).toBe(403);
      expect(databaseAccess).not.toHaveBeenCalled();
    });

    for (const query of ["", "?email=client%40fixture.test", "?contact_id=fixture-contact", "?token=short"]) {
      test(`newer portal rejects non-capability lookup ${query} before service-role access`, async () => {
        const { NextRequest } = await import("next/server");
        const res = await portalGET(new NextRequest(`https://contentco-op.com/api/client/portal${query}`));
        expect(res.status).toBe(401);
        expect(serviceClientAccess).not.toHaveBeenCalled();
        expect(databaseAccess).not.toHaveBeenCalled();
      });
    }

    test("newer portal checks an invalid opaque token without returning contact data", async () => {
      dataAllowed = true;
      supabaseResult = { data: [], error: null };
      const { NextRequest } = await import("next/server");
      const res = await portalGET(new NextRequest("https://contentco-op.com/api/client/portal?token=invalid-fixture-token"));
      expect(res.status).toBe(404);
      expect((await res.json()).error).toBe("invalid_token");
      expect(databaseAccess).toHaveBeenCalledTimes(1);
      expect(databaseAccess).toHaveBeenCalledWith("contacts");
    });

    test("newer token portal remains usable without an operator session", async () => {
      dataAllowed = true;
      tableResult = (table) => ({
        data: table === "contacts" ? [{ id: "fixture-contact", email: "client@fixture.test" }] : [],
        error: null,
      });
      const { NextRequest } = await import("next/server");
      const res = await portalGET(new NextRequest("https://contentco-op.com/api/client/portal?token=valid-fixture-token"));
      expect(res.status).toBe(200);
      expect((await res.json()).contact.id).toBe("fixture-contact");
      expect(databaseAccess.mock.calls.map(([table]) => table)).toEqual(["contacts", "quotes", "jobs", "invoices"]);
    });

  });
}
