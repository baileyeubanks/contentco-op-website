import { afterEach, describe, expect, test } from "vitest";
import { publicRedirectUrl, publicRequestOrigin } from "../request-origin";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.CCO_HOME_URL;
});

describe("publicRequestOrigin", () => {
  test("prefers a real forwarded host over the bind address in request.url", () => {
    const request = new Request("https://0.0.0.0:4100/os/logout", {
      headers: {
        host: "admin.contentco-op.com",
        "x-forwarded-proto": "https",
      },
    });
    expect(publicRequestOrigin(request)).toBe("https://admin.contentco-op.com");
  });

  test("uses x-forwarded-host when present", () => {
    const request = new Request("https://0.0.0.0:4100/os/logout", {
      headers: {
        host: "0.0.0.0:4100",
        "x-forwarded-host": "contentco-op.com",
        "x-forwarded-proto": "https",
      },
    });
    expect(publicRequestOrigin(request)).toBe("https://contentco-op.com");
  });

  test("ignores loopback hosts and falls back to the public site", () => {
    const request = new Request("https://0.0.0.0:4100/os/logout", {
      headers: { host: "0.0.0.0:4100" },
    });
    expect(publicRequestOrigin(request)).toBe("https://contentco-op.com");
  });
});

describe("publicRedirectUrl", () => {
  test("never resolves a path against the bind-address request.url", () => {
    const request = new Request("https://0.0.0.0:4100/os/logout", {
      headers: {
        host: "admin.contentco-op.com",
        "x-forwarded-proto": "https",
      },
    });
    expect(publicRedirectUrl(request, "/os?reset=1").toString()).toBe(
      "https://admin.contentco-op.com/os?reset=1",
    );
  });
});
