export const stepRegistry = {
  source_context: async (job) => ({ ...job, context_loaded: true }),
  brief_validation: async (job) => ({
    ...job,
    brief_valid: Boolean(job.payload?.brief_id && job.payload?.source_outlier_id)
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
  })
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

