import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { randomBytes } from "node:crypto";
const mocks=vi.hoisted(()=>({fetch:vi.fn(),spawn:vi.fn(),build:vi.fn()}));
vi.mock("node:fs",()=>({existsSync:()=>false}));
vi.mock("node:child_process",()=>({spawn:mocks.spawn}));
vi.mock("@/lib/client-link-token",()=>({buildClientLinkUrl:mocks.build}));
import { sendInvoiceReminder } from "@/lib/email-sender";
const invoice={id:"00000000-0000-4000-8000-0000000000a1",invoice_number:"SYNTHETIC",client_name:"Synthetic",client_email:"synthetic@example.test",total:50,balance_due:50,due_date:"2026-10-08",business_unit:"CC"};
beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal("fetch",mocks.fetch);mocks.build.mockReturnValue(null);});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it("missing signing key blocks reminder before provider or mailer",async()=>{
 const result=await sendInvoiceReminder(invoice,"due");expect(result).toEqual({ok:false,error:"client_link_unavailable"});expect(mocks.fetch).not.toHaveBeenCalled();expect(mocks.spawn).not.toHaveBeenCalled();
});
it.each(["ACS",null])("non-CC %s blocks before link issuance or providers",async unit=>{
 const result=await sendInvoiceReminder({...invoice,business_unit:unit as unknown as string},"due");expect(result).toEqual({ok:false,error:"not_cc"});expect(mocks.build).not.toHaveBeenCalled();expect(mocks.fetch).not.toHaveBeenCalled();expect(mocks.spawn).not.toHaveBeenCalled();
});
it("successful send carries typed URL and service@ sender; provider is mocked",async()=>{
 vi.stubEnv("RESEND_API_KEY",randomBytes(24).toString("hex"));vi.stubEnv("GOOGLE_DWD_SERVICE_ACCOUNT_FILE","");vi.stubEnv("GOOGLE_OAUTH_TOKEN_FILE_BLAZE","");
 mocks.build.mockReturnValue("https://contentco-op.com/share/invoice/synthetic?t=synthetic");
 mocks.fetch.mockResolvedValue({ok:true,json:async()=>({id:"synthetic_receipt"})});
 // No OAuth token files are opened: provider availability is mocked at the filesystem boundary.
 const result=await sendInvoiceReminder(invoice,"due");
 expect(result.ok).toBe(true);const body=JSON.parse(mocks.fetch.mock.calls[0][1].body);
 expect(body.from).toBe("Content Co-op <service@contentco-op.com>");expect(body.reply_to).toBe("service@contentco-op.com");
 expect(body.html).toContain("?t=synthetic");expect(mocks.build).toHaveBeenCalledWith("invoice",invoice.id);
});
