import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Server, IncomingMessage } from "node:http";
import { Socket } from "node:net";
import { installLoginPeerBridge } from "@/lib/login-request-peer";
installLoginPeerBridge();
const auth = vi.hoisted(() => ({ signIn: vi.fn(), verify: vi.fn(), cookieWrite: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: auth.cookieWrite }) }));
vi.mock("@/lib/runtime-config", () => ({ getRequiredPublicSupabaseConfig: () => ({ url: "https://example.invalid", anonKey: "fixture" }) }));
vi.mock("@supabase/ssr", () => ({ createServerClient: (_url: string, _key: string, options: { cookies: { setAll: (value: unknown[]) => void } }) => ({
  auth: { signInWithPassword: async (credentials: unknown) => {
    const result = await auth.signIn(credentials);
    if (!result.error) options.cookies.setAll([{ name: "provider-session", value: "fixture-session", options: { httpOnly: true } }]);
    return result;
  } },
}) }));
vi.mock("@/lib/os-auth", () => ({
  verifyRootOperatorCredentials: auth.verify,
  isEmailAuthorizedForRootHost: (email: string) => email === "owner@contentco-op.com",
  resolveRootAuthorityForHost: () => "cc",
}));
vi.mock("@/lib/session", () => ({
  createInviteSession: () => "signed-test-session", getSessionCookieName: () => "session", getSessionTtlSeconds: () => 3600,
}));

let post: typeof import("@/app/api/os/login/route").POST;
async function attempt(email = "owner@contentco-op.com", ip = "203.0.113.1", password = "wrong", cookie = "") {
  const start = Date.now();
  const req = new Request("https://admin.contentco-op.com/api/os/login", {
    method: "POST", headers: { "cf-connecting-ip": ip, "x-forwarded-for": "192.0.2.99", cookie },
    body: new URLSearchParams({ email, password }),
  });
  const server = new Server();
  const socket = new Socket();
  Object.defineProperty(socket, "remoteAddress", { value: "127.0.0.1" });
  const incoming = new IncomingMessage(socket);
  incoming.url = "/api/os/login";
  const promise = new Promise<Response>((resolve, reject) => {
    server.on("request", () => { post(req).then(resolve, reject); });
    server.emit("request", incoming);
  });
  let elapsed = -1;
  void promise.then(() => { elapsed = Date.now() - start; });
  await vi.advanceTimersByTimeAsync(2000);
  const response = await promise;
  return { status: response.status, body: await response.json(), elapsed, cookie: response.headers.get("set-cookie") };
}

