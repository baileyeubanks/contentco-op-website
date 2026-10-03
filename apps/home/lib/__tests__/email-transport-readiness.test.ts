import { describe, expect, test } from "vitest";
import { describeCcoEmailTransport } from "../email-sender";

describe("describeCcoEmailTransport", () => {
  test("prefers Resend when the API key is present", () => {
    const readiness = describeCcoEmailTransport({ RESEND_API_KEY: "re_test" }, () => false);
    expect(readiness).toMatchObject({ provider: "resend", ready: true });
  });

  test("finds a Gmail OAuth token file under the runtime user's home", () => {
    const readiness = describeCcoEmailTransport(
      { HOME: "/Users/_mxappservice" },
      (filePath) => filePath === "/Users/_mxappservice/.config/blaze/google/blaze_contentcoop.json",
    );
    expect(readiness).toMatchObject({ provider: "gmail_oauth", ready: true });
  });

  test("reports no transport when neither Resend nor Gmail credentials exist", () => {
    const readiness = describeCcoEmailTransport({ HOME: "/Users/_mxappservice" }, () => false);
    expect(readiness).toMatchObject({ provider: "none", ready: false });
    expect(readiness.detail).toContain("RESEND_API_KEY unset");
    expect(readiness.checkedPaths).toContain("/Users/_mxappservice/.config/blaze/google/blaze_contentcoop.json");
  });
});
