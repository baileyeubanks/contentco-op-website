import { EventEmitter } from "node:events";
import { afterEach, describe, expect, test, vi } from "vitest";

const spawnMock = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ spawn: spawnMock }));

import { sendTransactionalEmail } from "../email-sender";

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

  test("does not fall back to DWD after an ambiguous Gmail OAuth handoff", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    spawnMock.mockReturnValueOnce(pythonChild({
      code: 70,
      stderr: "DELIVERY_UNKNOWN:TimeoutError:timed out",
    }));

    await expect(sendTransactionalEmail(message)).resolves.toEqual({
      ok: false,
      error: "TimeoutError:timed out",
      deliveryUnknown: true,
    });
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  test("preserves an ambiguous Gmail DWD outcome after definite OAuth failures", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    spawnMock
      .mockReturnValueOnce(pythonChild({ code: 1, stderr: "oauth_token_rejected" }))
      .mockReturnValueOnce(pythonChild({ code: 1, stderr: "oauth_token_missing" }))
      .mockReturnValueOnce(pythonChild({
        code: 70,
        stderr: "DELIVERY_UNKNOWN:TimeoutError:timed out",
      }));

    await expect(sendTransactionalEmail(message)).resolves.toEqual({
      ok: false,
      error: "TimeoutError:timed out",
      deliveryUnknown: true,
    });
    expect(spawnMock).toHaveBeenCalledTimes(3);
  });

  test("keeps an explicit Gmail 4xx rejection definite", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    spawnMock
      .mockReturnValueOnce(pythonChild({ code: 1, stderr: "oauth_token_rejected" }))
      .mockReturnValueOnce(pythonChild({ code: 1, stderr: "oauth_token_missing" }))
      .mockReturnValueOnce(pythonChild({
        code: 69,
        stderr: "DELIVERY_FAILED:HTTPError:422",
      }));

    await expect(sendTransactionalEmail(message)).resolves.toEqual({
      ok: false,
      error: "HTTPError:422",
    });
    expect(spawnMock).toHaveBeenCalledTimes(3);
  });
});
