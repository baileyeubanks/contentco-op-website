import { describe, expect, test } from "vitest";
import {
  ADMIN_OS_ORIGIN,
  CLIENT_CVP_ORIGIN,
  publicCanonHostRedirects,
  publicCanonRedirectTarget,
} from "../public-host-redirects";

describe("canon host map on the public marketing host", () => {
  test("sends CCO OS off contentco-op.com onto admin.contentco-op.com", () => {
    expect(publicCanonRedirectTarget("contentco-op.com", "/os")).toBe(`${ADMIN_OS_ORIGIN}/os`);
    expect(publicCanonRedirectTarget("www.contentco-op.com", "/os/login")).toBe(
      `${ADMIN_OS_ORIGIN}/os/login`,
    );
    expect(publicCanonRedirectTarget("CONTENTCO-OP.COM:443", "/os/overview")).toBe(
      `${ADMIN_OS_ORIGIN}/os/overview`,
    );
  });

  test("sends the public /login (CVP-labeled) to the client host", () => {
    expect(publicCanonRedirectTarget("contentco-op.com", "/login")).toBe(
      `${CLIENT_CVP_ORIGIN}/login`,
    );
  });

  test("leaves admin, loopback, and unrelated hosts alone", () => {
    for (const host of [
      "admin.contentco-op.com",
      "localhost:4100",
      "127.0.0.1:4100",
      "contentco-op.com.evil.example",
      "evilcontentco-op.com",
    ]) {
      expect(publicCanonRedirectTarget(host, "/os")).toBeNull();
      expect(publicCanonRedirectTarget(host, "/login")).toBeNull();
    }
  });

  test("does not claim marketing routes", () => {
    expect(publicCanonRedirectTarget("contentco-op.com", "/")).toBeNull();
    expect(publicCanonRedirectTarget("contentco-op.com", "/brief")).toBeNull();
    expect(publicCanonRedirectTarget("contentco-op.com", "/book")).toBeNull();
  });
});

describe("next.config publicCanonHostRedirects", () => {
  test("covers apex and www for /os, /os/*, and /login", () => {
    const keys = publicCanonHostRedirects.map(
      (row) => `${row.has[0].value} ${row.source} -> ${row.destination} ${row.statusCode}`,
    );
    expect(keys).toEqual([
      "contentco-op.com /login -> https://client.contentco-op.com/login 303",
      "contentco-op.com /os -> https://admin.contentco-op.com/os 307",
      "contentco-op.com /os/:path* -> https://admin.contentco-op.com/os/:path* 307",
      "www.contentco-op.com /login -> https://client.contentco-op.com/login 303",
      "www.contentco-op.com /os -> https://admin.contentco-op.com/os 307",
      "www.contentco-op.com /os/:path* -> https://admin.contentco-op.com/os/:path* 307",
    ]);
  });

  test("uses 303 for public /login so POST bodies are not forwarded", () => {
    const login = publicCanonHostRedirects.filter((row) => row.source === "/login");
    expect(login.length).toBe(2);
    expect(login.every((row) => row.statusCode === 303)).toBe(true);
  });
});
