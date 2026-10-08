import { it, expect } from "vitest";
import { isAcceptablePortalToken, generatePortalToken } from "@/lib/portal-token";
it.each(["", "0123456789abcde", "0123456789abcdef", "0123456789abcdefghijklmnopqrstu", "a".repeat(40),"ab".repeat(20),"012345678".repeat(5),"0123456789abcdefghijklmnopqrstuvwxyz!", "x".repeat(129)])("rejects weak portal input #%#", t => expect(isAcceptablePortalToken(t)).toBe(false));
it("rejects a dominant character even with enough distinct characters",()=>expect(isAcceptablePortalToken("a".repeat(30)+"bcdefghijklmnop")).toBe(false));
it("generator has 43 URL-safe chars and 1000 distinct acceptable samples",()=>{
 const samples=Array.from({length:1000},()=>generatePortalToken()); expect(new Set(samples).size).toBe(1000);
 for(const s of samples) { expect(s).toMatch(/^[A-Za-z0-9_-]{43}$/); expect(isAcceptablePortalToken(s)).toBe(true); }
});
