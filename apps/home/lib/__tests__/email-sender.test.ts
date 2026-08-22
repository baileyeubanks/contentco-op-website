import { afterEach, describe, expect, test, vi } from "vitest";
import { sendTransactionalEmail } from "../email-sender";

const message = {
  to: "avery@example.com",
  subject: "Delivery classification test",
  html: "<p>Test</p>",
  text: "Test",
  businessUnit: "CC",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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
});
