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
  inspectGmailDwdKey,
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

/** Minimal RFC 5322/2045 reader used to round-trip what we generate. */
function splitMessage(raw: string) {
  const at = raw.indexOf("\r\n\r\n");
  const headerText = raw.slice(0, at);
  const body = raw.slice(at + 4);
  const unfolded = headerText.replace(/\r\n[ \t]+/g, " ");
  const headers = new Map<string, string>();
  for (const line of unfolded.split("\r\n")) {
    const i = line.indexOf(":");
    headers.set(line.slice(0, i).toLowerCase(), line.slice(i + 1).trim());
  }
  return { headerText, headers, body };
}

function decodeWords(value: string) {
  const joined = value.replace(/(=\?UTF-8\?B\?[^?]+\?=) +(?==\?UTF-8\?B\?)/g, "$1");
  return joined.replace(/=\?UTF-8\?B\?([^?]+)\?=/g, (_m, b64: string) => Buffer.from(b64, "base64").toString("utf8"));
}

function boundaryOf(contentType: string) {
  return /boundary="([^"]+)"/.exec(contentType)![1];
}

function parts(body: string, boundary: string) {
  return body.split(`--${boundary}`).slice(1, -1).map((chunk) => chunk.replace(/^\r\n/, "").replace(/\r\n$/, ""));
}

function paramValue(header: string, name: string) {
  const segments = [...header.matchAll(new RegExp(`${name}\\*(\\d+)\\*?=([^;]+)`, "g"))]
    .sort((x, y) => Number(x[1]) - Number(y[1]))
    .map((m) => m[2].trim());
  if (segments.length) return decodeURIComponent(segments.join("").replace(/^UTF-8''/, ""));
  const single = new RegExp(`${name}\\*=UTF-8''([^;]+)`).exec(header);
  if (single) return decodeURIComponent(single[1]);
  return new RegExp(`${name}="([^"]*)"`).exec(header)?.[1] ?? null;
}

const LONG_SUBJECT = "Brief received \u2014 " + "Zo\u00eb Mu\u00f1oz-\u5927\u962a \ud83d\ude80 ".repeat(14) + "Studio";
const LONG_NAME = "J\u00fcrgen \u5927\u962a ".repeat(8).trim();

