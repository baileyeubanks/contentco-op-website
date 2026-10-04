import { readFileSync } from "node:fs";
import { EventEmitter } from "node:events";
import { afterEach, describe, expect, test, vi } from "vitest";

const spawnMock = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ spawn: spawnMock }));

import { classifyEmailFailure, sendTransactionalEmail } from "../email-sender";

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

function pythonChild(result: { code: number | null; signal?: string; stdout?: string; stderr?: string }) {
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
      child.emit("close", result.code, result.signal);
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
      error: "delivery_interrupted",
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
      error: "gmail_oauth:unclassified_failure;gmail_dwd:delivery_interrupted",
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
      error: "gmail_oauth:unclassified_failure;gmail_dwd:http_422",
    });
    expect(spawnMock).toHaveBeenCalledTimes(3);
  });
});


describe("safe fallback failure evidence", () => {
  test("retains OAuth and missing DWD causes without credential paths or recipient logs", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("GOOGLE_OAUTH_TOKEN_FILE_BLAZE", "");
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    spawnMock
      .mockReturnValueOnce(pythonChild({ code: 1, stderr: "HTTPError:401 private-body" }))
      .mockReturnValueOnce(pythonChild({ code: 1, stderr: "HTTPError:401 private-body" }))
      .mockReturnValueOnce(pythonChild({ code: 1, stderr: "FileNotFoundError: [Errno 2] /private/service-account.json secret" }));
    const result = await sendTransactionalEmail(message);
    expect(result).toEqual({ ok: false, error: "gmail_oauth:http_401;gmail_dwd:credential_file_unavailable" });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/private|service-account|secret|avery|Delivery classification/);
  });
  test("classification is fixed vocabulary for unknown, malformed and unreadable credentials", () => {
    expect(classifyEmailFailure("PermissionError: /secret/path")).toBe("credential_file_unreadable");
    expect(classifyEmailFailure("KeyError: secret-field")).toBe("credential_format_invalid");
    expect(classifyEmailFailure("ModuleNotFoundError: cryptography")).toBe("runtime_dependency_unavailable");
    expect(classifyEmailFailure("unexpected credential-token")).toBe("unclassified_failure");
  });
});


describe("child interruption cannot retry transport", () => {
  test.each([{ code: 70 }, { code: null, signal: "SIGTERM" }])("empty stderr primary OAuth interruption is unknown without fallback: %j", async (termination) => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("GOOGLE_OAUTH_TOKEN_FILE_BLAZE", "");
    spawnMock.mockReturnValueOnce(pythonChild(termination));
    expect(await sendTransactionalEmail(message)).toEqual({ok:false,error:"delivery_interrupted",deliveryUnknown:true});
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });
  test.each([{ code: 70 }, { code: null, signal: "SIGTERM" }])("DWD interruption retains OAuth cause and unknown state: %j", async (termination) => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("GOOGLE_OAUTH_TOKEN_FILE_BLAZE", "");
    spawnMock.mockReturnValueOnce(pythonChild({code:1,stderr:"HTTPError:401"}))
      .mockReturnValueOnce(pythonChild({code:1,stderr:"HTTPError:401"}))
      .mockReturnValueOnce(pythonChild(termination));
    expect(await sendTransactionalEmail(message)).toEqual({ok:false,error:"gmail_oauth:http_401;gmail_dwd:delivery_interrupted",deliveryUnknown:true});
    expect(spawnMock).toHaveBeenCalledTimes(3);
  });
});


describe("successful child exit without a valid provider receipt", () => {
  test.each(["null", "{}", "[]", '{"ok":false}', '{"ok":true,"id":42}', '{"ok":true,"id":"   "}'])("primary malformed receipt %s stays unknown and stops fallback", async (stdout) => {
    vi.stubEnv("RESEND_API_KEY", "");
    spawnMock.mockReturnValueOnce(pythonChild({code:0,stdout}));
    expect(await sendTransactionalEmail(message)).toMatchObject({ok:false,deliveryUnknown:true});
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });
  test.each(["null", "{}", "[]", '{"ok":false}', '{"ok":true,"id":42}', '{"ok":true,"id":"   "}'])("DWD malformed receipt %s stays unknown", async (stdout) => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("GOOGLE_OAUTH_TOKEN_FILE_BLAZE", "");
    spawnMock.mockReturnValueOnce(pythonChild({code:1,stderr:"HTTPError:401"}))
      .mockReturnValueOnce(pythonChild({code:1,stderr:"HTTPError:401"}))
      .mockReturnValueOnce(pythonChild({code:0,stdout}));
    expect(await sendTransactionalEmail(message)).toMatchObject({ok:false,deliveryUnknown:true});
    expect(spawnMock).toHaveBeenCalledTimes(3);
  });
});


test("actual Python receipt serialization handles malformed accepted responses without a fallback exit", async () => {
  const { spawnSync } = await vi.importActual<typeof import("node:child_process")>("node:child_process");
  const source = readFileSync(new URL("../email-sender.ts", import.meta.url), "utf8");
  const serializations = source.match(/^sys.stdout.write\(json.dumps.*$/gm) || [];
  expect(serializations).toHaveLength(2);
  for (const serialization of serializations) {
    for (const response of ["null", "[]", "42", "{}", '{"id":"accepted-id"}']) {
      const child = spawnSync("python3", ["-c", `import json, sys\nresult = json.loads(sys.argv[1])\n${serialization}`, response], { encoding: "utf8" });
      expect(child.status).toBe(0);
      expect(child.stderr).toBe("");
      expect(JSON.parse(child.stdout)).toEqual({ok:true,id:response.includes("accepted-id") ? "accepted-id" : null});
    }
  }
});
