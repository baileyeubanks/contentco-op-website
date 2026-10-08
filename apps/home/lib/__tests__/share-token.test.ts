import { it, expect } from "vitest";
import { signClientLink, verifyClientLink } from "../share-token";
const id="00000000-0000-4000-8000-0000000000a1";
it("compatibility module exposes only typed signing and rejects the retired format",()=>{
 expect(verifyClientLink(`${id}.9999999999.deadbeef`,"quote",id)).toBe(false);
 const token=signClientLink("quote",id);expect(verifyClientLink(token,"quote",id)).toBe(true);
});
