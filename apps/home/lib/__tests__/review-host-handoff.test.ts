import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

const auth = vi.hoisted(() => ({ create: vi.fn(() => { throw new Error("Review handoff must not authenticate"); }) }));
vi.mock("@supabase/ssr", () => ({ createServerClient: auth.create }));
afterEach(() => vi.restoreAllMocks());

const paths = [
  "/review/fixture-token-123",
  "/review/fixture%2Ftoken?version=v7&t=12.5&note=one%20two&note=three",
  "/review-k7qp2m9xa4?source=email",
  "/weftec-sizzle-v12-k7qp2m9xa4?next=https%3A%2F%2Fevil.example",
];

describe("marketing host review handoff through the real proxy", () => {
  it.each(paths)("preserves %s at the fixed client host", async path => {
    for (const host of ["contentco-op.com", "www.contentco-op.com"]) {
      for (const method of ["GET", "HEAD"]) {
        const logs = ["log", "info", "warn", "error", "debug"].map(name => vi.spyOn(console, name as "log").mockImplementation(() => {}));
        const response = await proxy(new NextRequest(`https://${host}${path}`, {
          method, headers: { "x-forwarded-host": "evil.example", host: "evil.example" },
        }));
        expect(response.status).toBe(308);
        expect(response.headers.get("location")).toBe(`https://client.contentco-op.com${path}`);
        expect(response.headers.get("referrer-policy")).toBe("no-referrer");
        expect(auth.create).not.toHaveBeenCalled();
        for (const log of logs) { expect(log).not.toHaveBeenCalled(); log.mockRestore(); }
      }
    }
  });

  it.each(["/", "/brief", "/book", "/reviews", "/review", "/review-not-a-key", "/review-k7qp2m9xa4/extra", "/weftec-v0-k7qp2m9xa4", "/other/weftec-v1-k7qp2m9xa4", "/api/review/fixture", "/r/fixture"])("does not claim %s", async path => {
    const response = await proxy(new NextRequest(`https://contentco-op.com${path}`));
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it.each(["admin.contentco-op.com", "client.contentco-op.com", "contentco-op.com.evil.example", "localhost:4100"])("does not redirect reviews on %s", async host => {
    const response = await proxy(new NextRequest(`https://${host}/review/fixture`));
    expect(response.headers.get("location")).toBeNull();
  });

  it("does not forward POST bodies to a different host", async () => {
    const response = await proxy(new NextRequest("https://contentco-op.com/review/fixture", { method: "POST", body: "fixture" }));
    expect(response.headers.get("location")).toBeNull();
  });
});
