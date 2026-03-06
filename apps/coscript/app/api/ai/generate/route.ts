import { NextResponse } from "next/server";
import { AI_MODEL, AI_MAX_TOKENS, getAnthropicHeaders } from "@/lib/ai-config";

export async function POST(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { hook, audience, objective, tone, platform, script_type } = body;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const platformGuides: Record<string, string> = {
    youtube: "Write for YouTube. Strong hook in first 5 seconds. Use pattern interrupts. Include retention bumps every 30-60 seconds.",
    tiktok: "Write for TikTok. Maximum 60 seconds. Hook must be immediate. Conversational, raw, authentic tone.",
    instagram: "Write for Instagram Reels/Stories. Visual-first. Strong text overlay hooks. Under 90 seconds.",
    linkedin: "Write for LinkedIn. Professional but human. Lead with insight. Include a clear takeaway.",
    twitter: "Write for Twitter/X. Punchy threads. Each tweet must standalone. Hook tweet is everything.",
    email: "Write an email sequence. Subject line = hook. One idea per email. Clear CTA.",
  };

  const typeGuides: Record<string, string> = {
    video_script: "Format as a video script with [HOOK], [BODY], and [CTA] sections. Include visual notes in brackets where helpful.",
    social_media: "Write platform-optimized social copy. Include hashtag suggestions.",
    blog: "Write a blog post with SEO-friendly headers, intro, body sections, and conclusion.",
    ad_copy: "Write ad copy with 3 headline variants, body copy, and CTA variants.",
    email: "Write email with subject line, preview text, body, and CTA button text.",
  };

  const systemPrompt = `You are an elite content strategist and scriptwriter. Generate high-converting scripts.

${typeGuides[script_type] || typeGuides.video_script}
${platformGuides[platform] || ""}

Your scripts should be:
- Hook-first (grab attention in the first line)
- Emotionally resonant
- Clear and concise
- Action-oriented with strong CTAs
- Written in ${tone || "conversational"} tone

Return ONLY the script content. No meta-commentary.`;

  const userPrompt = `Generate a ${script_type || "video_script"} for ${platform || "youtube"}.

Target audience: ${audience || "general audience"}
Objective: ${objective || "engage and grow"}
${hook ? `Start with or riff on this hook: "${hook}"` : "Create a compelling hook."}
Tone: ${tone || "conversational"}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: getAnthropicHeaders(apiKey),
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: AI_MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: "AI error", detail: err }, { status: 500 });
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  return NextResponse.json({ content: text });
}
