import { createVerify, generateKeyPairSync } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  GMAIL_DWD_TOKEN_URL,
  GMAIL_SEND_SCOPE,
  GMAIL_SEND_URL,
  buildGmailDwdAssertion,
  buildMimeMessage,
  sendGmailViaServiceAccount,
} from "../gmail-dwd-send";

const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
const privatePem = pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const publicPem = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
const CLIENT_EMAIL = "svc@test-project.iam.gserviceaccount.com";

function keyFile() {
  const file = path.join(mkdtempSync(path.join(tmpdir(), "dwd-unit-")), "key.json");
  writeFileSync(file, JSON.stringify({ client_email: CLIENT_EMAIL, private_key: privatePem, token_uri: "https://evil.example/token" }));
  return file;
}

const msg = {
  from: "Content Co-Op <blaze@contentco-op.com>",
  to: "avery@example.com",
  subject: "New brief",
  html: "<p>Hello</p>",
  text: "Hello",
  replyTo: "bailey@contentco-op.com",
  attachments: [{ filename: "proposal.pdf", content: Buffer.from("%PDF-1.4 test").toString("base64"), contentType: "application/pdf" }],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function decodeRaw(init: RequestInit) {
  const body = JSON.parse(String(init.body)) as { raw: string };
  return Buffer.from(body.raw, "base64url").toString("utf8");
}

describe("assertion", () => {
  test("has the expected claims and a valid RS256 signature", () => {
    const jwt = buildGmailDwdAssertion({ client_email: CLIENT_EMAIL, private_key: privatePem }, "blaze@contentco-op.com", 1_000_000);
    const [header, claims, signature] = jwt.split(".");
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    expect(JSON.parse(Buffer.from(claims, "base64url").toString())).toEqual({
      iss: CLIENT_EMAIL,
      sub: "blaze@contentco-op.com",
      scope: GMAIL_SEND_SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat: 1_000_000,
      exp: 1_003_600,
    });
    expect(GMAIL_SEND_SCOPE).toBe("https://www.googleapis.com/auth/gmail.send");
    const verifier = createVerify("RSA-SHA256").update(`${header}.${claims}`);
    expect(verifier.verify(publicPem, Buffer.from(signature, "base64url"))).toBe(true);
  });
});

describe("MIME", () => {
  test("is multipart with text, html and a base64 attachment", () => {
    const mime = buildMimeMessage(msg);
    expect(mime).toContain("From: Content Co-Op <blaze@contentco-op.com>");
    expect(mime).toContain("Reply-To: bailey@contentco-op.com");
    expect(mime).toContain("Subject: New brief");
    expect(mime).toContain("multipart/mixed");
    expect(mime).toContain("multipart/alternative");
    expect(mime).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(mime).toContain('Content-Type: text/html; charset="UTF-8"');
    expect(mime).toContain('Content-Disposition: attachment; filename="proposal.pdf"');
    expect(mime).toContain(Buffer.from("%PDF-1.4 test").toString("base64"));
    expect(mime).toContain(Buffer.from("<p>Hello</p>").toString("base64"));
  });

  test("encodes non-ASCII subjects and blocks header injection", () => {
    const mime = buildMimeMessage({ ...msg, subject: "Café\r\nBcc: x@evil.example" });
    expect(mime).not.toMatch(/\r\nBcc:/);
    expect(mime).toMatch(/Subject: =\?UTF-8\?B\?/);
  });
});

describe("sendGmailViaServiceAccount", () => {
  test("posts to the fixed token and Gmail URLs and returns the Gmail id", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return calls.length === 1
        ? new Response(JSON.stringify({ access_token: "tok-abc" }), { status: 200 })
        : new Response(JSON.stringify({ id: "18f-gmail-id" }), { status: 200 });
    }));

    const result = await sendGmailViaServiceAccount(msg, { subject: "blaze@contentco-op.com", keyPath: keyFile() });
    expect(result).toEqual({ ok: true, id: "18f-gmail-id" });
    expect(calls[0].url).toBe(GMAIL_DWD_TOKEN_URL);
    expect(calls[1].url).toBe(GMAIL_SEND_URL);
    const form = new URLSearchParams(String(calls[0].init.body));
    expect(form.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
    expect(JSON.parse(Buffer.from(form.get("assertion")!.split(".")[1], "base64url").toString()).sub).toBe("blaze@contentco-op.com");
    expect((calls[1].init.headers as Record<string, string>).Authorization).toBe("Bearer tok-abc");
    expect(decodeRaw(calls[1].init)).toContain("proposal.pdf");
  });

  test("reports a missing key file with a code and no path", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const none = await sendGmailViaServiceAccount(msg, { subject: "s", keyPath: null });
    const gone = await sendGmailViaServiceAccount(msg, { subject: "s", keyPath: "/nonexistent/dir/key.json" });
    expect(none.error).toMatch(/^gmail_dwd_key_missing/);
    expect(gone.error).toMatch(/^gmail_dwd_key_missing/);
    expect(gone.error).not.toContain("/nonexistent");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test.each([
    ["unauthorized_client", 401, /^gmail_dwd_unauthorized: Google refused this sender/],
    ["invalid_grant", 400, /^gmail_dwd_invalid_grant: /],
  ])("maps token error %s to a distinct code", async (error, status, pattern) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error, error_description: "secret detail" }), { status })));
    const result = await sendGmailViaServiceAccount(msg, { subject: "s", keyPath: keyFile() });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(pattern);
    expect(result.error).not.toContain("secret detail");
    expect(result.deliveryUnknown).toBeUndefined();
  });

  function withSendResponse(sendResponse: () => Response | Promise<Response>) {
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      String(url).includes("oauth2") ? new Response(JSON.stringify({ access_token: "t" }), { status: 200 }) : sendResponse()));
  }

  test("maps 403 quota and generic 403 to distinct codes", async () => {
    withSendResponse(() => new Response(JSON.stringify({ error: { errors: [{ reason: "userRateLimitExceeded" }] } }), { status: 403 }));
    expect((await sendGmailViaServiceAccount(msg, { subject: "s", keyPath: keyFile() })).error).toMatch(/^gmail_dwd_quota/);
    withSendResponse(() => new Response(JSON.stringify({ error: { errors: [{ reason: "insufficientPermissions" }] } }), { status: 403 }));
    expect((await sendGmailViaServiceAccount(msg, { subject: "s", keyPath: keyFile() })).error).toMatch(/^gmail_dwd_forbidden: .*insufficientpermissions/);
  });

  test("a 4xx is a definite failure with a short reason", async () => {
    withSendResponse(() => new Response(JSON.stringify({ error: { status: "INVALID_ARGUMENT" } }), { status: 400 }));
    const result = await sendGmailViaServiceAccount(msg, { subject: "s", keyPath: keyFile() });
    expect(result).toEqual({ ok: false, error: "gmail_dwd_send_failed: HTTP 400 invalid_argument" });
  });

  test("5xx or a timeout after the handoff stays deliveryUnknown", async () => {
    withSendResponse(() => new Response("{}", { status: 503 }));
    expect(await sendGmailViaServiceAccount(msg, { subject: "s", keyPath: keyFile() })).toMatchObject({ ok: false, deliveryUnknown: true });
    withSendResponse(() => { throw new Error("timeout"); });
    expect(await sendGmailViaServiceAccount(msg, { subject: "s", keyPath: keyFile() })).toMatchObject({ ok: false, deliveryUnknown: true });
  });

  test("a 200 without an id is unknown, not sent", async () => {
    withSendResponse(() => new Response("{}", { status: 200 }));
    expect(await sendGmailViaServiceAccount(msg, { subject: "s", keyPath: keyFile() })).toEqual({
      ok: false,
      error: "gmail_provider_receipt_missing",
      deliveryUnknown: true,
    });
  });

  test("an unreachable token endpoint is a definite failure (nothing was handed to Gmail)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ENOTFOUND"); }));
    const result = await sendGmailViaServiceAccount(msg, { subject: "s", keyPath: keyFile() });
    expect(result.error).toMatch(/^gmail_dwd_token_unreachable/);
    expect(result.deliveryUnknown).toBeUndefined();
  });
});
