import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { describeCcoOwnerEmailTransport } from "../cco-owner-lead-alert";
import { describeCcoEmailTransport } from "../email-sender";

describe("describeCcoEmailTransport", () => {
  test("prefers Resend when the API key is present", () => {
    const readiness = describeCcoEmailTransport({ RESEND_API_KEY: "re_test" }, () => false);
    expect(readiness).toMatchObject({ provider: "resend", ready: true });
  });

  test("reports gmail_dwd when the service-account key file exists", () => {
    const readiness = describeCcoEmailTransport(
      { HOME: "/Users/_mxappservice", GOOGLE_DWD_SERVICE_ACCOUNT_FILE: "/etc/cco/gmail-key.json" },
      (filePath) => filePath === "/etc/cco/gmail-key.json" || filePath.endsWith("blaze_contentcoop.json"),
    );
    expect(readiness).toMatchObject({ provider: "gmail_dwd", ready: true });
  });

  test("prefers the service-account key over a stale OAuth token file", () => {
    const readiness = describeCcoEmailTransport(
      { HOME: "/Users/_mxappservice" },
      () => true,
    );
    expect(readiness.provider).toBe("gmail_dwd");
  });

  test("falls back to gmail_oauth only when no key file exists", () => {
    const readiness = describeCcoEmailTransport(
      { HOME: "/Users/_mxappservice" },
      (filePath) => filePath === "/Users/_mxappservice/.config/blaze/google/blaze_contentcoop.json",
    );
    expect(readiness).toMatchObject({ provider: "gmail_oauth", ready: true });
  });

  test("reports not ready and names the missing key file", () => {
    const readiness = describeCcoEmailTransport({ HOME: "/Users/_mxappservice" }, () => false);
    expect(readiness).toMatchObject({ provider: "none", ready: false });
    expect(readiness.detail).toContain("RESEND_API_KEY unset");
    expect(readiness.detail).toContain("GOOGLE_DWD_SERVICE_ACCOUNT_FILE");
    expect(readiness.checkedPaths).toContain("/Users/_mxappservice/.config/blaze/google/service_account.json");
  });

  test("owner-alert transport reports the same provider", () => {
    expect(describeCcoOwnerEmailTransport({ HOME: "/h", GOOGLE_DWD_SERVICE_ACCOUNT_FILE: "/k.json" }, (p) => p === "/k.json"))
      .toMatchObject({ provider: "gmail_dwd", ready: true, missing: [] });
    expect(describeCcoOwnerEmailTransport({ HOME: "/h" }, () => false))
      .toMatchObject({ provider: "none", ready: false, missing: ["RESEND_API_KEY or GOOGLE_DWD_SERVICE_ACCOUNT_FILE"] });
  });
});

describe("public /api/health intake_contract", () => {
  test("does not copy credential-file detail into the unauthenticated health check", () => {
    const src = readFileSync(path.join(__dirname, "../repo-health.ts"), "utf8");
    expect(src).toContain('["email_transport_unconfigured"]');
    expect(src).not.toMatch(/emailWarning = emailTransport\.ready \? \[\] : \[emailTransport\.detail\]/);
  });
});