describe("MIME", () => {
  const raw = buildMimeMessage({ ...msg, subject: LONG_SUBJECT, from: `${LONG_NAME} <blaze@contentco-op.com>`, to: `Zo\u00eb <avery@example.com>`, replyTo: `"Ops, Team" <ops@example.com>` });
  const { headerText, headers, body } = splitMessage(raw);

  test("uses CRLF only and stays inside the 998-octet line limit", () => {
    expect(raw).not.toMatch(/(?<!\r)\n/);
    expect(raw).not.toMatch(/\r(?!\n)/);
    for (const line of raw.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(998);
    for (const line of headerText.split("\r\n")) expect(line.length).toBeLessThanOrEqual(100);
  });

  test("round-trips a long non-ASCII subject through bounded encoded-words", () => {
    const words = headerText.match(/=\?UTF-8\?B\?[^?]+\?=/g)!;
    expect(words.length).toBeGreaterThan(3);
    for (const word of words) expect(word.length).toBeLessThanOrEqual(75);
    expect(decodeWords(headers.get("subject")!)).toBe(LONG_SUBJECT);
  });

  test("round-trips display names and keeps addr-specs plain", () => {
    expect(decodeWords(headers.get("from")!)).toBe(`${LONG_NAME} <blaze@contentco-op.com>`);
    expect(decodeWords(headers.get("to")!)).toBe("Zo\u00eb <avery@example.com>");
    expect(headers.get("reply-to")).toBe('"Ops, Team" <ops@example.com>');
  });

  test("has mixed > alternative(text, html) + attachment, with wrapped base64 bodies", () => {
    const [alternative, attachment] = parts(body, boundaryOf(headers.get("content-type")!));
    const altHeaders = splitMessage(alternative);
    expect(altHeaders.headers.get("content-type")).toMatch(/^multipart\/alternative/);
    const [plain, html] = parts(altHeaders.body, boundaryOf(altHeaders.headers.get("content-type")!));
    const plainPart = splitMessage(plain);
    const htmlPart = splitMessage(html);
    expect(plainPart.headers.get("content-type")).toMatch(/^text\/plain/);
    expect(htmlPart.headers.get("content-type")).toMatch(/^text\/html/);
    expect(Buffer.from(plainPart.body.replace(/\r\n/g, ""), "base64").toString()).toBe("Hello");
    expect(Buffer.from(htmlPart.body.replace(/\r\n/g, ""), "base64").toString()).toBe("<p>Hello</p>");
    const att = splitMessage(attachment);
    expect(att.headers.get("content-type")).toMatch(/^application\/pdf/);
    expect(Buffer.from(att.body.replace(/\r\n/g, ""), "base64").toString()).toBe("%PDF-1.4 test");
  });

  test("wraps a large attachment at 76 columns and preserves every byte", () => {
    const bytes = Buffer.from(Array.from({ length: 5000 }, (_v, i) => i % 251));
    const big = buildMimeMessage({ ...msg, attachments: [{ filename: "big.bin", content: bytes.toString("base64") }] });
    const { headers: h, body: b } = splitMessage(big);
    const att = splitMessage(parts(b, boundaryOf(h.get("content-type")!))[1]);
    for (const line of att.body.split("\r\n")) expect(line.length).toBeLessThanOrEqual(76);
    expect(Buffer.from(att.body.replace(/\r\n/g, ""), "base64").equals(bytes)).toBe(true);
  });

  test("round-trips a long Unicode attachment filename through RFC 2231 continuations", () => {
    const name = "Propuesta \u2014 \u5927\u962a caf\u00e9 ".repeat(6) + "final.pdf";
    const out = buildMimeMessage({ ...msg, attachments: [{ filename: name, content: "QQ==" }] });
    const { headers: h, body: b } = splitMessage(out);
    const att = splitMessage(parts(b, boundaryOf(h.get("content-type")!))[1]);
    for (const line of att.headerText.split("\r\n")) expect(line.length).toBeLessThanOrEqual(100);
    expect(paramValue(att.headers.get("content-disposition")!, "filename")).toBe(name);
  });

  test("blocks header injection in every header", () => {
    const out = buildMimeMessage({ ...msg, subject: "x\r\nBcc: a@evil.example", to: "a@example.com\r\nBcc: b@evil.example" });
    expect(out).not.toMatch(/\r\nBcc:/);
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
    expect((JSON.parse(String(calls[1].init.body)) as { raw: string }).raw).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeRaw(calls[1].init)).toContain("proposal.pdf");
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
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
    expect((await sendGmailViaServiceAccount(msg, { subject: "s", keyPath: keyFile() })).error).toMatch(/^gmail_dwd_forbidden: .*insufficient_permissions/);
  });

  test("a known 4xx reason maps to a fixed code", async () => {
    withSendResponse(() => new Response(JSON.stringify({ error: { status: "INVALID_ARGUMENT" } }), { status: 400 }));
    const result = await sendGmailViaServiceAccount(msg, { subject: "s", keyPath: keyFile() });
    expect(result).toEqual({ ok: false, error: "gmail_dwd_send_failed: HTTP 400 invalid_argument" });
  });

  test("provider-supplied strings never reach the error text", async () => {
    const hostile = "to=victim@example.com subject=Secret /Users/bailey/key.json";
    withSendResponse(() => new Response(JSON.stringify({ error: { status: hostile, message: hostile, errors: [{ reason: hostile, message: hostile }] } }), { status: 400 }));
    expect(await sendGmailViaServiceAccount(msg, { subject: "s", keyPath: keyFile() }))
      .toEqual({ ok: false, error: "gmail_dwd_send_failed: HTTP 400 unknown_reason" });
    withSendResponse(() => new Response(JSON.stringify({ error: { errors: [{ reason: hostile }] } }), { status: 403 }));
    expect((await sendGmailViaServiceAccount(msg, { subject: "s", keyPath: keyFile() })).error)
      .toBe("gmail_dwd_forbidden: Gmail refused the send (unknown_reason)");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: hostile, error_description: hostile }), { status: 400 })));
    expect((await sendGmailViaServiceAccount(msg, { subject: "s", keyPath: keyFile() })).error)
      .toBe("gmail_dwd_token_failed: HTTP 400 unknown_reason");
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

