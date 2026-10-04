import { describe, expect, test, vi } from "vitest";
const getSupabaseMock = vi.hoisted(() => vi.fn());
vi.mock("../supabase", () => ({ getSupabase: getSupabaseMock }));

import { getBriefNotificationStatus, getRootMarketingBriefDetail } from "../os-marketing";

function database(result: unknown, rejects = false) {
  const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockImplementation(() => rejects ? Promise.reject(new Error("private database error")) : Promise.resolve(result));
  return { db: { from: vi.fn(() => query) }, query };
}
const notice = (audience: string, status: string, receipt?: string) => ({
  business_unit: "CC", channel: "email", related_entity_type: "creative_brief", related_entity_id: "canonical-id",
  audience, status, template_key: audience === "internal" ? "cco_public_brief_admin_alert" : "cco_public_brief_client_receipt",
  provider_message_id: receipt, secret_other_field: "must not escape",
});
describe("durable brief notification status", () => {
  test("binds read to canonical brief and templates, returns safe status only", async () => {
    const { db, query } = database({ data: [notice("internal", "failed"), notice("client", "sent", "provider-id")], error: null });
    const result = await getBriefNotificationStatus(db as never, "canonical-id");
    expect(query.eq.mock.calls).toEqual([["related_entity_type", "creative_brief"], ["related_entity_id", "canonical-id"], ["business_unit", "CC"], ["channel", "email"]]);
    expect(query.select).toHaveBeenCalledWith("template_key, audience, status, business_unit, channel, related_entity_type, related_entity_id, provider_message_id:metadata->provider_message_id");
    expect(query.in).toHaveBeenCalledWith("template_key", ["cco_public_brief_admin_alert", "cco_public_brief_client_receipt"]);
    expect(result).toEqual([{ audience: "internal", status: "failed", providerReceiptPresent: false }, { audience: "client", status: "sent", providerReceiptPresent: true }]);
    expect(JSON.stringify(result)).not.toMatch(/provider-id|secret/);
  });
  test.each([ {data: [],error:null}, {data:null,error:{message:"secret"}}, {data:[notice("client","sent")],error:null} ])("missing evidence and database errors are unknown", async (input) => {
    const {db}=database(input);
    expect((await getBriefNotificationStatus(db as never,"id")).every((n)=>n.status === "unknown")).toBe(true);
  });
  test("exception, duplicates, sending and mismatched audience cannot claim sent", async () => {
    const rejected=database(null,true);
    expect((await getBriefNotificationStatus(rejected.db as never,"id")).every((n)=>n.status === "unknown")).toBe(true);
    const {db}=database({data:[notice("internal","sent","a"),notice("internal","sent","b"),{...notice("client","sent","c"),audience:"internal"}],error:null});
    expect((await getBriefNotificationStatus(db as never,"id")).every((n)=>n.status === "unknown")).toBe(true);
  });
});


test.each([{business_unit:"ACS"},{channel:"sms"},{related_entity_type:"invoice"},{related_entity_id:"other-brief"}])("ignored SQL filters cannot expose cross-boundary row %j", async (wrongBinding) => {
  const {db}=database({data:[{...notice("internal","sent","receipt"),...wrongBinding}],error:null});
  expect(await getBriefNotificationStatus(db as never,"canonical-id")).toEqual([
    {audience:"internal",status:"unknown",providerReceiptPresent:false},
    {audience:"client",status:"unknown",providerReceiptPresent:false},
  ]);
});


test.each([{id:"canonical-id",company_account_id:"other-company"},{id:"other-id",company_account_id:"content-co-op"}])("enclosing service-role detail refuses cross-company/id row %j before child reads", async (row) => {
  const query={select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn(async()=>({data:row,error:null}))};
  query.select.mockReturnValue(query);query.eq.mockReturnValue(query);
  const db={from:vi.fn(()=>query)};getSupabaseMock.mockReturnValue(db);
  expect(await getRootMarketingBriefDetail("cc","canonical-id")).toBeNull();
  expect(query.eq.mock.calls).toEqual([["id","canonical-id"],["company_account_id","content-co-op"]]);
  expect(db.from).toHaveBeenCalledTimes(1);
});


test.each([42, {}, [], "   "])("nonstring/blank JSON provider receipt %j cannot claim sent", async (provider_message_id) => {
  const {db}=database({data:[{...notice("internal","sent"),provider_message_id}],error:null});
  expect((await getBriefNotificationStatus(db as never,"canonical-id"))[0]).toEqual({audience:"internal",status:"unknown",providerReceiptPresent:false});
});
test("failed with an accepted provider receipt is conflicting evidence, not safely failed", async () => {
  const {db}=database({data:[notice("internal","failed","accepted-id")],error:null});
  expect((await getBriefNotificationStatus(db as never,"canonical-id"))[0]).toEqual({audience:"internal",status:"unknown",providerReceiptPresent:true});
});
