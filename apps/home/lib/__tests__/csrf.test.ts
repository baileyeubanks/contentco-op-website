import { afterEach, describe, expect, test, vi } from "vitest";
import { validateCsrf } from "../csrf";

function request(headers: HeadersInit) {
  return new Request("https://contentco-op.com/api/cco/briefs", {
    method: "POST",
    headers,
  });
}

describe("validateCsrf", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("accepts an exact configured origin", () => {
    expect(validateCsrf(request({ origin: "https://contentco-op.com" }))).toEqual({ valid: true });
  });

  test("rejects origin and referer lookalikes", () => {
    expect(validateCsrf(request({ origin: "https://contentco-op.com.attacker.example" }))).toMatchObject({ valid: false });
    expect(validateCsrf(request({ referer: "https://www.contentco-op.com.attacker.example/path" }))).toMatchObject({ valid: false });
  });

  test("local development opt-in does not accept a localhost lookalike", () => {
    vi.stubEnv("ALLOW_LOCALHOST_CSRF", "true");
    expect(validateCsrf(request({ origin: "http://localhost:4100" }))).toEqual({ valid: true });
    expect(validateCsrf(request({ origin: "http://localhost.attacker.example" }))).toMatchObject({ valid: false });
  });

  test("local development opt-in still rejects an origin-less write", () => {
    vi.stubEnv("ALLOW_LOCALHOST_CSRF", "true");
    expect(validateCsrf(request({}))).toMatchObject({ valid: false });
  });
});
