import { resolveAssistantDomain, type AssistantDomainProfile } from "./domain-config";

type AssistantReply = {
  answer: string;
  conversationId: string;
  metadata: {
    domain: string;
    guardrail?: string;
    mode: "dify" | "fallback";
    provider?: string;
    topic: string;
    provenance?: {
      bindingId?: string;
      sourceRef?: string;
      sourceType?: string;
      title?: string;
      domain?: string;
      documentId?: string;
      chunkId?: string;
      freshnessAt?: string;
      confidence?: number;
      provider?: string;
      kind?: string;
    };
  };
};

const DIRECT_FAQ_MIN_SCORE = 3;
const DIFY_REQUEST_TIMEOUT_MS = 4000;

const GENERIC_DIFY_REPLY_MARKERS = [
  "i m here to provide information and assistance",
  "i am here to provide information and assistance",
  "i can assist you with a variety of tasks",
  "i offer a range of services including",
  "wide range of topics",
  "provide information on a wide range of topics",
  "it looks like you're referring to",
  "not specific enough",
  "if you're specifically asking about",
  "frameworks or libraries",
  "web servers or apis",
  "health check",
  "microservices or web applications",
  "i don't offer cleaning services myself",
  "i don't provide cleaning services directly",
  "common types of cleaning services",
  "common types of cleaning services you might consider",
  "research local services",
  "research local providers",
  "look up cleaning companies in your area",
  "look for cleaning services in your area",
  "check reviews and ratings",
  "choose a reliable cleaning service",
  "compare quotes and services",
  "online quote tools",
  "some companies may offer free consultations",
  "i m not able to handle full service commercial production",
  "i am not able to handle full service commercial production",
  "connect you directly to a human",
  "i can provide information and answer questions related to",
  "it may depend on the specific business or service",
];

const PROFILE_ANSWER_ANCHORS: Record<AssistantDomainProfile["routeKey"], string[]> = {
  acs: [
    "astro",
    "astro cleaning",
    "astrocleanings.com",
    "quote tool",
    "instant quote",
    "white glove",
    "call or text (346) 401 5841",
    "346 401 5841",
  ],
  cco: [
    "content co-op",
    "video",
    "production",
    "brief",
    "bailey",
    "co-script",
    "co-cut",
    "co-deliver",
  ],
  coscript: ["co-script", "script", "storyboard", "pre-production", "production plan"],
  cocut: ["co-cut", "edit", "editing", "post-production", "captions", "export"],
  codeliver: ["co-deliver", "review", "approval", "delivery", "revision", "assets"],
};

const PROFILE_CROSS_DOMAIN_MARKERS: Partial<Record<AssistantDomainProfile["routeKey"], string[]>> = {
  acs: ["content co-op", "co-script", "co-cut", "co-deliver", "bailey@contentco-op.com"],
  cco: ["astro cleaning", "(346) 401-5841", "residential cleaning", "airbnb reset", "white glove"],
};

