type PlatformEvent = {
  type?: string;
  businessUnit?: string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
};

function getBaseUrl() {
  const port = process.env.ORCHESTRATOR_PORT?.trim() || "4300";
  return process.env.ORCHESTRATOR_BASE_URL?.trim() || `http://127.0.0.1:${port}`;
}

export async function enqueueWorkflowJob(input: {
  workflowId: string;
  type: string;
  idempotencyKey: string;
  entity: { type: string; id: string };
  event?: PlatformEvent;
  payload: Record<string, unknown>;
  steps?: string[];
}) {
  try {
    const response = await fetch(`${getBaseUrl()}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const body = await response.json().catch(() => null);
    return {
      ok: response.ok,
      status: response.status,
      job: body,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "orchestrator_unreachable",
      job: null,
    };
  }
}
