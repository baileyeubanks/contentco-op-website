import { afterEach, describe, expect, it, vi } from "vitest";
import { loginClientBucket } from "@/lib/os-login-limits";

afterEach(() => { vi.useRealTimers(); });
describe("requester-bound login budgets", () => {
  it("normalizes IPv4 mappings and IPv6 /64 privacy addresses", () => {
    expect(loginClientBucket("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(loginClientBucket("2001:0db8:0001:0002:ffff:ffff:ffff:ffff")).toBe(loginClientBucket("2001:db8:1:2::1"));
    expect(loginClientBucket("2001:db8:1:3::1")).not.toBe(loginClientBucket("2001:db8:1:2::1"));
    expect(loginClientBucket("garbage")).toBe("unknown");
  });
  it("normalizes email casing without sharing the target's budget across requesters", async () => {
    vi.resetModules();
    const { allowLoginAttempt } = await import("@/lib/os-login-limits");
    for (let i = 0; i < 5; i++) expect(allowLoginAttempt("203.0.113.1", " Owner@Example.COM ")).toBe(true);
    expect(allowLoginAttempt("203.0.113.1", "owner@example.com")).toBe(false);
    expect(allowLoginAttempt("203.0.113.2", "owner@example.com")).toBe(true);
  });
});
