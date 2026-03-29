export const stepRegistry = {
  source_context: async (job) => ({ ...job, context_loaded: true, workflow_id: job.workflow_id }),
  brief_validation: async (job) => ({
    ...job,
    brief_valid: Boolean(
      job.payload?.entity?.id ||
      job.payload?.payload?.brief_id ||
      job.payload?.event?.subject?.id,
    ),
  }),
  variant_generation: async (job) => ({
    ...job,
    variants: [
      { id: "A", mode: "direct", text: "Operator-first concise narrative." },
      { id: "B", mode: "executive", text: "Leadership framing with risk signal." },
      { id: "C", mode: "human", text: "Trust-forward practical direction." }
    ]
  }),
  fix_loop: async (job) => ({
    ...job,
    fix_applied: Boolean(job.payload?.fix_request)
  }),
  project_conversion_ready: async (job) => ({
    ...job,
    project_conversion_ready: Boolean(job.payload?.entity?.id),
  }),
};

export async function runPipeline(job, steps = []) {
  let current = { ...job };
  for (const step of steps) {
    const handler = stepRegistry[step];
    if (!handler) {
      current.errors = [...(current.errors || []), `unknown_step:${step}`];
      continue;
    }
    current = await handler(current);
  }
  return current;
}