describe("total timeout and cancellation", () => {
  test("the transport budget fits inside the owner-alert wrapper timeout", async () => {
    const { OWNER_ALERT_SEND_TIMEOUT_MS } = await import("../cco-owner-lead-alert");
    const { GMAIL_DWD_TOTAL_TIMEOUT_MS } = await import("../gmail-dwd-send");
    expect(GMAIL_DWD_TOTAL_TIMEOUT_MS).toBeLessThan(OWNER_ALERT_SEND_TIMEOUT_MS);
  });

  test("a caller abort cancels the in-flight Gmail request and leaves delivery unknown", async () => {
    const controller = new AbortController();
    vi.stubGlobal("fetch", vi.fn((url: string, init: RequestInit) => {
      if (String(url).includes("oauth2")) return Promise.resolve(new Response(JSON.stringify({ access_token: "t" }), { status: 200 }));
      return new Promise<Response>((_resolve, reject) => {
        init.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        queueMicrotask(() => controller.abort());
      });
    }));
    const result = await sendGmailViaServiceAccount(msg, { subject: "s", keyPath: keyFile(), signal: controller.signal });
    expect(result).toMatchObject({ ok: false, deliveryUnknown: true });
  });
});

describe("key inspection", () => {
  function envFor(content: string | null, extra: Record<string, string> = {}) {
    const dir = mkdtempSync(path.join(tmpdir(), "dwd-inspect-"));
    const file = path.join(dir, "key.json");
    if (content !== null) writeFileSync(file, content);
    return { HOME: dir, GOOGLE_DWD_SERVICE_ACCOUNT_FILE: file, ...extra } as Record<string, string>;
  }
  const good = () => JSON.stringify({ type: "service_account", client_email: CLIENT_EMAIL, private_key: privatePem });

  test("accepts a locally valid key", () => {
    expect(inspectGmailDwdKey(envFor(good()))).toMatchObject({ state: "valid" });
  });
  test.each([
    ["key_file_missing", null],
    ["not_json", "{nope"],
    ["not_service_account", JSON.stringify({ type: "authorized_user", client_email: "a" })],
    ["missing_client_email", JSON.stringify({ type: "service_account", private_key: privatePem })],
    ["missing_private_key", JSON.stringify({ type: "service_account", client_email: CLIENT_EMAIL })],
    ["private_key_unusable", JSON.stringify({ type: "service_account", client_email: CLIENT_EMAIL, private_key: "-----BEGIN PRIVATE KEY-----\nZm9v\n-----END PRIVATE KEY-----" })],
  ])("names the failed check %s", (check, content) => {
    expect(inspectGmailDwdKey(envFor(content))).toEqual({ state: "invalid", check });
  });
  test("a directory is not a regular file; nothing configured is not_configured", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dwd-dir-"));
    expect(inspectGmailDwdKey({ HOME: dir, GOOGLE_DWD_SERVICE_ACCOUNT_FILE: dir })).toEqual({ state: "invalid", check: "not_a_regular_file" });
    expect(inspectGmailDwdKey({ HOME: dir })).toEqual({ state: "not_configured" });
  });
});

