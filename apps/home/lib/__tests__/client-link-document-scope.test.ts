import { beforeEach, it, expect, vi } from "vitest";
import { createFakeSupabase } from "./helpers/fake-supabase";
const mocks=vi.hoisted(()=>({db:vi.fn(),pdf:vi.fn()}));vi.mock("@/lib/supabase",()=>({getSupabase:mocks.db}));
vi.mock("@/lib/os-document-artifacts",()=>({renderDocumentPdfBuffer:mocks.pdf}));
import { renderClientDocumentPdf } from "@/lib/client-document";
import { renderQuoteHtml, renderInvoiceHtml } from "@/lib/os-document-renderer";
const id="00000000-0000-4000-8000-0000000000a1";
let fake:ReturnType<typeof createFakeSupabase>,calls:{table:string;op:string;args:unknown[]}[];
beforeEach(()=>{mocks.pdf.mockClear();mocks.pdf.mockResolvedValue(Buffer.from("synthetic"));calls=[];fake=createFakeSupabase();const from=fake.client.from.bind(fake.client);mocks.db.mockReturnValue({from:(table:string)=>{const q=from(table);for(const op of ["select","eq"] as const){const fn=q[op].bind(q) as (...args:any[])=>any;vi.spyOn(q,op).mockImplementation((...args:any[])=>{calls.push({table,op,args});return fn(...args);});}return q;}});});
for(const [render,table] of [[renderQuoteHtml,"quotes"],[renderInvoiceHtml,"invoices"]] as const){
 it.each(["ACS",null])(`${table} strict public renderer rejects %s rather than coercing`,async unit=>{
  fake.store.set(table,[{id,business_unit:unit}]);await expect(render(id,{businessUnit:"CC"})).rejects.toThrow("not_found");
 });
 it(`${table} strict renderer uses CC filter, explicit columns and text/service@ branding`,async()=>{
  fake.store.set(table,[{id,business_unit:"CC",line_items:[],created_at:"2026-10-08",client_name:"Synthetic",total:50}]);
  const html=await render(id,{businessUnit:"CC"});expect(html).toContain("Content Co-op");expect(html).toContain("service@contentco-op.com");expect(html).not.toMatch(/<img|Astro Cleaning/i);
  expect(calls).toContainEqual({table,op:"eq",args:["business_unit","CC"]});expect(calls.filter(c=>c.op==="select").some(c=>c.args[0]==="*")).toBe(false);
 });
}

for(const [typ,table] of [["quote","quotes"],["invoice","invoices"]] as const){
 it.each(["ACS",null])(`${table} PDF loader rejects %s before rendering`,async unit=>{fake.store.set(table,[{id,business_unit:unit}]);await expect(renderClientDocumentPdf(typ,id)).rejects.toThrow("not_found");expect(mocks.pdf).not.toHaveBeenCalled();});
 it(`${table} PDF loader scopes every live read and maps only document fields`,async()=>{
  fake.store.set(table,[{id,business_unit:"CC",line_items:[],created_at:"2026-10-08",client_name:"Synthetic",total:50,contact_email:"PRIVATE",internal_status:"PRIVATE"}]);await renderClientDocumentPdf(typ,id);
  expect(calls).toContainEqual({table,op:"eq",args:["business_unit","CC"]});expect(calls.filter(c=>c.op==="select").some(c=>c.args[0]==="*")).toBe(false);expect(JSON.stringify(mocks.pdf.mock.calls)).not.toMatch(/PRIVATE|contact_email|internal_status/);
 });
}