async function emitBlazeCustomerEvent(input: {
  businessUnit: "CC" | "ACS";
  channel: "dify" | "web_chat";
  conversationId: string;
  domain: string;
  guardrail?: string;
  message: string;
  replyMode: "dify" | "fallback";
  answer: string;
  pathname?: string;
  provider?: string;
  provenance?: AssistantReply["metadata"]["provenance"];
  topic?: string;
  userId: string;
}) {
  const blazeApi = getBlazeApiBase();
  if (!blazeApi) {
    return;
  }

  try {
    await Promise.race([
      fetch(`${blazeApi.replace(/\/$/, "")}/api/customer-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_unit: input.businessUnit,
          channel: input.channel,
          source_system: "cco_site_chat",
          identity_hints: {
            user_id: input.userId,
            conversation_id: input.conversationId,
            external_id: input.userId,
          },
          payload: {
            message: input.message,
            answer: input.answer,
            conversation_id: input.conversationId,
            domain: input.domain,
            pathname: input.pathname || "/",
            topic: input.topic || "general",
            reply_mode: input.replyMode,
            provider: input.provider || null,
            guardrail: input.guardrail || null,
            provenance: input.provenance || null,
          },
          metadata: {
            site: "contentco-op",
            reply_mode: input.replyMode,
            provider: input.provider || null,
            topic: input.topic || "general",
            guardrail: input.guardrail || null,
            provenance: input.provenance || null,
          },
        }),
      }).catch(() => null),
      new Promise((resolve) => setTimeout(resolve, 750)),
    ]);
  } catch (error) {
    console.warn("[chat] Blaze event emission skipped:", error);
  }
}

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

function scoreEntry(message: string, keywords: string[]) {
  let score = 0;
  for (const keyword of keywords) {
    if (message.includes(keyword)) {
      score += keyword.split(" ").length > 1 ? 3 : 2;
    }
  }
  return score;
}

function getBlazeApiBase() {
  return (process.env.BLAZE_API_BASE_URL || process.env.BLAZE_API_URL || "").trim();
}

function queryNeedsBrandSpecificAnswer(message: string, profile: AssistantDomainProfile) {
  if (inferFaqTopic(message, profile.canonicalDomain) !== "general") {
    return true;
  }
  return [
    "help",
    "offer",
    "services",
    "what do you do",
    "what can you do",
    "pricing",
    "price",
    "cost",
    "quote",
    "book",
    "booking",
    "get started",
    "human",
    "talk first",
    "talk to someone",
    "estimate",
    "after hours",
    "after-hours",
    "serve",
    "cover",
    "service area",
    "coverage",
    "refund",
    "complaint",
    "cancellation",
    "voicemail",
  ].some((token) => message.includes(token));
}

function detectDifyGuardrailReason(input: {
  answer: string;
  message: string;
  profile: AssistantDomainProfile;
}) {
  const answer = normalize(input.answer);
  const message = normalize(input.message);
  if (!answer) {
    return "empty_dify_reply";
  }

  if (GENERIC_DIFY_REPLY_MARKERS.some((marker) => answer.includes(normalize(marker)))) {
    return "dify_generic_reply";
  }

  const crossDomainMarkers = PROFILE_CROSS_DOMAIN_MARKERS[input.profile.routeKey] || [];
  if (crossDomainMarkers.some((marker) => answer.includes(normalize(marker)))) {
    return "dify_cross_domain_reply";
  }

  if (queryNeedsBrandSpecificAnswer(message, input.profile)) {
    const anchors = PROFILE_ANSWER_ANCHORS[input.profile.routeKey] || [];
    if (anchors.length > 0 && !anchors.some((anchor) => answer.includes(normalize(anchor)))) {
      return "dify_missing_brand_specifics";
    }
  }

  return null;
}

function buildFallbackAnswer(message: string, domain?: string) {
  const profile = resolveAssistantDomain(domain);
  const normalized = normalize(message);
  const ranked = profile.faqs
    .map((entry) => ({ entry, score: scoreEntry(normalized, entry.keywords) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (best && best.score > 0) {
    return {
      topic: best.entry.topic,
      answer: `${best.entry.answer} ${profile.contactPrompt}`,
    };
  }

  return {
    topic: "general",
    answer: `${profile.defaultReply} ${profile.contactPrompt}`,
  };
}

function buildDeterministicAnswer(message: string, domain?: string) {
  const profile = resolveAssistantDomain(domain);
  const normalized = normalize(message);
  const ranked = profile.faqs
    .map((entry) => ({ entry, score: scoreEntry(normalized, entry.keywords) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const second = ranked[1];
  if (!best || best.score < DIRECT_FAQ_MIN_SCORE) {
    return null;
  }
  if ((second?.score || 0) >= best.score) {
    return null;
  }

  return {
    topic: best.entry.topic,
    answer: `${best.entry.answer} ${profile.contactPrompt}`,
  };
}

function inferAuthoritativeFaqMetadata(message: string, answer: string, domain?: string) {
  const topic = inferFaqTopic(message, domain);
  if (topic === "general") {
    return null;
  }

  const authoritative = buildFallbackAnswer(message, domain);
  if (authoritative.topic !== topic) {
    return null;
  }

  const normalizedExpected = normalize(authoritative.answer);
  const normalizedActual = normalize(answer);
  if (!normalizedExpected || !normalizedActual) {
    return null;
  }

  if (
    normalizedExpected === normalizedActual ||
    normalizedExpected.includes(normalizedActual) ||
    normalizedActual.includes(normalizedExpected)
  ) {
    return {
      topic,
      guardrail: "annotation_reply" as const,
    };
  }

  return null;
}

function inferFaqTopic(message: string, domain?: string) {
  const profile = resolveAssistantDomain(domain);
  const normalized = normalize(message);
  const ranked = profile.faqs
    .map((entry) => ({ entry, score: scoreEntry(normalized, entry.keywords) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best || best.score <= 0) {
    return "general";
  }
  return best.entry.topic;
}

function toNormalizedProvenance(value: unknown): AssistantReply["metadata"]["provenance"] | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const item = value as Record<string, unknown>;
  const confidence =
    typeof item.confidence === "number"
      ? item.confidence
      : typeof item.score === "number"
        ? item.score
      : undefined;
  const normalized = {
    bindingId:
      typeof item.binding_id === "string"
        ? item.binding_id.trim()
        : typeof item.bindingId === "string"
          ? item.bindingId.trim()
          : undefined,
    sourceRef:
      typeof item.source_ref === "string"
        ? item.source_ref.trim()
        : typeof item.sourceRef === "string"
          ? item.sourceRef.trim()
          : undefined,
    sourceType:
      typeof item.source_type === "string"
        ? item.source_type.trim()
        : typeof item.sourceType === "string"
          ? item.sourceType.trim()
          : undefined,
    title: typeof item.title === "string" ? item.title.trim() : undefined,
    domain: typeof item.domain === "string" ? item.domain.trim() : undefined,
    documentId:
      typeof item.document_id === "string"
        ? item.document_id.trim()
        : typeof item.documentId === "string"
          ? item.documentId.trim()
          : undefined,
    chunkId:
      typeof item.chunk_id === "string"
        ? item.chunk_id.trim()
        : typeof item.chunkId === "string"
          ? item.chunkId.trim()
          : undefined,
    freshnessAt:
      typeof item.freshness_at === "string"
        ? item.freshness_at.trim()
        : typeof item.freshnessAt === "string"
          ? item.freshnessAt.trim()
          : undefined,
    confidence,
    provider: typeof item.provider === "string" ? item.provider.trim() : undefined,
    kind: typeof item.kind === "string" ? item.kind.trim() : undefined,
  };
  if (
    !normalized.bindingId &&
    !normalized.sourceRef &&
    !normalized.documentId &&
    !normalized.chunkId &&
    !normalized.title
  ) {
    return undefined;
  }
  return normalized;
}

async function requestBlazeDirectAnswer(input: {
  domain?: string;
  message: string;
}) {
  const blazeApi = getBlazeApiBase();
  if (!blazeApi) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 700);

  try {
    const res = await fetch(`${blazeApi.replace(/\/$/, "")}/api/customer-service/direct-answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domain: input.domain,
        query: input.message,
      }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.matched || typeof data?.answer !== "string" || !data.answer.trim()) {
      return null;
    }
    return {
      answer: data.answer.trim(),
      topic: typeof data?.topic === "string" && data.topic.trim() ? data.topic.trim() : "general",
      provider: typeof data?.provider === "string" && data.provider.trim() ? data.provider.trim() : "blaze_knowledge",
      provenance: toNormalizedProvenance(data?.provenance) || toNormalizedProvenance(data),
    };
  } catch (error) {
    console.warn("[chat] Blaze direct-answer lookup skipped:", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function requestDifyReply(input: {
  conversationId?: string;
  domain?: string;
  message: string;
  pathname?: string;
  userId: string;
}) {
  const difyBase = process.env.DIFY_BASE_URL?.trim();
  const profile = resolveAssistantDomain(input.domain);
  const difyKey =
    (profile.canonicalDomain === "astrocleanings.com"
      ? process.env.DIFY_API_KEY_ACS?.trim()
      : process.env.DIFY_API_KEY_CC?.trim()) || process.env.DIFY_API_KEY?.trim();
  if (!difyBase || !difyKey) {
    return null;
  }

  const conversationId = (input.conversationId || "").trim();
  const body: Record<string, unknown> = {
    inputs: {
      assistant_brand: profile.brandName,
      assistant_directive: profile.systemPrompt,
      domain: profile.canonicalDomain,
      knowledge_base: profile.knowledge,
      pathname: input.pathname || "/",
      route_key: profile.routeKey,
    },
    query: input.message.trim(),
    response_mode: "blocking",
    user: input.userId,
  };
  if (conversationId && isUuid(conversationId)) {
    body.conversation_id = conversationId;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DIFY_REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${difyBase.replace(/\/$/, "")}/v1/chat-messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${difyKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("[chat] Dify request timed out");
      return null;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof data?.message === "string" && data.message.trim()
        ? data.message.trim()
        : `dify_${res.status}`;

    if (message.toLowerCase().includes("workflow not published")) {
      console.warn("[chat] Dify workflow is configured but not published");
      return null;
    }

    throw new Error(message);
  }

  const metadata = data?.metadata && typeof data.metadata === "object" ? data.metadata : {};
  const annotationReply =
    metadata.annotation_reply && typeof metadata.annotation_reply === "object"
      ? metadata.annotation_reply
      : null;
  const retrieverResources = Array.isArray(metadata.retriever_resources) ? metadata.retriever_resources : [];
  const semanticMatch = inferAuthoritativeFaqMetadata(
    input.message,
    typeof data.answer === "string" ? data.answer : "",
    profile.canonicalDomain,
  );
  const inferredTopic = inferFaqTopic(input.message, profile.canonicalDomain);
  const provider = annotationReply
    ? "dify_annotation_reply"
    : retrieverResources.length > 0
      ? "dify_retriever_resource"
      : semanticMatch
        ? "dify_semantic_match"
        : "dify";
  const guardrail = annotationReply
    ? "annotation_reply"
    : retrieverResources.length > 0
      ? "retriever_resource"
      : semanticMatch?.guardrail;
  const provenance =
    toNormalizedProvenance(annotationReply)
    || toNormalizedProvenance(retrieverResources[0])
    || toNormalizedProvenance((metadata as Record<string, unknown>).provenance);

  return {
    answer: data.answer || `${profile.defaultReply} ${profile.contactPrompt}`,
    conversationId: data.conversation_id || input.conversationId || crypto.randomUUID(),
    metadata: {
      mode: "dify" as const,
      provider,
      guardrail,
      topic: semanticMatch?.topic || inferredTopic,
      domain: profile.canonicalDomain,
      provenance,
    },
  };
}

export async function answerSiteAssistantChat(input: {
  conversationId?: string;
  domain?: string;
  message: string;
  pathname?: string;
  userId?: string;
}): Promise<AssistantReply> {
  const message = input.message.trim();
  const profile = resolveAssistantDomain(input.domain);
  const conversationId = (input.conversationId || "").trim();
  const userId = (input.userId || "").trim() || `web-${Date.now()}`;
  const businessUnit = profile.canonicalDomain === "astrocleanings.com" ? "ACS" : "CC";
  let guardrailReason: string | null = null;
  let guardrailConversationId = conversationId || "";

  try {
    const difyReply = await requestDifyReply({
      message,
      conversationId,
      userId,
      domain: profile.canonicalDomain,
      pathname: input.pathname,
    });
    if (difyReply) {
      const detectedGuardrail = detectDifyGuardrailReason({
        answer: difyReply.answer,
        message,
        profile,
      });
      if (detectedGuardrail) {
        guardrailReason = detectedGuardrail;
        guardrailConversationId = difyReply.conversationId;
        console.warn("[chat] Dify quality guardrail engaged:", detectedGuardrail);
      } else {
        await emitBlazeCustomerEvent({
          businessUnit,
          channel: "dify",
          conversationId: difyReply.conversationId,
          domain: profile.canonicalDomain,
          guardrail: difyReply.metadata.guardrail,
          message,
          replyMode: "dify",
          answer: difyReply.answer,
          pathname: input.pathname,
          provider: difyReply.metadata.provider,
          provenance: difyReply.metadata.provenance,
          topic: difyReply.metadata.topic,
          userId,
        });
        return difyReply;
      }
    }
  } catch (error) {
    console.error("[chat] Dify fallback engaged:", error);
  }

  const blazeDirect = await requestBlazeDirectAnswer({
    message,
    domain: profile.canonicalDomain,
  });
  if (blazeDirect) {
    const blazeConversationId = guardrailConversationId || conversationId || crypto.randomUUID();
    const reply: AssistantReply = {
      answer: blazeDirect.answer,
      conversationId: blazeConversationId,
      metadata: {
        mode: "fallback",
        topic: blazeDirect.topic,
        domain: profile.canonicalDomain,
        provider: blazeDirect.provider,
        guardrail: "annotation_reply",
        provenance: blazeDirect.provenance,
      },
    };
    await emitBlazeCustomerEvent({
      businessUnit,
      channel: "web_chat",
      conversationId: blazeConversationId,
      domain: profile.canonicalDomain,
      guardrail: "annotation_reply",
      message,
      replyMode: "fallback",
      answer: reply.answer,
      pathname: input.pathname,
      provider: blazeDirect.provider,
      provenance: blazeDirect.provenance,
      topic: blazeDirect.topic,
      userId,
    });
    return reply;
  }

  const deterministic = buildDeterministicAnswer(message, profile.canonicalDomain);
  if (deterministic) {
    const deterministicConversationId = guardrailConversationId || conversationId || crypto.randomUUID();
    const reply: AssistantReply = {
      answer: deterministic.answer,
      conversationId: deterministicConversationId,
      metadata: {
        mode: "fallback",
        topic: deterministic.topic,
        domain: profile.canonicalDomain,
        provider: "deterministic_faq",
        guardrail: "annotation_reply",
      },
    };
    await emitBlazeCustomerEvent({
      businessUnit,
      channel: "web_chat",
      conversationId: deterministicConversationId,
      domain: profile.canonicalDomain,
      guardrail: "annotation_reply",
      message,
      replyMode: "fallback",
      answer: reply.answer,
      pathname: input.pathname,
      provider: "deterministic_faq",
      topic: deterministic.topic,
      userId,
    });
    return reply;
  }

  const fallback = buildFallbackAnswer(message, profile.canonicalDomain);
  const fallbackConversationId = guardrailConversationId || conversationId || crypto.randomUUID();
  const reply: AssistantReply = {
    answer: fallback.answer,
    conversationId: fallbackConversationId,
    metadata: {
      mode: "fallback",
      topic: fallback.topic,
      domain: profile.canonicalDomain,
      provider: "guardrail_fallback",
      guardrail: guardrailReason || undefined,
    },
  };
  await emitBlazeCustomerEvent({
    businessUnit,
    channel: "web_chat",
    conversationId: fallbackConversationId,
    domain: profile.canonicalDomain,
    guardrail: guardrailReason || undefined,
    message,
    replyMode: "fallback",
    answer: reply.answer,
    pathname: input.pathname,
    provider: "guardrail_fallback",
    topic: fallback.topic,
    userId,
  });
  return reply;
}
