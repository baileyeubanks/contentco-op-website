import { NextResponse } from "next/server";
import { AI_MODEL, getAnthropicHeaders } from "@/lib/ai-config";

export async function POST(req: Request) {
  const { url } = await req.json();
  if (!url?.trim()) return NextResponse.json({ error: "URL required" }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const systemPrompt = `You are a content analyst. Analyze the given URL (a video, article, or social post) and extract insights for script creation.

Return ONLY valid JSON:
{
  "title": "<content title>",
  "hook_used": "<what hook technique was used>",
  "structure": "<framework/structure identified>",
  "key_takeaways": ["<takeaway 1>", "<takeaway 2>", "<takeaway 3>"],
  "audience": "<target audience>",
  "tone": "<tone used>",
  "suggestions": "<how to adapt this for the user's content>"
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: getAnthropicHeaders(apiKey),
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: `Analyze this content URL and extract scriptwriting insights: ${url}` }],
    }),
  });

  if (!res.ok) return NextResponse.json({ error: "AI error" }, { status: 500 });

  const data = await res.json();
  const text = data.content?.[0]?.text || "";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return NextResponse.json(JSON.parse(jsonMatch?.[0] || "{}"));
  } catch {
    return NextResponse.json({ analysis: text });
  }
}
