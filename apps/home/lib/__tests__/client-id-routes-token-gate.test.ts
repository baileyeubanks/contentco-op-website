import { beforeEach, afterEach, it, expect, vi, describe } from "vitest";
import { signClientLink, verifyClientLink } from "@/lib/client-link-token";
import { generatePortalToken } from "@/lib/portal-token";
import { createFakeSupabase, type FakeSupabase } from "./helpers/fake-supabase";
const mocks=vi.hoisted(()=>({db:vi.fn(),stripe:vi.fn(),create:vi.fn(),retrieve:vi.fn(),render:vi.fn(),pdf:vi.fn(),policy:vi.fn(),heads:vi.fn(),mint:vi.fn()}));
let fake: FakeSupabase;
let queryCalls: {table:string;op:string;args:unknown[]}[]=[];
vi.mock("@/lib/supabase",()=>({getSupabase:mocks.db}));
vi.mock("next/navigation",()=>({notFound:()=>{throw new Error("NOT_FOUND");}}));
vi.mock("next/headers",()=>({headers:mocks.heads}));
vi.mock("@/lib/stripe",()=>({getStripe:mocks.stripe,isStripeConfigured:()=>true,createInvoicePaymentLink:mocks.create}));
vi.mock("@/lib/platform-access",()=>({createRoutePolicy:(p:unknown)=>p,enforceRoutePolicy:mocks.policy}));
vi.mock("@/lib/os-request-scope",()=>({getRootBusinessScopeFromRequest:()=>null}));
vi.mock("@/lib/os-document-renderer",()=>({renderQuoteHtml:mocks.render,renderInvoiceHtml:mocks.render}));
vi.mock("@/lib/os-document-authority",()=>({readCanonicalQuotePdf:mocks.pdf,readCanonicalInvoicePdf:mocks.pdf}));
vi.mock("@/lib/os-document-artifacts",()=>({renderDocumentPdfBuffer:mocks.pdf}));
vi.mock("@/lib/os-event-log",()=>({emitTypedEvent:vi.fn()}));
vi.mock("@/lib/os-commercial-pipeline",()=>({convertEstimateToDepositInvoice:async()=>({invoice:{id:B,amount_due_cents:5000}}),applyInvoicePayment:async()=>({invoice:{payment_status:"paid",amount_due_cents:5000},workflow:{}})}));
vi.mock("@/lib/os-estimate-versions",()=>({resolveFrozenDepositAmountCents:async()=>({amountCents:5000,estimateId:B,estimateVersionId:B,error:null}),buildEstimateVersionArtifactPayload:()=>({})}));
vi.mock("@/app/client/quote/[id]/quote-client-view",()=>({QuoteClientView:()=>null}));
vi.mock("@/app/share/quote/[id]/quote-share-client",()=>({QuoteShareClient:()=>null}));
vi.mock("@/app/client/[token]/client-portal",()=>({ClientPortal:()=>null}));
const A="00000000-0000-4000-8000-0000000000a1", B="00000000-0000-4000-8000-0000000000b2";
let serial=0;
let requestHeaders: Headers;
const importModule=(specifier:string):Promise<Record<string,any>>=>import(specifier);
const json404='{"error":"not_found"}';
beforeEach(()=>{
 vi.clearAllMocks(); fake=createFakeSupabase(); queryCalls=[];
 const from=fake.client.from.bind(fake.client);
 vi.spyOn(fake.client,"from").mockImplementation(table=>{const q=from(table);const eq=q.eq.bind(q);vi.spyOn(q,"eq").mockImplementation((...args)=>{queryCalls.push({table,op:"eq",args});return eq(...args);});return q;});
 mocks.db.mockImplementation(()=>fake.client);
 requestHeaders=new Headers({"cf-ray":"0123456789abcdef-DFW","cf-connecting-ip":`192.0.2.${++serial%250+1}`}); mocks.heads.mockResolvedValue(requestHeaders);
 mocks.policy.mockResolvedValue({ok:false,response:new Response("unauthorized",{status:401})});
 mocks.stripe.mockReturnValue({paymentIntents:{create:mocks.create,retrieve:mocks.retrieve}});
 mocks.create.mockResolvedValue({client_secret:"synthetic",url:"https://checkout.stripe.test/synthetic"});
 mocks.retrieve.mockResolvedValue({status:"succeeded",amount:5000,metadata:{quote_id:A,invoice_id:B,estimate_id:B,business_unit:"CC"}});
 mocks.render.mockResolvedValue("<p>Synthetic document</p>"); mocks.pdf.mockResolvedValue(new Uint8Array([1,2,3]));
 fake.store.set("quotes",[{id:A,business_unit:"CC",quote_number:"CC-TEST",client_name:"Synthetic",client_status:"sent",created_at:new Date().toISOString(),deposit_status:"pending",agreement_accepted:true}]);
 fake.store.set("invoices",[{id:A,business_unit:"CC",invoice_number:"CC-TEST",total:50,payment_status:"unpaid"},{id:B,business_unit:"CC",amount_due_cents:5000}]);
 fake.store.set("estimates",[{id:B,business_unit:"CC",legacy_quote_id:A}]);
});
afterEach(()=>vi.restoreAllMocks());
const apiCases=[
 ["share/quote/[id]/accept","POST","quote",200,["ok","action","accepted_at","signer"]],
 ["share/quote/[id]/comment","GET","quote",200,["comments"]],
 ["share/quote/[id]/comment","POST","quote",201,["ok","comment"]],
 ["share/quote/[id]/view","POST","quote",200,["ok","viewed"]],
 ["client/quote/[id]/pay","POST","quote",200,["clientSecret","invoice_id","estimate_id","estimate_version_id","amount_cents"]],
 ["client/quote/[id]/pay/confirm","POST","quote",200,["ok","invoice_id","workflow_status","readiness_status","amount_cents"]],
 ["os/quotes/[id]/preview","GET","quote",200,null],
 ["os/quotes/[id]/pdf","GET","quote",200,null],
 ["os/invoices/[id]/preview","GET","invoice",200,null],
 ["os/invoices/[id]/pdf","GET","invoice",200,null],
 ["os/invoices/[id]/pay-link","POST","invoice",201,["url","cached"]],
] as const;
for(const [route,method,typ,status,keys] of apiCases) {
 describe(`${method} /api/${route}`,()=>{
  async function call(token?: string|null) {
   const mod=await importModule(`../../app/api/${route}/route.ts`); const heads=new Headers(requestHeaders); heads.set("content-type","application/json"); if(token) heads.set("x-client-link",token);
   return mod[method](new Request(`https://contentco-op.com/api/${route.replace("[id]",A)}`,{method,headers:heads,...(method==="POST"?{body:JSON.stringify({action:"accept",message:"synthetic",payment_intent_id:"pi_synthetic"})}:{})}),{params:Promise.resolve({id:A})});
  }
  it.each(["absent","tampered","expired","wrong-type"])("%s capability: identical 404 and zero DB/Stripe",async scenario=>{
   const t=signClientLink(typ,A)!;
   const token=scenario==="absent"?null:scenario==="tampered"?t+"x":scenario==="expired"?signClientLink(typ,A,{ttl:60,now:Date.now()-120000}):signClientLink(typ==="quote"?"invoice":"quote",A);
   const res=await call(token); expect(res.status).toBe(404); expect(await res.text()).toBe(json404); expect(res.headers.get("cache-control")).toBe("no-store"); expect(mocks.db).not.toHaveBeenCalled(); expect(mocks.stripe).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.retrieve).not.toHaveBeenCalled();
  });
  it.each(["missing","ACS",null])("valid capability with %s unit/row: byte-identical 404, no downstream effects",async unit=>{
   fake.store.set(typ==="quote"?"quotes":"invoices",unit==="missing"?[]:[{id:A,business_unit:unit}]);
   const res=await call(signClientLink(typ,A)); expect(res.status).toBe(404); expect(await res.text()).toBe(json404); expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.retrieve).not.toHaveBeenCalled(); expect(mocks.render).not.toHaveBeenCalled(); expect(mocks.pdf).not.toHaveBeenCalled();
  });
  it("valid CC capability succeeds with only allowed output fields and scoped query",async()=>{
   const res=await call(signClientLink(typ,A)); expect(res.status).toBe(status);
   if(keys) expect(Object.keys(await res.json()).sort()).toEqual([...keys].sort());
   expect(queryCalls.some(c=>c.table===(typ==="quote"?"quotes":"invoices")&&c.op==="eq"&&c.args[0]==="business_unit"&&c.args[1]==="CC")).toBe(true);
  });
 });
}
for(const [route,typ] of [["client/quote/[id]","quote"],["share/quote/[id]","quote"],["share/invoice/[id]","invoice"]] as const) {
 describe(`page /${route}`,()=>{
  async function call(t?:string|null) {const m=await importModule(`../../app/${route}/page.tsx`); return m.default({params:Promise.resolve({id:A}),searchParams:Promise.resolve({t})});}
  it.each(["absent","tampered","expired","wrong-type"])("%s capability: notFound before DB",async s=>{
   const t=s==="absent"?null:s==="tampered"?"cl1.bad":s==="expired"?signClientLink(typ,A,{ttl:60,now:Date.now()-120000}):signClientLink(typ==="quote"?"invoice":"quote",A);
   await expect(call(t)).rejects.toThrow("NOT_FOUND"); expect(mocks.db).not.toHaveBeenCalled();
  });
  it.each(["missing","ACS",null])("valid capability with %s row: notFound",async unit=>{
   fake.store.set(typ==="quote"?"quotes":"invoices",unit==="missing"?[]:[{id:A,business_unit:unit}]); await expect(call(signClientLink(typ,A))).rejects.toThrow("NOT_FOUND");
  });
  it("valid capability renders and preserves supplied token without minting",async()=>{
   const token=signClientLink(typ,A)!;
   const l=await import("@/lib/client-link-token"); const mint=vi.spyOn(l,"signClientLink");
   const result=await call(token); expect(result).toBeTruthy(); expect(mint).not.toHaveBeenCalled();
   if(typ==="quote") expect(result.props.acceptToken).toBe(token);
   expect(queryCalls.some(c=>c.op==="eq"&&c.args[0]==="business_unit"&&c.args[1]==="CC")).toBe(true);
  });
 });
}
it("quote pay N+1 request returns 429 with zero Stripe or DB calls",async()=>{
 const {POST}=await import("@/app/api/client/quote/[id]/pay/route"); const {CLIENT_LINK_LIMIT}=await import("@/lib/client-link-rate-limit");
 const req=()=>new Request(`https://contentco-op.com/api/client/quote/${A}/pay`,{method:"POST",headers:requestHeaders});
 for(let i=0;i<CLIENT_LINK_LIMIT;i++) expect((await POST(req(),{params:Promise.resolve({id:A})})).status).toBe(404);
 vi.clearAllMocks(); const res=await POST(req(),{params:Promise.resolve({id:A})}); expect(res.status).toBe(429); expect(mocks.stripe).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.db).not.toHaveBeenCalled();
});
for(const [route,method] of [["client/[token]","GET"],["client/[token]/messages","GET"],["client/[token]/messages","POST"]] as const) {
 describe(`${method} /api/${route} portal minimum`,()=>{
  async function call(token:string) {const mod=await importModule(`../../app/api/${route}/route.ts`);return mod[method](new Request("https://contentco-op.com/api/client/synthetic",{method,headers:requestHeaders,...(method==="POST"?{body:JSON.stringify({message:"synthetic"})}:{})}),{params:Promise.resolve({token})});}
  it.each(["", "0123456789abcdef", "0123456789abcdefghijklmnopqrstu", "a".repeat(40), "ab".repeat(20),"012345678".repeat(5),"!"])("rejects weak input #%# before DB",async token=>{const r=await call(token);expect(r.status).toBe(404);expect(await r.text()).toBe(json404);expect(mocks.db).not.toHaveBeenCalled();});
  it.each(["missing","ACS",null])("%s contact returns identical 404",async unit=>{const token=generatePortalToken();fake.store.set("contacts",unit==="missing"?[]:[{id:B,portal_token:token,business_unit:unit}]); const r=await call(token);expect(r.status).toBe(404);expect(await r.text()).toBe(json404);});
  it("CC contact returns allowed data and only typed signed share URLs",async()=>{
   const token=generatePortalToken();fake.store.set("contacts",[{id:B,portal_token:token,business_unit:"CC",full_name:"Synthetic"}]);
   for(const table of ["quotes","invoices"]) for(const row of fake.store.get(table)??[]) row.contact_id=B;
   const r=await call(token);expect([200,201]).toContain(r.status);const body=await r.json();
   if(route==="client/[token]") {
    expect(Object.keys(body).sort()).toEqual(["contact","invoices","payments","quotes"]);
    expect(Object.keys(body.contact)).toEqual(["name","company"]);
    for(const [rows,typ] of [[body.quotes,"quote"],[body.invoices,"invoice"]] as const) for(const row of rows) {expect(row).not.toHaveProperty("stripe_payment_link");const u=new URL(row.share_url);expect(verifyClientLink(u.searchParams.get("t"),typ,row.id)).toBe(true);}
   }
   expect(queryCalls.some(c=>c.table==="contacts"&&c.op==="eq"&&c.args[0]==="business_unit"&&c.args[1]==="CC")).toBe(true);
  });
 });
}
describe("portal page",()=>{
 it.each(["", "0123456789abcdef","a".repeat(40)])("rejects weak input #%# before DB",async token=>{const mod=await import("@/app/client/[token]/page");await expect(mod.default({params:Promise.resolve({token})})).rejects.toThrow("NOT_FOUND");expect(mocks.db).not.toHaveBeenCalled();});
 it.each(["ACS",null])("rejects %s contact",async unit=>{const token=generatePortalToken();fake.store.set("contacts",[{id:B,portal_token:token,business_unit:unit}]);const mod=await import("@/app/client/[token]/page");await expect(mod.default({params:Promise.resolve({token})})).rejects.toThrow("NOT_FOUND");});
 it("renders CC contact name only",async()=>{const token=generatePortalToken();fake.store.set("contacts",[{id:B,portal_token:token,business_unit:"CC",full_name:"Synthetic"}]);const mod=await import("@/app/client/[token]/page");const result=await mod.default({params:Promise.resolve({token})});expect(result.props.contactName).toBe("Synthetic");});
});
