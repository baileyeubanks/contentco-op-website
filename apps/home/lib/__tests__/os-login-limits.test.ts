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
  it("normalizes email casing and retains the tighter per-requester cap", async () => {
    vi.resetModules();
    const { allowLoginAttempt } = await import("@/lib/os-login-limits");
    for (let i = 0; i < 5; i++) expect(allowLoginAttempt("203.0.113.1", " Owner@Example.COM ")).toBe(true);
    expect(allowLoginAttempt("203.0.113.1", "owner@example.com")).toBe(false);
    expect(allowLoginAttempt("203.0.113.2", "owner@example.com")).toBe(true);
  });
  it("does not evict an active target cap under memory pressure and still admits a known device", async () => {
    vi.resetModules();
    vi.useFakeTimers();
    const { allowLoginAttempt } = await import("@/lib/os-login-limits");
    for (let i = 0; i < 30; i++) expect(allowLoginAttempt(`192.0.2.${i}`, "target@example.com")).toBe(true);
    for (let i = 0; i < 10_010; i++) {
      allowLoginAttempt(`2001:db8:${i.toString(16)}::1`, `spray${i}@example.com`);
    }
    expect(allowLoginAttempt("198.51.100.1", "target@example.com")).toBe(false);
    expect(allowLoginAttempt("2001:db9::1", "target@example.com", true)).toBe(true);
    await vi.advanceTimersByTimeAsync(15 * 60_000);
    expect(allowLoginAttempt("198.51.100.1", "target@example.com")).toBe(true);
  });

});
