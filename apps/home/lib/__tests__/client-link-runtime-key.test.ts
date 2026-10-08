import { it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
it("runtime verifier hashbang is first and node can parse it",()=>{
 const file=join(process.cwd(),"scripts/verify-runtime-env.mjs");expect(readFileSync(file,"utf8").startsWith("#!/usr/bin/env node\n")).toBe(true);
 expect(spawnSync(process.execPath,["--check",file]).status).toBe(0);
});
it("runtime key-file checks fail closed with reason codes only",()=>{
 const dir=mkdtempSync(join(tmpdir(),"cco-runtime-key-")),key=join(dir,"key");
 const clean:Record<string,string>={HOME:process.env.HOME!,PATH:process.env.PATH!,CO_PROD_BASE_URL:"http://127.0.0.1:1",CO_DEMO_BASE_URL:"http://127.0.0.1:1"};
 const run=(path:string)=>spawnSync(process.execPath,["scripts/verify-runtime-env.mjs"],{env:{...clean,NODE_ENV:"test",CCO_CLIENT_LINK_KEY_FILE:path},encoding:"utf8"});
 try {
  const absent=run(key);expect(absent.status).toBe(1);expect(absent.stderr.trim()).toBe("client_link_key_file_unreadable");
  writeFileSync(key,"t1 "+randomBytes(32).toString("hex")+"\n",{mode:0o600});chmodSync(key,0o644);
  const insecure=run(key);expect(insecure.status).toBe(1);expect(insecure.stderr.trim()).toBe("client_link_key_file_insecure");
  chmodSync(key,0o600);writeFileSync(key,"t1 invalid\n");const invalid=run(key);expect(invalid.status).toBe(1);expect(invalid.stderr.trim()).toBe("client_link_key_file_invalid");
 } finally {rmSync(dir,{recursive:true,force:true});}
});
