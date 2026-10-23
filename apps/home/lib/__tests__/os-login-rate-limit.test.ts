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
async function attempt(email = "owner@contentco-op.com", ip = "203.0.113.1", password = "wrong") {
  const start = Date.now();
  const req = new Request("https://admin.contentco-op.com/api/os/login", {
    method: "POST", headers: { "cf-connecting-ip": ip, "x-forwarded-for": "192.0.2.99" },
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
    auth.cookieWrite.mockClear();
    auth.verify.mockReset().mockReturnValue(false);
    auth.signIn.mockReset().mockResolvedValue({ error: { message: "Invalid login credentials" } });
    post = (await import("@/app/api/os/login/route")).POST;
  });
  afterEach(() => vi.useRealTimers());

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