describe("serializer enforces header limits for every header it writes (property-style)", () => {
  // Deterministic generator so failures reproduce.
  let seed = 20261110;
  const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const ALPHABETS = {
    ascii: "abcdefghijklmnopqrstuvwxyz ABCDEFGHIJ0123456789-_.,",
    unicode: "\u00e9\u00fc\u00f1\u2014\u5927\u962a\u0416\ud83d\ude80 a",
    mixed: "abc \u00e9\u2014\u5927 xyz\ud83d\ude80 ",
  };
  function gen(kind: keyof typeof ALPHABETS, length: number) {
    const chars = Array.from(ALPHABETS[kind]);
    return Array.from({ length }, () => chars[Math.floor(rand() * chars.length)]).join("").trim() || "x";
  }

  const kinds = ["ascii", "unicode", "mixed"] as const;
  const lengths = [1, 30, 75, 76, 160, 400, 900];

  for (const kind of kinds) {
    for (const length of lengths) {
      test(`${kind} subject/name/filename of ${length} characters round-trips within limits`, () => {
        const subject = gen(kind, length);
        const name = gen(kind, Math.min(length, 400));
        const filename = `${gen(kind, Math.min(length, 200))}.pdf`.replace(/["\\/]/g, "_");
        const raw = buildMimeMessage({
          ...msg,
          subject,
          from: `${name.replace(/[<>]/g, "")} <blaze@contentco-op.com>`,
          attachments: [{ filename, content: "QQ==", contentType: "application/pdf" }],
        });
        for (const line of raw.split("\r\n")) {
          expect(Buffer.byteLength(line)).toBeLessThanOrEqual(998);
          for (const word of line.match(/=\?UTF-8\?B\?[^?]+\?=/g) || []) expect(word.length).toBeLessThanOrEqual(75);
          if (/=\?UTF-8\?B\?/.test(line) || /filename\*/.test(line)) expect(line.length).toBeLessThanOrEqual(76);
        }
        const { headers } = splitMessage(raw);
        expect(decodeWords(headers.get("subject")!).replace(/ +/g, " ")).toBe(subject.replace(/ +/g, " "));
        const decodedFrom = decodeWords(headers.get("from")!).replace(/^"|"( <)/g, "$1");
        expect(decodedFrom.replace(/ +/g, " ")).toContain("<blaze@contentco-op.com>");
        const { body } = splitMessage(raw);
        const attachment = splitMessage(parts(body, boundaryOf(headers.get("content-type")!))[1]);
        const parsedName = paramValue(attachment.headers.get("content-disposition")!, "filename");
        expect(parsedName?.replace(/ +/g, " ")).toBe(filename.replace(/ +/g, " "));
      });
    }
  }

  test("a 1,000-character ASCII display name is folded or encoded, never one overlong line", () => {
    const raw = buildMimeMessage({ ...msg, from: `${"N".repeat(1000)} <blaze@contentco-op.com>` });
    for (const line of raw.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(998);
  });

  test("a header that cannot be made conformant is a definite local failure before anything is sent", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const overlong = await sendGmailViaServiceAccount({ ...msg, to: `${"a".repeat(1100)}@example.com` }, { subject: "s", keyPath: keyFile() });
    const badType = await sendGmailViaServiceAccount(
      { ...msg, attachments: [{ filename: "a.pdf", content: "QQ==", contentType: "x".repeat(2000) }] },
      { subject: "s", keyPath: keyFile() },
    );
    for (const result of [overlong, badType]) {
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/^gmail_dwd_message_invalid/);
      expect(result.deliveryUnknown).toBeUndefined();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("the seven-second budget is applied to both the token call and the Gmail call", async () => {
    const signals: AbortSignal[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      signals.push(init.signal!);
      return String(url).includes("oauth2")
        ? new Response(JSON.stringify({ access_token: "t" }), { status: 200 })
        : new Response(JSON.stringify({ id: "x" }), { status: 200 });
    }));
    await sendGmailViaServiceAccount(msg, { subject: "s", keyPath: keyFile() });
    expect(signals).toHaveLength(2);
    expect(signals[0]).toBe(signals[1]);
    expect(signals[0].aborted).toBe(false);
  });
});
