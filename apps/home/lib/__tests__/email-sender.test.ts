import { generateKeyPairSync } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

const spawnMock = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ spawn: spawnMock }));

import { sendTransactionalEmail } from "../email-sender";

function writeThrowawayKey(extra: Record<string, unknown> = {}) {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const file = path.join(mkdtempSync(path.join(tmpdir(), "dwd-test-")), "key.json");
  writeFileSync(file, JSON.stringify({
    type: "service_account",
    client_email: "svc@test-project.iam.gserviceaccount.com",
    private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    ...extra,
  }));
  return file;
}

const message = {
  to: "avery@example.com",
  subject: "Delivery classification test",
  html: "<p>Test</p>",
  text: "Test",
  businessUnit: "CC",
};

afterEach(() => {
  spawnMock.mockReset();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function pythonChild(result: { code: number; stdout?: string; stderr?: string }) {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    stdin: { write: (value: string) => void; end: () => void };
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = {
    write: () => undefined,
    end: () => queueMicrotask(() => {
      if (result.stdout) child.stdout.emit("data", result.stdout);
      if (result.stderr) child.stderr.emit("data", result.stderr);
      child.emit("close", result.code);
    }),
  };
  return child;
}

describe("transactional email delivery certainty", () => {
  test("marks a transport exception unknown so callers cannot auto-resend", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("provider_timeout");
    }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(sendTransactionalEmail(message)).resolves.toMatchObject({
      ok: false,
      error: "provider_timeout",
      deliveryUnknown: true,
    });
  });

  test("treats an explicit client rejection as a confirmed failure", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ message: "invalid sender" }),
      { status: 422, headers: { "Content-Type": "application/json" } },
    )));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(sendTransactionalEmail(message)).resolves.toEqual({
      ok: false,
      error: "invalid sender",
      deliveryUnknown: false,
    });
  });

  test("marks a provider server error unknown", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ message: "provider unavailable" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    )));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(sendTransactionalEmail(message)).resolves.toMatchObject({
      ok: false,
      deliveryUnknown: true,
    });
  });

  test("requires a provider message id before claiming a sent receipt", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({}),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )));

    await expect(sendTransactionalEmail(message)).resolves.toEqual({
      ok: false,
      error: "resend_provider_receipt_missing",
      deliveryUnknown: true,
    });
  });

  test("returns the provider message id for an accepted delivery", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ id: "provider-message-id" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )));

    await expect(sendTransactionalEmail(message)).resolves.toEqual({
      ok: true,
      id: "provider-message-id",
    });
  });

  test("uses the Node service-account path first and never spawns Python when the key file exists", async () => {
    const keyPath = writeThrowawayKey();
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("GOOGLE_DWD_SERVICE_ACCOUNT_FILE", keyPath);
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      calls.push(String(url));
      return String(url).includes("oauth2")
        ? new Response(JSON.stringify({ access_token: "t" }), { status: 200 })
        : new Response(JSON.stringify({ id: "gmail-msg-1" }), { status: 200 });
    }));

    await expect(sendTransactionalEmail(message)).resolves.toEqual({ ok: true, id: "gmail-msg-1" });
    expect(spawnMock).not.toHaveBeenCalled();
    expect(calls).toEqual([
      "https://oauth2.googleapis.com/token",
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    ]);
  });

  test("does not try the stale CC OAuth token after a definite service-account refusal", async () => {
    const keyPath = writeThrowawayKey();
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("GOOGLE_DWD_SERVICE_ACCOUNT_FILE", keyPath);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "unauthorized_client" }), { status: 401 })));
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const result = await sendTransactionalEmail(message);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/^gmail_dwd_unauthorized: /);
    expect(result.deliveryUnknown).toBeUndefined();
    expect(spawnMock).not.toHaveBeenCalled();
  });

  test("keeps an ambiguous service-account handoff unknown so nothing is resent", async () => {
    const keyPath = writeThrowawayKey();
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("GOOGLE_DWD_SERVICE_ACCOUNT_FILE", keyPath);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => String(url).includes("oauth2")
      ? new Response(JSON.stringify({ access_token: "t" }), { status: 200 })
      : new Response("{}", { status: 503 })));

    const result = await sendTransactionalEmail(message);
    expect(result).toMatchObject({ ok: false, deliveryUnknown: true });
    expect(spawnMock).not.toHaveBeenCalled();
  });

  test("falls back to the legacy OAuth token file only when no service-account key exists", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("HOME", "/nonexistent-home-for-test");
    vi.stubEnv("GOOGLE_DWD_SERVICE_ACCOUNT_FILE", "");
    vi.stubEnv("GOOGLE_APPLICATION_CREDENTIALS", "");
    spawnMock.mockReturnValue(pythonChild({ code: 0, stdout: JSON.stringify({ ok: true, id: "oauth-1" }) }));

    await expect(sendTransactionalEmail(message)).resolves.toEqual({ ok: true, id: "oauth-1" });
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  test("an ambiguous legacy OAuth handoff stays unknown with a fixed code (CC)", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("HOME", "/nonexistent-home-for-test");
    vi.stubEnv("GOOGLE_DWD_SERVICE_ACCOUNT_FILE", "");
    vi.stubEnv("GOOGLE_APPLICATION_CREDENTIALS", "");
    spawnMock.mockReturnValueOnce(pythonChild({ code: 70, stderr: "DELIVERY_UNKNOWN:TimeoutError:timed out for /Users/x" }));

    await expect(sendTransactionalEmail(message)).resolves.toEqual({
      ok: false,
      error: "gmail_oauth_send_unknown: delivery not confirmed",
      deliveryUnknown: true,
    });
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  test("an unusable key file is named and does not silently suppress the legacy path", async () => {
    const badKey = writeThrowawayKey({ type: "authorized_user" });
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("HOME", "/nonexistent-home-for-test");
    vi.stubEnv("GOOGLE_DWD_SERVICE_ACCOUNT_FILE", badKey);
    spawnMock.mockImplementation(() => pythonChild({ code: 1, stderr: "token refused /Users/x/secret.json" }));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const result = await sendTransactionalEmail(message);
    expect(spawnMock).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.error).toBe("gmail_dwd_key_invalid: service account key failed local check not_service_account; gmail_oauth_send_failed: legacy token refused or unavailable");
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/avery@example|Delivery classification|\/Users\//);
  });

  test("no traceback, path, recipient or subject reaches the stored error or the log", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("HOME", "/nonexistent-home-for-test");
    vi.stubEnv("GOOGLE_DWD_SERVICE_ACCOUNT_FILE", "");
    vi.stubEnv("GOOGLE_APPLICATION_CREDENTIALS", "");
    spawnMock.mockImplementation(() => pythonChild({
      code: 1,
      stderr: 'Traceback (most recent call last):\n  File "/Users/x/y.py", line 1\nFileNotFoundError: /Users/x/.config/token.json',
    }));
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const result = await sendTransactionalEmail(message);
    expect(result.error).toMatch(/^gmail_dwd_key_missing/);
    expect(result.error).not.toMatch(/Traceback|\/Users\//);
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/avery@example|Delivery classification|Traceback|\/Users\//);
  });

  test("the gmail DWD failure log carries only the fixed code", async () => {
    const keyPath = writeThrowawayKey();
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("GOOGLE_DWD_SERVICE_ACCOUNT_FILE", keyPath);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "to=avery@example.com" }), { status: 400 })));
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await sendTransactionalEmail(message);
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/avery@example|Delivery classification/);
    expect(JSON.stringify(log.mock.calls)).toContain("gmail_dwd_token_failed");
  });
});

