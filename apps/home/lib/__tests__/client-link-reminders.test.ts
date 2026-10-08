import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { createFakeSupabase } from "./helpers/fake-supabase";
const mocks=vi.hoisted(()=>({db:vi.fn(),send:vi.fn()}));
vi.mock("@/lib/supabase",()=>({getSupabase:mocks.db}));
vi.mock("@/lib/email-sender",()=>({sendInvoiceReminder:mocks.send}));
import { evaluateAndSendReminders } from "@/lib/reminder-engine";
const A="00000000-0000-4000-8000-0000000000a1";
const B="00000000-0000-4000-8000-0000000000b2";
const C="00000000-0000-4000-8000-0000000000c3";
let fake:ReturnType<typeof createFakeSupabase>,filters:unknown[][];
beforeEach(()=>{
 vi.clearAllMocks(); filters=[];
 fake=createFakeSupabase({invoices:["CC","ACS",null].map((unit,i)=>({id:[A,B,C][i],business_unit:unit,invoice_number:"SYNTHETIC",client_name:"Synthetic",client_email:"synthetic@example.test",total:50,balance_due:50,due_date:new Date().toISOString(),status:"issued",payment_status:"unpaid"}))});
 const from=fake.client.from.bind(fake.client);
 mocks.db.mockReturnValue({from:(table:string)=>{const q=from(table);const eq=q.eq.bind(q);vi.spyOn(q,"eq").mockImplementation((...args)=>{filters.push(args);return eq(...args);});return Object.assign(q,{not:(col:string,op:string,value:unknown)=>q.neq(col,value)});}});
 mocks.send.mockResolvedValue({ok:true});
});
afterEach(()=>vi.restoreAllMocks());
it("reminder job selects only CC and skips non-CC/null without any sends to them",async()=>{
 const result=await evaluateAndSendReminders();expect(result.sent).toBe(1);expect(mocks.send).toHaveBeenCalledTimes(1);
 expect(mocks.send.mock.calls[0][0].business_unit).toBe("CC");expect(filters).toContainEqual(["business_unit","CC"]);
 expect(fake.store.get("invoices")?.find(row=>row.id===B)).not.toHaveProperty("last_reminder_at");
 expect(fake.store.get("invoices")?.find(row=>row.id===C)).not.toHaveProperty("last_reminder_at");
});
it("defensive CC check skips even if the data layer supplies non-CC/null rows",async()=>{
 mocks.db.mockReturnValue({from:()=>{const result={data:fake.store.get("invoices"),error:null};const handler:ProxyHandler<object>={get:(_t,p)=>p==="then"?(resolve:(v:unknown)=>unknown)=>resolve(result):()=>new Proxy({},handler)};return new Proxy({},handler);}});
 const result=await evaluateAndSendReminders();expect(result.sent).toBe(1);expect(result.skipped).toBe(2);expect(mocks.send).toHaveBeenCalledTimes(1);
});
