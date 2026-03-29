export type PipelineStage = "script" | "edit" | "deliver";

export interface StagePreset {
  stage: PipelineStage;
  label: string;
  defaultModel: string;
  defaultTools: {
    googleSearch: boolean;
    urlContext: boolean;
  };
  systemInstruction: string;
}

export const CLAUDE_HANDOFF_FUNCTION_NAME = "handoff_to_claude";

export const CLAUDE_HANDOFF_DECLARATION = {
  name: CLAUDE_HANDOFF_FUNCTION_NAME,
  description:
    "Send a complete execution brief to Claude for deterministic implementation.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      pipeline_stage: { type: "string", enum: ["script", "edit", "deliver"] },
      objective: { type: "string" },
      inputs: { type: "object", additionalProperties: true },
      constraints: { type: "array", items: { type: "string" } },
      required_outputs: { type: "array", items: { type: "string" } },
      quality_checks: { type: "array", items: { type: "string" } },
    },
    required: ["pipeline_stage", "objective", "inputs", "required_outputs"],
    additionalProperties: false,
  },
} as const;

export const STAGE_PRESETS: Record<PipelineStage, StagePreset> = {
  script: {
    stage: "script",
    label: "co-script",
    defaultModel: "gemini-2.5-pro",
    defaultTools: {
      googleSearch: true,
      urlContext: true,
    },
    systemInstruction: `You are co-script, an evidence-first AI science script architect.

Rules:
- Separate confirmed facts from hypotheses.
- Ground factual claims with source links and dates.
- Mark uncertain statements as VERIFY_NEEDED.
- Optimize for retention: hook, escalation, reveal, payoff, CTA.
- Write for modern high-agency science storytelling with clean structure.

Return concise outputs with production-ready clarity.`,
  },
  edit: {
    stage: "edit",
    label: "Co-Edit",
    defaultModel: "gemini-2.5-pro",
    defaultTools: {
      googleSearch: false,
      urlContext: true,
    },
    systemInstruction: `You are Co-Edit, a narrative and pacing editor.

Rules:
- Preserve factual meaning and intent.
- Improve cadence, clarity, and compression.
- Remove repetition, filler, and weak transitions.
- Flag legal or brand risk language.
- Provide concrete, line-level edit actions.`,
  },
  deliver: {
    stage: "deliver",
    label: "co-deliver",
    defaultModel: "gemini-2.5-flash",
    defaultTools: {
      googleSearch: true,
      urlContext: false,
    },
    systemInstruction: `You are co-deliver, responsible for publish-ready packaging.

Rules:
- Produce high-CTR but honest positioning.
- Generate title and thumbnail options tied to a single curiosity gap.
- Build platform-specific distribution assets.
- Include KPI assumptions and A/B test suggestions.
- Keep execution pragmatic and immediately usable.`,
  },
};

export function getStagePreset(stage: string): StagePreset | null {
  if (stage === "script" || stage === "edit" || stage === "deliver") {
    return STAGE_PRESETS[stage];
  }
  return null;
}

export function buildUserPrompt(input: {
  objective?: string;
  content?: string;
  audience?: string;
  platform?: string;
  context?: Record<string, unknown>;
  urls?: string[];
}) {
  const lines = [
    `Objective: ${input.objective || "Create a high-quality output for this pipeline stage."}`,
    `Audience: ${input.audience || "General audience"}`,
    `Platform: ${input.platform || "YouTube"}`,
  ];

  if (input.urls?.length) {
    lines.push(`Reference URLs:\n- ${input.urls.join("\n- ")}`);
  }

  if (input.content?.trim()) {
    lines.push(`Working content:\n${input.content.trim()}`);
  }

  if (input.context && Object.keys(input.context).length > 0) {
    lines.push(`Additional context (JSON):\n${JSON.stringify(input.context, null, 2)}`);
  }

  lines.push(
    "Return practical output. If tool calls are enabled, use them only when necessary.",
  );

  return lines.join("\n\n");
}

