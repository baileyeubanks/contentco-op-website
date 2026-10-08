import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes, createHmac } from "node:crypto";
const A = "00000000-0000-4000-8000-0000000000a1";
const B = "00000000-0000-4000-8000-0000000000b2";
const now = 1791432000000;
let dir: string, file: string, key: string, oldKey: string;
beforeEach(() => {
 vi.resetModules(); dir = mkdtempSync(join(tmpdir(), "cco-token-unit-")); file = join(dir,"key");
 key = randomBytes(32).toString("hex"); oldKey = randomBytes(32).toString("hex");
 writeFileSync(file, `t1 ${key}\nt0 ${oldKey}\n`, {mode:0o600});
 vi.stubEnv("CCO_CLIENT_LINK_KEY_FILE",file);
});
afterEach(() => { vi.doUnmock("node:fs"); vi.unstubAllEnvs(); rmSync(dir,{recursive:true,force:true}); });
async function lib() { return import("@/lib/client-link-token"); }
function raw(typ: string, exp: number, kid="t1", k=key, id=A) {
 const sig=createHmac("sha256",Buffer.from(k,"hex")).update(`cco-client-link:v1\n${kid}\n${typ}\n${id}\n${exp}`).digest("base64url");
 return `cl1.${kid}.${typ}.${exp}.${sig}`;
}
describe("CCO typed client capabilities", () => {
 it.each(["quote","estimate","invoice","portal-row"] as const)("round trips %s, canonical wire format, ID and type bound", async typ => {
  const l=await lib(); const token=l.signClientLink(typ,A,{now});
  expect(token?.split(".")[0]).toBe("cl1"); expect(token?.split(".")[1]).toBe("t1");
  expect(l.verifyClientLink(token,typ,A,now)).toBe(true);
  expect(l.verifyClientLink(token,typ,B,now)).toBe(false);
  for(const other of ["quote","estimate","invoice","portal-row"] as const) if(other!==typ) expect(l.verifyClientLink(token,other,A,now)).toBe(false);
 });
 it("MAC includes the wire type and specified domain separator", async () => {
  const l=await lib(); expect(l.signClientLink("quote",A,{now,ttl:60})).toBe(raw("q",now/1000+60));
 });
 it("rejects altered fields, noncanonical encoding, malformed tokens and ids", async () => {
  const l=await lib(); const t=l.signClientLink("quote",A,{now,ttl:60})!;
  const parts=t.split("."); const sig=parts[4];
  const altered=[t+"=", t+".extra",t.slice(4), t.replace(".q.",".i."),t.replace(".t1.",".t9."),t.replace(parts[3],String(Number(parts[3])+1)), t.slice(0,-43)+(sig[0]==="A"?"B":"A")+sig.slice(1), "x".repeat(129), t.replace(parts[3],"0"+parts[3])];
  // The low two bits of the last encoded byte must be zero (canonical base64url).
  const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  altered.push(t.slice(0,-1)+alphabet[alphabet.indexOf(t.at(-1)!)+1]);
  for(const bad of altered) expect(l.verifyClientLink(bad,"quote",A,now)).toBe(false);
  expect(l.verifyClientLink(t,"quote","not-a-uuid",now)).toBe(false);
  expect(l.verifyClientLink(t,"quote",A.toUpperCase(),now)).toBe(false);
 });
 it("rejects expiry boundary and excessive TTL even with a valid MAC", async () => {
  const l=await lib(); const s=now/1000;
  for(const exp of [s-1,s,s+l.MAX_TTL+1]) expect(l.verifyClientLink(raw("q",exp),"quote",A,now)).toBe(false);
  expect(l.signClientLink("quote",A,{now,ttl:l.MAX_TTL+1})).toBeNull();
  expect(l.signClientLink("quote",A,{now,ttl:0})).toBeNull();
 });
 it("verifies rotation key but signs only first line", async () => {
  const l=await lib(); expect(l.verifyClientLink(raw("q",now/1000+60,"t0",oldKey),"quote",A,now)).toBe(true);
  expect(l.signClientLink("invoice",A,{now})?.split(".")[1]).toBe("t1");
 });
 it.each(["missing","mode","short","nonhex","duplicate","symlink"])("fails closed for %s key file", async scenario => {
  if(scenario==="missing") rmSync(file);
  if(scenario==="mode") chmodSync(file,0o644);
  if(scenario==="short") writeFileSync(file,"t1 12\n");
  if(scenario==="nonhex") writeFileSync(file,"t1 "+"z".repeat(64)+"\n");
  if(scenario==="duplicate") writeFileSync(file,`t1 ${key}\nt1 ${oldKey}\n`);
  if(scenario==="symlink") {const fs=await import("node:fs"); fs.renameSync(file,file+"-real"); fs.symlinkSync(file+"-real",file);}
  const l=await lib(); expect(l.signClientLink("quote",A,{now})).toBeNull();
  expect(l.verifyClientLink(raw("q",now/1000+60),"quote",A,now)).toBe(false);
  expect(l.clientLinkKeyStatus()).toMatch(/^client_link_key_file_/);
 });
 it("does not use the retired environment key", async () => {
  vi.stubEnv("CCO_CLIENT_LINK_KEY_FILE",""); vi.stubEnv("QUOTE_SHARE_SECRET",randomBytes(32).toString("hex"));
  const l=await lib(); expect(l.signClientLink("quote",A,{now})).toBeNull(); expect(l.verifyClientLink(raw("q",now/1000+60),"quote",A,now)).toBe(false);
 });
 it("builds typed signed URLs only, failing closed", async () => {
  const l=await lib(); const url=l.buildClientLinkUrl("invoice",A,{now,origin:"https://contentco-op.com",ttl:604800});
  expect(url).toBeTruthy(); const u=new URL(url!); expect(u.pathname).toBe(`/share/invoice/${A}`);
  expect(l.verifyClientLink(u.searchParams.get("t"),"invoice",A,now)).toBe(true);
  expect(l.buildClientLinkUrl("quote","bad",{now})).toBeNull();
 });
 it("uses constant-time bytes, path-only configuration and owner validation", () => {
  const source=readFileSync(join(process.cwd(),"lib/client-link-token.ts"),"utf8");
  expect(source).toMatch(/timingSafeEqual\(a, b\)/); expect(source).toContain("getuid");
  expect(source).not.toMatch(/process\.env\.(?!CCO_CLIENT_LINK_KEY_FILE)[A-Z_]*(?:KEY|SECRET)/);
 });
});

it("rejects key owned by another uid",async()=>{
 const fs=await import("node:fs");
 vi.doMock("node:fs",()=>({...fs,fstatSync:(fd:number)=>({...fs.fstatSync(fd),isFile:()=>true,uid:process.getuid!()+1})}));
 const l=await lib();expect(l.signClientLink("quote",A,{now})).toBeNull();expect(l.clientLinkKeyStatus()).toBe("client_link_key_file_insecure");
});

it("rejection telemetry contains a fixed reason, route pattern and hash only",async()=>{
 const l=await lib();const warn=vi.spyOn(console,"warn").mockImplementation(()=>{});
 try {l.recordClientLinkRejected("/share/quote/[id]",A);const log=String(warn.mock.calls[0][0]);expect(log).toMatch(/^client_link_rejected reason=invalid_or_unavailable route=\/share\/quote\/\[id\] idhash=[a-f0-9]{8}$/);expect(log).not.toContain(A);expect(log).not.toContain("cl1.");} finally {warn.mockRestore();}
});
