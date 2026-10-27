import { describe, expect, test } from "vitest";
import {
  ADMIN_HOST,
  CLIENT_CVP_ORIGIN,
  CVP_ORIGIN,
  adminHostRedirectTarget,
  publicCanonHostRedirects,
  publicCanonRedirectTarget,
} from "../public-host-redirects";

describe("canon host map on the public marketing host", () => {
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
      expect(publicCanonRedirectTarget(host, "/login")).toBeNull();
    }
  });

  test("does not claim marketing routes", () => {
    expect(publicCanonRedirectTarget("contentco-op.com", "/")).toBeNull();
    expect(publicCanonRedirectTarget("contentco-op.com", "/brief")).toBeNull();
    expect(publicCanonRedirectTarget("contentco-op.com", "/os")).toBeNull();
  });
});

describe("next.config publicCanonHostRedirects", () => {
  test("covers apex and www for /login only", () => {
    const keys = publicCanonHostRedirects.map(
      (row) => `${row.has[0].value} ${row.source} -> ${row.destination} ${row.statusCode}`,
    );
    expect(keys).toEqual([
      "contentco-op.com /login -> https://client.contentco-op.com/login 303",
      "www.contentco-op.com /login -> https://client.contentco-op.com/login 303",
    ]);
  });
});

describe("retired admin host", () => {
  test("every admin host spelling resolves to Co-VideoPro", () => {
    for (const host of [ADMIN_HOST, "ADMIN.contentco-op.com", "admin.contentco-op.com:443", "admin.contentco-op.com."]) {
      expect(adminHostRedirectTarget(host)).toBe(CVP_ORIGIN);
    }
  });
  test("other hosts are not redirected", () => {
    for (const host of ["contentco-op.com", "www.contentco-op.com", "client.contentco-op.com", "admin.contentco-op.com.evil.example", "xadmin.contentco-op.com", "", null, undefined]) {
      expect(adminHostRedirectTarget(host as string)).toBeNull();
    }
  });
});
