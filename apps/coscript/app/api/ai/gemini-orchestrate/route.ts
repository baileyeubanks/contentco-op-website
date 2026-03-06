import { NextResponse } from "next/server";
import {
  CLAUDE_HANDOFF_DECLARATION,
  CLAUDE_HANDOFF_FUNCTION_NAME,
  buildUserPrompt,
  getStagePreset,
} from "@/lib/gemini-orchestration";

type GeminiPart = {
  text?: string;
  functionCall?: {
    name?: string;
    args?: Record<string, unknown>;
  };
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
    groundingMetadata?: unknown;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const stage = typeof body.stage === "string" ? body.stage : "";
  const preset = getStagePreset(stage);
  if (!preset) {
    return NextResponse.json(
      { error: "stage must be one of: script, edit, deliver" },
      { status: 400 },
    );
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_API_KEY is not configured" },
      { status: 500 },
    );
  }

  const model =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : process.env.GEMINI_MODEL || preset.defaultModel;

  const readBool = (value: unknown, fallback: boolean) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      if (value.toLowerCase() === "true") return true;
      if (value.toLowerCase() === "false") return false;
    }
    return fallback;
  };

  const forceClaudeHandoff = readBool(body.force_claude_handoff, false);
  const enableSearch = readBool(body.enable_search, preset.defaultTools.googleSearch);
  const enableUrlContext = readBool(
    body.enable_url_context,
    preset.defaultTools.urlContext,
  );

  const urls = Array.isArray(body.urls)
    ? body.urls.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : [];

  const userPrompt = buildUserPrompt({
    objective: typeof body.objective === "string" ? body.objective : undefined,
    content: typeof body.content === "string" ? body.content : undefined,
    audience: typeof body.audience === "string" ? body.audience : undefined,
    platform: typeof body.platform === "string" ? body.platform : undefined,
    context:
      body.context && typeof body.context === "object" && !Array.isArray(body.context)
        ? (body.context as Record<string, unknown>)
        : undefined,
    urls,
  });

  const tools: Array<Record<string, unknown>> = [];
  if (enableSearch) {
    tools.push({ googleSearch: {} });
  }
  if (enableUrlContext) {
    tools.push({ urlContext: {} });
  }
  if (forceClaudeHandoff) {
    tools.push({ functionDeclarations: [CLAUDE_HANDOFF_DECLARATION] });
  }

  const requestBody: Record<string, unknown> = {
    systemInstruction: {
      parts: [{ text: preset.systemInstruction }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    tools,
    generationConfig: {
      temperature: stage === "script" ? 0.8 : 0.4,
      maxOutputTokens: 2048,
      responseMimeType: forceClaudeHandoff ? "text/plain" : "application/json",
    },
  };

  if (forceClaudeHandoff) {
    requestBody.toolConfig = {
      functionCallingConfig: {
        mode: "ANY",
        allowedFunctionNames: [CLAUDE_HANDOFF_FUNCTION_NAME],
      },
    };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json(
      { error: "Gemini API error", detail, model },
      { status: response.status },
    );
  }

  const data = (await response.json()) as GeminiResponse;
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  const functionCallPart = parts.find((part) => part.functionCall?.name);
  if (functionCallPart?.functionCall?.name) {
    return NextResponse.json({
      stage: preset.stage,
      mode: "function_call",
      model,
      function_call: {
        name: functionCallPart.functionCall.name,
        args: functionCallPart.functionCall.args || {},
      },
      grounding: candidate?.groundingMetadata ?? null,
      usage: data.usageMetadata ?? null,
    });
  }

  const text = parts
    .map((part) => part.text || "")
    .join("\n")
    .trim();

  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  return NextResponse.json({
    stage: preset.stage,
    mode: parsed ? "json" : "text",
    model,
    content: text,
    parsed,
    grounding: candidate?.groundingMetadata ?? null,
    usage: data.usageMetadata ?? null,
  });
}