describe("Astro Cleanings (ACS) call sequence is unchanged from the base order", () => {
  const acs = { ...message, businessUnit: "ACS" };

  function trace(keyPath: string | null) {
    const events: string[] = [];
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("GOOGLE_OAUTH_TOKEN_FILE_ACS", "/acs/token.json");
    vi.stubEnv("GOOGLE_DWD_SERVICE_ACCOUNT_FILE", keyPath || "");
    vi.stubEnv("GOOGLE_APPLICATION_CREDENTIALS", "");
    vi.stubEnv("HOME", "/nonexistent-home-for-test");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      events.push(String(url).includes("oauth2") ? "dwd-token" : "dwd-send");
      return String(url).includes("oauth2")
        ? new Response(JSON.stringify({ access_token: "t" }), { status: 200 })
        : new Response(JSON.stringify({ id: "acs-dwd" }), { status: 200 });
    }));
    return events;
  }

  test("OAuth first and, on success, DWD is never touched even when a key exists", async () => {
    const events = trace(writeThrowawayKey());
    spawnMock.mockImplementation(() => { events.push("oauth"); return pythonChild({ code: 0, stdout: JSON.stringify({ ok: true, id: "acs-oauth" }) }); });
    await expect(sendTransactionalEmail(acs)).resolves.toEqual({ ok: true, id: "acs-oauth" });
    expect(events).toEqual(["oauth"]);
  });

  test("an ambiguous OAuth outcome returns immediately with no DWD attempt", async () => {
    const events = trace(writeThrowawayKey());
    spawnMock.mockImplementation(() => { events.push("oauth"); return pythonChild({ code: 70, stderr: "DELIVERY_UNKNOWN:TimeoutError:timed out" }); });
    await expect(sendTransactionalEmail(acs)).resolves.toEqual({ ok: false, error: "TimeoutError:timed out", deliveryUnknown: true });
    expect(events).toEqual(["oauth"]);
  });

  test("DWD runs only after a definite OAuth failure", async () => {
    const events = trace(writeThrowawayKey());
    spawnMock.mockImplementation(() => { events.push("oauth"); return pythonChild({ code: 1, stderr: "oauth_token_rejected" }); });
    await expect(sendTransactionalEmail(acs)).resolves.toEqual({ ok: true, id: "acs-dwd" });
    expect(events).toEqual(["oauth", "dwd-token", "dwd-send"]);
  });
});
