import { beforeEach, it, expect, vi } from "vitest";
import { createFakeSupabase } from "./helpers/fake-supabase";
import { verifyClientLink } from "@/lib/client-link-token";
const mocks=vi.hoisted(()=>({db:vi.fn(),policy:vi.fn()}));
vi.mock("@/lib/supabase",()=>({getSupabase:mocks.db}));
vi.mock("@/lib/platform-access",()=>({createRoutePolicy:(p:unknown)=>p,enforceRoutePolicy:mocks.policy}));
import { POST as quotePOST } from "@/app/api/os/quotes/[id]/share-link/route";
import { POST as invoicePOST } from "@/app/api/os/invoices/[id]/share-link/route";
const id="00000000-0000-4000-8000-0000000000a1";
beforeEach(()=>{vi.clearAllMocks();mocks.policy.mockResolvedValue({ok:true});});
for(const [post,table,typ] of [[quotePOST,"quotes","quote"],[invoicePOST,"invoices","invoice"]] as const) {
 it(`${typ} issuance checks operator before any DB access`,async()=>{
  mocks.policy.mockResolvedValue({ok:false,response:new Response(null,{status:401})});
  const res=await post(new Request("https://admin.contentco-op.com/action",{method:"POST"}),{params:Promise.resolve({id})});expect(res.status).toBe(401);expect(mocks.db).not.toHaveBeenCalled();
 });
 it.each(["missing","ACS",null])(`${typ} %s row never issues a link`,async unit=>{
  mocks.db.mockReturnValue(createFakeSupabase({[table]:unit==="missing"?[]:[{id,business_unit:unit}]}).client);
  const res=await post(new Request("https://admin.contentco-op.com/action",{method:"POST"}),{params:Promise.resolve({id})});expect(res.status).toBe(404);expect(await res.text()).toBe('{"error":"not_found"}');
 });
 it(`${typ} operator action issues a verifiable 30-day CC link`,async()=>{
  mocks.db.mockReturnValue(createFakeSupabase({[table]:[{id,business_unit:"CC"}]}).client);
  const res=await post(new Request("https://admin.contentco-op.com/action",{method:"POST"}),{params:Promise.resolve({id})});expect(res.status).toBe(200);
  const body=await res.json();expect(Object.keys(body)).toEqual(["share_link_url"]);const url=new URL(body.share_link_url);expect(url.origin).toBe("https://contentco-op.com");expect(verifyClientLink(url.searchParams.get("t"),typ,id)).toBe(true);
 });
}
