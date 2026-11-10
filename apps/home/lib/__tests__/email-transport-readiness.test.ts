import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { describeCcoOwnerEmailTransport } from "../cco-owner-lead-alert";
import { describeCcoEmailTransport, publicEmailTransportStatus } from "../email-sender";

const pem = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }).toString();

function host(keyContent?: string | null) {
  const home = mkdtempSync(path.join(tmpdir(), "ready-"));
  const keyFile = path.join(home, "key.json");
  if (keyContent) writeFileSync(keyFile, keyContent);
  return { home, keyFile, env: { HOME: home, GOOGLE_DWD_SERVICE_ACCOUNT_FILE: keyFile } as Record<string, string> };
}
const goodKey = () => JSON.stringify({ type: "service_account", client_email: "svc@p.iam.gserviceaccount.com", private_key: pem });

describe("describeCcoEmailTransport", () => {
  test("prefers Resend when the API key is present", () => {
    expect(describeCcoEmailTransport({ RESEND_API_KEY: "re_test" })).toMatchObject({ provider: "resend", ready: true });
  });

  test("a locally valid key is gmail_dwd and ready, but never provider-verified", () => {
    const h = host(goodKey());
    expect(describeCcoEmailTransport(h.env)).toMatchObject({
      provider: "gmail_dwd", ready: true, keyState: "valid", providerVerified: false,
    });
  });

  test("a path that exists but is not a usable key is NOT ready and names the failed check", () => {
    const h = host("{not json");
    const notJson = describeCcoEmailTransport(h.env);
    expect(notJson).toMatchObject({ provider: "gmail_dwd", ready: false, keyState: "invalid", keyCheck: "not_json" });

    const dir = host(null);
    mkdirSync(dir.keyFile);
    expect(describeCcoEmailTransport(dir.env)).toMatchObject({ ready: false, keyCheck: "not_a_regular_file" });

    const wrong = host(JSON.stringify({ type: "authorized_user", client_email: "a" }));
    expect(describeCcoEmailTransport(wrong.env)).toMatchObject({ ready: false, keyCheck: "not_service_account" });
  });

  test("a configured but absent key file is invalid, not 'not configured'", () => {
    const h = host(null);
    expect(describeCcoEmailTransport(h.env)).toMatchObject({ ready: false, keyState: "invalid", keyCheck: "key_file_missing" });
  });

  test("Content Co-op never reports the legacy OAuth path, even when a token file exists", () => {
    const h = host(null);
    mkdirSync(path.join(h.home, ".config/blaze/google"), { recursive: true });
    writeFileSync(path.join(h.home, ".config/blaze/google/blaze_contentcoop.json"), "{}");
    const readiness = describeCcoEmailTransport({ HOME: h.home });
    expect(readiness).toMatchObject({ provider: "none", ready: false, keyState: "not_configured" });
    const bad = host("{bad");
    writeFileSync(path.join(bad.home, "blaze_contentcoop.json"), "{}");
    expect(describeCcoEmailTransport(bad.env)).toMatchObject({ provider: "gmail_dwd", ready: false, keyCheck: "not_json" });
  });

  test("with nothing configured, reports none/not ready and names the missing variable", () => {
    const h = host(null);
    const readiness = describeCcoEmailTransport({ HOME: h.home });
    expect(readiness).toMatchObject({ provider: "none", ready: false, keyState: "not_configured" });
    expect(readiness.detail).toContain("RESEND_API_KEY unset");
    expect(readiness.detail).toContain("GOOGLE_DWD_SERVICE_ACCOUNT_FILE");
  });

  test("owner-alert transport reports the same provider and state", () => {
    const h = host(goodKey());
    expect(describeCcoOwnerEmailTransport(h.env)).toMatchObject({ provider: "gmail_dwd", ready: true, keyState: "valid", providerVerified: false, missing: [] });
    const bad = host("{bad");
    expect(describeCcoOwnerEmailTransport(bad.env)).toMatchObject({ ready: false, keyState: "invalid", keyCheck: "not_json" });
  });
});

describe("public /api/health projection", () => {
  test("distinguishes the three states with a fixed vocabulary and no paths or detail", () => {
    const valid = host(goodKey());
    const invalid = host("{bad");
    const none = host(null);
    const out = [
      publicEmailTransportStatus(describeCcoEmailTransport(valid.env)),
      publicEmailTransportStatus(describeCcoEmailTransport(invalid.env)),
      publicEmailTransportStatus(describeCcoEmailTransport({ HOME: none.home })),
    ];
    expect(out[0]).toMatchObject({ warning: null, meta: { emailTransport: "gmail_dwd", emailTransportReady: true, emailTransportKeyState: "valid", emailTransportProviderVerified: false } });
    expect(out[1]).toMatchObject({ warning: "email_transport_invalid:not_json", meta: { emailTransportReady: false, emailTransportKeyState: "invalid", emailTransportKeyCheck: "not_json" } });
    expect(out[2]).toMatchObject({ warning: "email_transport_unconfigured", meta: { emailTransportKeyState: "not_configured" } });
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain(valid.home);
    expect(serialized).not.toContain("BEGIN PRIVATE KEY");
    expect(serialized).not.toContain("svc@p.iam");
  });
});