describe("operator login abuse boundary", () => {
  beforeEach(async () => {
    vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-23T12:00:00Z"));
    vi.stubEnv("CCO_SESSION_SECRET", "isolated-known-device-test-secret");
    auth.cookieWrite.mockClear();
    auth.verify.mockReset().mockReturnValue(false);
    auth.signIn.mockReset().mockResolvedValue({ error: { message: "Invalid login credentials" } });
    post = (await import("@/app/api/os/login/route")).POST;
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

  it("limits repeated email attempts only for that requester, never the victim elsewhere", async () => {
    for (let i = 0; i < 8; i++) await attempt();
    expect(auth.signIn).toHaveBeenCalledTimes(5);
    auth.signIn.mockResolvedValueOnce({ error: null });
    const owner = await attempt("owner@contentco-op.com", "203.0.113.2", "correct");
    expect(owner.status).toBe(200);
    expect(owner.cookie).toContain("provider-session=fixture-session");
    expect(auth.cookieWrite).not.toHaveBeenCalled();
  });

  it("caps one requester cycling emails", async () => {
    for (let i = 0; i < 24; i++) await attempt(`guess${i}@contentco-op.com`);
    expect(auth.signIn).toHaveBeenCalledTimes(20);
  });

  it("buckets rotating IPv6 addresses in one /64", async () => {
    for (let i = 1; i < 9; i++) await attempt("owner@contentco-op.com", `2001:db8:1234:5678::${i}`);
    expect(auth.signIn).toHaveBeenCalledTimes(5);
  });

  it("caps an IPv6 /48 sweep across /64s even when the emails change", async () => {
    for (let i = 0; i < 110; i++) {
      await attempt(`guess${i}@contentco-op.com`, `2001:db8:1234:${i.toString(16)}::1`);
    }
    expect(auth.signIn).toHaveBeenCalledTimes(100);
    await attempt("other@contentco-op.com", "2001:db8:1235::1");
    expect(auth.signIn).toHaveBeenCalledTimes(101);
  });

  it("caps a target across /48s and IPv4 addresses with generic two-second denials", async () => {
    const bad = await attempt("nobody@example.com", "192.0.2.99");
    for (let i = 1; i <= 40; i++) {
      await attempt("owner@contentco-op.com", i % 2 ? `2001:db8:${i.toString(16)}::1` : `203.0.113.${i}`);
    }
    expect(auth.signIn).toHaveBeenCalledTimes(30);
    auth.verify.mockReturnValue(true);
    const unknownDevice = await attempt("owner@contentco-op.com", "192.0.2.1", "correct");
    const forgedDevice = await attempt("owner@contentco-op.com", "192.0.2.2", "correct", "__Host-cco_known_device=forged");
    expect(unknownDevice).toEqual(bad);
    expect(forgedDevice).toEqual(bad);
    expect(bad.elapsed).toBe(2000);
    await vi.advanceTimersByTimeAsync(15 * 60_000);
    expect((await attempt("owner@contentco-op.com", "192.0.2.1", "correct")).status).toBe(200);
  });

  it("issues a secure account-bound device cookie only after success and lets that owner through a spray", async () => {
    expect((await attempt()).cookie).toBeNull();
    auth.verify.mockReturnValue(true);
    const signedIn = await attempt("owner@contentco-op.com", "192.0.2.1", "correct");
    const cookie = signedIn.cookie?.match(/__Host-cco_known_device=[^; ,]+/)?.[0];
    expect(cookie).toBeTruthy();
    const deviceAttributes = signedIn.cookie?.split(", session=")[0];
    expect(deviceAttributes).toContain("; HttpOnly;");
    expect(deviceAttributes).toContain("; Secure;");
    expect(deviceAttributes).toContain("; SameSite=strict");
    expect(deviceAttributes).toContain("; Path=/;");
    auth.verify.mockReturnValue(false);
    for (let i = 1; i <= 35; i++) await attempt("owner@contentco-op.com", `203.0.113.${i}`);
    const before = auth.verify.mock.calls.length;
    // A device cookie is not authentication: wrong credentials must still fail.
    expect((await attempt("owner@contentco-op.com", "192.0.2.2", "wrong", cookie)).status).toBe(401);
    expect(auth.verify.mock.calls.length).toBe(before + 1);
    auth.verify.mockReturnValue(true);
    expect((await attempt("owner@contentco-op.com", "192.0.2.3", "correct", cookie)).status).toBe(200);
    expect((await attempt("owner@contentco-op.com", "192.0.2.4", "correct", cookie + "tampered")).status).toBe(401);
    auth.verify.mockReturnValue(false);
    for (let i = 1; i <= 30; i++) await attempt("second@contentco-op.com", `198.51.100.${i}`);
    auth.verify.mockReturnValue(true);
    expect((await attempt("second@contentco-op.com", "192.0.2.5", "correct", cookie)).status).toBe(401);
    // Keep the account budget active while making the device expire.
    await vi.advanceTimersByTimeAsync(31 * 24 * 60 * 60_000);
    auth.verify.mockReturnValue(false);
    for (let i = 1; i <= 30; i++) await attempt("owner@contentco-op.com", `203.0.113.${i}`);
    auth.verify.mockReturnValue(true);
    expect((await attempt("owner@contentco-op.com", "192.0.2.6", "correct", cookie)).status).toBe(401);
  });

  it("gives unknown, wrong-password and throttled attempts the same response and timing floor", async () => {
    const bad = await attempt();
    const unknown = await attempt("unknown@example.com");
    for (let i = 0; i < 5; i++) await attempt();
    const limited = await attempt();
    expect(unknown).toEqual(bad);
    expect(limited).toEqual(bad);
    expect(bad).toMatchObject({ status: 401, body: { error: "Unable to sign in. Check your credentials or try again later." }, cookie: null });
    expect(bad.elapsed).toBeGreaterThanOrEqual(500);
  });

  it("bounds a stalled provider and never releases its late success", async () => {
    let resolve!: (result: { error: null }) => void;
    auth.signIn.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const denied = await attempt();
    expect(denied.status).toBe(401);
    expect(denied.elapsed).toBe(2000);
    expect(denied.cookie).toBeNull();
    resolve({ error: null });
    await vi.advanceTimersByTimeAsync(2000);
    expect(denied.cookie).toBeNull();
    expect(auth.cookieWrite).not.toHaveBeenCalled();
  });

  it("allows attempts again after the requester's window expires", async () => {
    for (let i = 0; i < 8; i++) await attempt();
    await vi.advanceTimersByTimeAsync(15 * 60_000);
    await attempt();
    expect(auth.signIn).toHaveBeenCalledTimes(6);
  });
});
