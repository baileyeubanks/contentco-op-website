import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GET as logoutGet } from "../../app/os/logout/route";

const BIND_ORIGIN = "http://0.0.0.0:4100";

function location(res: Response) {
  return res.headers.get("location");
}

function setCookieHeaders(res: Response): string[] {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

beforeEach(() => {
  vi.stubEnv("CCO_SESSION_SECRET", "test-secret-for-logout-origin");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /os/logout", () => {
  test("does not redirect to the bind address when Host is the admin site", async () => {
    const res = await logoutGet(
      new Request(`${BIND_ORIGIN}/os/logout`, {
        headers: {
          host: "admin.contentco-op.com",
          "x-forwarded-proto": "https",
        },
      }),
    );
    expect(res.status).toBe(307);
    expect(location(res)).toBe("https://admin.contentco-op.com/os?reset=1");
    expect(location(res)).not.toMatch(/0\.0\.0\.0/);
  });

  test("falls back to the public origin when Host is the bind address", async () => {
    const res = await logoutGet(new Request(`${BIND_ORIGIN}/os/logout`));
    expect(res.status).toBe(307);
    expect(location(res)).toBe("https://contentco-op.com/os?reset=1");
    expect(location(res)).not.toMatch(/0\.0\.0\.0/);
  });

  test("still clears the operator session cookie", async () => {
    const res = await logoutGet(
      new Request(`${BIND_ORIGIN}/os/logout`, {
        headers: { host: "admin.contentco-op.com" },
      }),
    );
    const cleared = setCookieHeaders(res);
    expect(cleared.length).toBeGreaterThan(0);
    expect(cleared.some((c) => /Max-Age=0/i.test(c) && /Expires=Thu, 01 Jan 1970/i.test(c))).toBe(
      true,
    );
  });
});
