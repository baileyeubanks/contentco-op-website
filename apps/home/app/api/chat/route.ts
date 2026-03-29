import { NextRequest, NextResponse } from "next/server";
import { answerSiteAssistantChat } from "./assistant";
import { assistantOrigins } from "./domain-config";

const ALLOWED_ORIGINS = new Set(assistantOrigins());

function isLocalOrigin(origin: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

function corsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  if (origin && (ALLOWED_ORIGINS.has(origin) || isLocalOrigin(origin))) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  try {
    const { message, conversationId, userId, domain, pathname } = await req.json();

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "Message is required" }, { status: 400, headers: cors });
    }

    const data = await answerSiteAssistantChat({
      message,
      conversationId,
      userId,
      domain,
      pathname,
    });

    return NextResponse.json({
      answer: data.answer,
      conversation_id: data.conversationId,
      metadata: data.metadata,
    }, { headers: cors });
  } catch (error) {
    console.error("[chat] Proxy error:", error);
    return NextResponse.json({
      answer:
        "Something went wrong. Submit a brief at contentco-op.com/brief or email bailey@contentco-op.com and we'll help directly.",
      conversation_id: crypto.randomUUID(),
    }, { headers: cors });
  }
}
