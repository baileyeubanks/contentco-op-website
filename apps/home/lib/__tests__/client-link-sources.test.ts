import { it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
function files(dir:string):string[] {return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.name==="__tests__"?[]:e.isDirectory()?files(join(dir,e.name)):/\.(ts|tsx|mjs)$/.test(e.name)?[join(dir,e.name)]:[]);}
it("all public routes are inventoried, checked and rate limited",()=>{
 const allow:Record<string,string>={
  "app/client/portal/page.tsx":"D1 hotfix: unconditional notFound, no token mode.",
  "app/api/client/quote/[id]/accept/route.ts":"Legacy operator-only quote_manage policy; no public capability.",
  "app/api/client/invoice/[id]/pay/route.ts":"X2: returns 404 via hotfix #18 / SF5 main port; re-verified after the rebase onto SF5",
  "app/share/payment-received/page.tsx":"Static no-data Stripe success acknowledgement.",
 };
 const routes=["app/client","app/share","app/api/client","app/api/share"].flatMap(files).filter(f=>/\/(route\.ts|page\.tsx)$/.test(f));
 for(const file of routes) {const source=readFileSync(file,"utf8");if(allow[file]) {expect(allow[file].length).toBeGreaterThan(10);continue;}
  expect(source, file).toMatch(/verifyClientLink|isAcceptablePortalToken/);
  expect(source,file).toMatch(/clientLinkRateLimit|clientLinkPageAllowed/);
  expect(source,file).not.toMatch(/\.select\(\s*["']\*["']/);
 }
});
it.each(["app/api/client/quote/[id]/route.ts","app/api/client/estimate/[id]/route.ts","app/api/client/invoice/[id]/route.ts","app/api/client/invoice/[id]/pay/confirm/route.ts"])("removed surface stays absent: %s",file=>expect(existsSync(file)).toBe(false));
it("one builder owns share URLs; public renderers never issue tokens",()=>{
 for(const file of ["app","lib","scripts"].flatMap(files)) {
  if(file==="lib/client-link-token.ts"||file==="lib/runtime-config.ts") continue;
  const source=readFileSync(file,"utf8");expect(source,file).not.toMatch(/(?<!api)\/(?:share\/(?:quote|invoice)|client\/quote)\/\$\{/);
 }
 for(const file of ["app/client/quote/[id]/page.tsx","app/share/quote/[id]/page.tsx","app/share/invoice/[id]/page.tsx"]) expect(readFileSync(file,"utf8"),file).not.toMatch(/signClientLink|signShareToken|buildClientLinkUrl/);
 expect(readFileSync("lib/email-sender.ts","utf8")).toContain("buildClientLinkUrl");
 expect(readFileSync("lib/stripe.ts","utf8")).toContain("buildClientLinkUrl");
});

it("four CCO create paths default to CC",()=>{
 for(const file of ["app/os/invoices/new/page.tsx","app/api/os/invoices/route.ts","app/api/quotes/route.ts","app/api/quotes/[id]/convert/route.ts"]) {
  const source=readFileSync(file,"utf8");expect(source,file).not.toMatch(/(?:asString\([^\n]+|useState<BU>\()"ACS"/);
 }
});
it("deleted dashboard list stays absent",()=>expect(existsSync("app/dashboard/quotes/page.tsx")).toBe(false));
it("client and share public text uses Content Co-op and service@ only, with no logo images",()=>{
 for(const file of ["app/client/layout.tsx","app/client/quote/[id]/page.tsx","app/client/quote/[id]/quote-summary.tsx","app/client/quote/[id]/agreement-section.tsx","app/share/quote/[id]/page.tsx","app/share/quote/[id]/quote-share-client.tsx","app/share/invoice/[id]/page.tsx","app/client/portal/portal-view.tsx"]) {
  const source=readFileSync(file,"utf8");expect(source,file).not.toMatch(/Astro Cleaning|astrocleanings|tel:|<Image/i);
 }
});

it("public resource reads never default a missing business unit",()=>{
 for(const dir of ["app/client","app/share","app/api/client","app/api/share"]) for(const file of files(dir)) {
  if(file==="app/client/portal/page.tsx"||file==="app/api/client/invoice/[id]/pay/route.ts") continue;
  expect(readFileSync(file,"utf8"),file).not.toMatch(/business_unit\s*(?:\|\||\?\?)\s*["']CC["']/);
 }
 expect(readFileSync("lib/reminder-engine.ts","utf8")).not.toMatch(/business_unit\s*(?:\|\||\?\?)\s*["']CC["']/);
});
