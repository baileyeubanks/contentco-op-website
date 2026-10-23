import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("node:fs", () => ({ default: { statSync: () => undefined } }));
import { verifyRootOperatorCredentials } from "@/lib/os-auth";

afterEach(() => vi.unstubAllEnvs());
describe("operator credential comparison", () => {
  it("compares passwords of any length without throwing and rejects unknown accounts", () => {
    vi.stubEnv("CCO_OS_OPERATOR_CREDENTIALS", "owner@contentco-op.com=fixture-password");
    expect(verifyRootOperatorCredentials(" OWNER@CONTENTCO-OP.COM ", "fixture-password")).toBe(true);
    for (const password of ["", "x", "fixture-password-wrong", "🔑".repeat(50)]) {
      expect(verifyRootOperatorCredentials("owner@contentco-op.com", password)).toBe(false);
    }
    expect(verifyRootOperatorCredentials("unknown@contentco-op.com", "fixture-password")).toBe(false);
    expect(verifyRootOperatorCredentials("unknown@contentco-op.com", "")).toBe(false);
  });
});
