import { resolveBlazeTarget } from "@/lib/blaze-runtime-target";

type BlazeHandoffInput = {
  businessUnit: "ACS" | "CC";
  channel?: string;
  sourceSystem: string;
  identityHints?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  timeoutMs?: number;
};

export type BlazeHandoffResult = {
  ok: boolean;
  skipped: boolean;
  statusCode: number | null;
  error?: string | null;
};

export async function emitBlazeHandoff(input: BlazeHandoffInput): Promise<BlazeHandoffResult> {
  const target = resolveBlazeTarget({ fallbackToOperatorTunnel: true });
  if (target.error || !target.baseUrl) {
    return {
      ok: false,
      skipped: true,
      statusCode: null,
      error: target.error || "missing_blaze_target",
    };
  }

  try {
    const response = await Promise.race([
      fetch(`${target.baseUrl.replace(/\/$/, "")}/api/customer-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_unit: input.businessUnit,
          channel: input.channel || "website",
          source_system: input.sourceSystem,
          identity_hints: input.identityHints || {},
          payload: input.payload || {},
          metadata: input.metadata || {},
        }),
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("blaze_handoff_timeout")), input.timeoutMs || 8000);
      }),
    ]);

    return {
      ok: response.ok,
      skipped: false,
      statusCode: response.status,
    };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      statusCode: null,
      error: error instanceof Error ? error.message : "blaze_handoff_failed",
    };
  }
}
