import { it, expect } from "vitest";
import { clientLinkClientKey } from "@/lib/client-link-rate-limit";
it.each([
 [{"x-forwarded-for":"192.0.2.5"},"unknown"],
 [{"cf-connecting-ip":"192.0.2.5"},"unknown"],
 [{"cf-ray":"bad","cf-connecting-ip":"192.0.2.5"},"unknown"],
 [{"cf-ray":"0123456789abcdef-DFW","cf-connecting-ip":"bad"},"unknown"],
 [{"cf-ray":"0123456789abcdef-DFW","cf-connecting-ip":"192.0.2.5"},"192.0.2.5"],
 [{"cf-ray":"0123456789abcdef-DFW","cf-connecting-ip":"2001:db8::1"},"2001:db8::1"],
])("trusted CF client key #%#",(values,expected)=>expect(clientLinkClientKey(new Headers(values as Record<string,string>))).toBe(expected));
