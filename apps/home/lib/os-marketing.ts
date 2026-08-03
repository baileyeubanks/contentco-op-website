// @ts-nocheck
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { BOOKING_CALENDAR_URL } from "@/lib/public-booking";
import { hydrateStructuredCreativeBriefIntake } from "@/lib/creative-brief";
import { getSupabase } from "@/lib/supabase";
import {
  portfolioFeaturedStudies,
  portfolioFlagshipStudy,
  portfolioStats,
  portfolioSupportingStudies,
  portfolioStudies,
} from "@/lib/content/portfolio";
import type { RootBrandKey } from "@/lib/root-brand";

type FileFreshness = {
  path: string;
  modifiedAt: string | null;
};

type AssetBreakdown = {
  label: string;
  count: number;
};

type ContentQueueItem = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  createdAt: string | null;
  href?: string;
};

export type RootMarketingSnapshot = {
  workspace: RootBrandKey;
  authority: {
    title: string;
    publicUrl: string;
    localPath: string;
    freshness: FileFreshness;
  };
  rootAuthority: {
    publicUrl: string;
    localPath: string;
    freshness: FileFreshness;
  };
  publicSurfaces: Array<{
    label: string;
    url: string;
    note: string;
  }>;
  assetSummary: {
    total: number;
    buckets: AssetBreakdown[];
    basePath: string;
  };
  workflow: {
    headline: string;
    totals: Array<{ label: string; value: string; note: string }>;
    queue: ContentQueueItem[];
  };
};

export type RootMarketingBriefListItem = {
  id: string;
  title: string;
  company: string | null;
  contentType: string;
  recommendation: string | null;
  status: string;
  createdAt: string | null;
  quoteReady: boolean;
  blockers: string[];
  missingFields: string[];
  deliverables: string[];
  href: string;
};

export type RootMarketingWorkflowLaneItem = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  href?: string;
  note?: string;
};

export type RootMarketingWorkflowLane = {
  id: string;
  label: string;
  description: string;
  count: number;
  items: RootMarketingWorkflowLaneItem[];
};

export type RootMarketingWorkflowSnapshot = {
  workspace: RootBrandKey;
  headline: string;
  lanes: RootMarketingWorkflowLane[];
};

export type RootMarketingProofMetric = {
  label: string;
  value: string;
  note: string;
};

export type RootMarketingProofItem = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  note?: string;
  href?: string;
};

export type RootMarketingProofSection = {
  id: string;
  label: string;
  description: string;
  count: number;
  items: RootMarketingProofItem[];
};

export type RootMarketingProofSnapshot = {
  workspace: RootBrandKey;
  headline: string;
  metrics: RootMarketingProofMetric[];
  sections: RootMarketingProofSection[];
  sourceNotes: Array<{ label: string; value: string }>;
  primaryAction: {
    label: string;
    href: string;
    note: string;
  };
};

export type RootMarketingExecutionMetric = {
  label: string;
  value: string;
  note: string;
};

export type RootMarketingExecutionItem = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  note?: string;
  href?: string;
  details?: string[];
  badges?: string[];
};

export type RootMarketingExecutionSection = {
  id: string;
  label: string;
  description: string;
  count: number;
  items: RootMarketingExecutionItem[];
};

export type RootMarketingExecutionSnapshot = {
  workspace: RootBrandKey;
  headline: string;
  metrics: RootMarketingExecutionMetric[];
  sections: RootMarketingExecutionSection[];
  sourceNotes: Array<{ label: string; value: string }>;
  primaryAction: {
    label: string;
    href: string;
    note: string;
  };
};

export type RootMarketingBriefDetail = {
  id: string;
  workspace: RootBrandKey;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  source: {
    submissionMode: string;
    bookingIntent: string;
    sourcePath: string;
  };
  contact: {
    name: string;
    email: string;
    phone: string | null;
    company: string | null;
    role: string | null;
    location: string | null;
  };
  project: {
    contentType: string;
    recommendation: string | null;
    likelyScope: string | null;
    productionLevel: string | null;
    nextStep: string | null;
    deliverables: string[];
    audience: string | null;
    tone: string | null;
    deadline: string | null;
    objective: string | null;
    keyMessages: string | null;
    references: string | null;
    constraints: string | null;
  };
  readiness: {
    quoteReady: boolean;
    intakeComplete: boolean;
    blockers: string[];
    missingFields: string[];
  };
  history: Array<{
    id: string;
    status: string;
    note: string | null;
    createdAt: string | null;
  }>;
  relatedQuotes: Array<{
    id: string;
    quoteNumber: string | null;
    internalStatus: string | null;
    clientStatus: string | null;
    estimatedTotal: number | null;
    createdAt: string | null;
  }>;
};

function sentenceCase(value: string) {
  if (!value) return value;
  return value.replaceAll(/_/g, " ").replaceAll(/\s+/g, " ").trim();
}

function uniqueCompact(values: Array<string | null | undefined>, limit = 4) {
  return Array.from(new Set(
    values
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean),
  )).slice(0, limit);
}

function preferredBriefProjectLabel(brief: Pick<RootMarketingBriefListItem, "recommendation" | "contentType">) {
  return brief.recommendation || brief.contentType || "creative brief";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function briefHasStructuredFallbackPayload(brief: Record<string, unknown>) {
  return isRecord(brief.structured_intake) || isRecord(brief.intake_payload);
}

function mergeBriefWithSubmittedPayload(
  brief: Record<string, unknown>,
  payload: Record<string, unknown> | null,
) {
  if (!payload) {
    return brief;
  }

  return {
    ...brief,
    structured_intake: isRecord(payload.structured_intake) ? payload.structured_intake : brief.structured_intake,
    intake_payload: isRecord(payload.intake_payload)
      ? payload.intake_payload
      : isRecord(payload.intake)
        ? payload.intake
        : brief.intake_payload,
  };
}

async function getLatestBriefSubmittedPayloads(briefIds: string[]) {
  if (briefIds.length === 0) {
    return new Map<string, Record<string, unknown>>();
  }

  const supabase = getSupabase();
  const requestedIds = new Set(briefIds.map((id) => String(id)));
  const { data, error } = await supabase
    .from("events")
    .select("payload, created_at")
    .eq("type", "brief_submitted")
    .order("created_at", { ascending: false })
    .limit(Math.max(requestedIds.size * 6, 60));

  if (error || !data) {
    return new Map<string, Record<string, unknown>>();
  }

  const payloads = new Map<string, Record<string, unknown>>();
  for (const event of data) {
    if (!isRecord(event.payload)) {
      continue;
    }
    const briefId = event.payload.brief_id ? String(event.payload.brief_id) : "";
    if (!briefId || !requestedIds.has(briefId) || payloads.has(briefId)) {
      continue;
    }
    payloads.set(briefId, event.payload);
    if (payloads.size === requestedIds.size) {
      break;
    }
  }

  return payloads;
}

function formatCompactDate(value: string | null) {
  if (!value) return "unknown";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

async function getFileFreshness(filePath: string): Promise<FileFreshness> {
  try {
    const fileStat = await stat(filePath);
    return {
      path: filePath,
      modifiedAt: fileStat.mtime.toISOString(),
    };
  } catch {
    return {
      path: filePath,
      modifiedAt: null,
    };
  }
}

async function countFilesRecursive(directoryPath: string): Promise<number> {
  try {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    let total = 0;
    for (const entry of entries) {
      const fullPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        total += await countFilesRecursive(fullPath);
      } else {
        total += 1;
      }
    }
    return total;
  } catch {
    return 0;
  }
}

async function buildAssetSummary(workspace: RootBrandKey) {
  const basePath = workspace === "acs"
    ? "/Users/baileyeubanks/Desktop/Projects/brand/assets/acs"
    : "/Users/baileyeubanks/Desktop/Projects/brand/assets/cco";

  const buckets = workspace === "acs"
    ? [
      { label: "photography", path: path.join(basePath, "photography") },
      { label: "motion", path: path.join(basePath, "motion") },
      { label: "logos", path: path.join(basePath, "logos") },
      { label: "icons + exports", path: path.join(basePath, "icons") },
    ]
    : [
      { label: "photography", path: path.join(basePath, "photography") },
      { label: "motion", path: path.join(basePath, "motion") },
      { label: "logos", path: path.join(basePath, "logos") },
      { label: "avatars + exports", path: path.join(basePath, "avatars") },
    ];

  const counts = await Promise.all(
    buckets.map(async (bucket) => ({
      label: bucket.label,
      count: await countFilesRecursive(bucket.path),
    })),
  );

  return {
    total: counts.reduce((sum, bucket) => sum + bucket.count, 0),
    buckets: counts,
    basePath,
  };
}

async function buildCcoWorkflow() {
  const supabase = getSupabase();
  const [{ count }, briefsRes] = await Promise.all([
    supabase.from("creative_briefs").select("id", { count: "exact", head: true }),
    supabase
      .from("creative_briefs")
      .select("id, contact_name, company, content_type, status, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const queue: ContentQueueItem[] = (briefsRes.data || []).map((brief) => ({
    id: String(brief.id),
    title: String(brief.contact_name || "creative brief"),
    subtitle: [brief.company, brief.content_type].filter(Boolean).join(" · ") || "public brief intake",
    status: String(brief.status || "new"),
    createdAt: brief.created_at ? String(brief.created_at) : null,
    href: `/root/marketing/briefs/${brief.id}`,
  }));

  return {
    headline: "brand authority, case-study proof, and creative brief intake feed the cco content system.",
    totals: [
      { label: "creative briefs", value: String(count || 0), note: "public intake records in Supabase" },
      { label: "case studies", value: String(portfolioStats.caseStudies), note: "portfolio manifest entries" },
      { label: "featured proof", value: String(portfolioFeaturedStudies.length), note: "flagship studies on deck" },
      { label: "deliverables", value: String(portfolioStats.deliverables), note: "deliverables indexed in portfolio manifest" },
    ],
    queue,
  };
}

async function buildAcsWorkflow() {
  const supabase = getSupabase();
  const windowStart = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString();
  const [{ count }, quotesRes] = await Promise.all([
    supabase
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .eq("business_unit", "ACS")
      .gte("created_at", windowStart),
    supabase
      .from("quotes")
      .select("id, quote_number, client_name, status, client_status, created_at")
      .eq("business_unit", "ACS")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const queue: ContentQueueItem[] = (quotesRes.data || []).map((quote) => ({
    id: String(quote.id),
    title: String(quote.client_name || quote.quote_number || "acs quote"),
    subtitle: String(quote.quote_number || "public quote request"),
    status: String(quote.client_status || quote.status || "new"),
    createdAt: quote.created_at ? String(quote.created_at) : null,
    href: `/root/quotes/${quote.id}`,
  }));

  return {
    headline: "brand authority, public trust assets, and quote-funnel activity shape the acs marketing lane.",
    totals: [
      { label: "quote requests", value: String(count || 0), note: "acs quotes created in the last 30 days" },
      { label: "motion assets", value: "3", note: "hero + reel assets in canonical brand motion" },
      { label: "photo assets", value: "15", note: "crew and home imagery in canonical photography" },
      { label: "icon pack", value: "5", note: "favicons and app icons in canonical exports" },
    ],
    queue,
  };
}

export async function getRootMarketingSnapshot(workspace: RootBrandKey): Promise<RootMarketingSnapshot> {
  const authority = workspace === "acs"
    ? {
      title: "ACS Brand Central",
      publicUrl: "https://astrocleanings.com/brandcentral",
      localPath: "/Users/baileyeubanks/Desktop/Projects/brand/docs/brand-central/acs.html",
    }
    : {
      title: "Content Co-op Brand Central",
      publicUrl: "https://contentco-op.com/brandcentral",
      localPath: "/Users/baileyeubanks/Desktop/Projects/brand/docs/brand-central/cc.html",
    };

  const rootAuthority = {
    publicUrl: workspace === "acs" ? "https://astrocleanings.com/brandcentral/root" : "https://contentco-op.com/brandcentral/root",
    localPath: "/Users/baileyeubanks/Desktop/Projects/brand/docs/brand-central/root.html",
  };

  const publicSurfaces = workspace === "acs"
    ? [
      { label: "public site", url: "https://astrocleanings.com", note: "primary marketing surface" },
      { label: "brand central", url: "https://astrocleanings.com/brandcentral", note: "canonical visual/voice authority" },
      { label: "root login", url: "https://astrocleanings.com/root", note: "operator entry from ACS host" },
    ]
    : [
      { label: "public site", url: "https://contentco-op.com", note: "primary marketing surface" },
      { label: "portfolio", url: "https://contentco-op.com/portfolio", note: "selected-work proof surface" },
      { label: "brief intake", url: "https://contentco-op.com/brief", note: "creative brief public intake" },
      { label: "brand central", url: "https://contentco-op.com/brandcentral", note: "canonical visual/voice authority" },
    ];

  return {
    workspace,
    authority: {
      ...authority,
      freshness: await getFileFreshness(authority.localPath),
    },
    rootAuthority: {
      ...rootAuthority,
      freshness: await getFileFreshness(rootAuthority.localPath),
    },
    publicSurfaces,
    assetSummary: await buildAssetSummary(workspace),
    workflow: workspace === "acs" ? await buildAcsWorkflow() : await buildCcoWorkflow(),
  };
}

export async function getRootMarketingBriefQueue(workspace: RootBrandKey): Promise<RootMarketingBriefListItem[]> {
  if (workspace !== "cc") {
    return [];
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("creative_briefs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(24);

  if (error || !data) {
    return [];
  }

  const fallbackPayloads = await getLatestBriefSubmittedPayloads(
    data
      .filter((brief) => !briefHasStructuredFallbackPayload(brief as unknown as Record<string, unknown>))
      .map((brief) => String(brief.id)),
  );

  return data.map((brief) => {
    const mergedBrief = mergeBriefWithSubmittedPayload(
      brief as unknown as Record<string, unknown>,
      fallbackPayloads.get(String(brief.id)) || null,
    );
    const structured = hydrateStructuredCreativeBriefIntake(
      mergedBrief,
      BOOKING_CALENDAR_URL,
    );

    return {
      id: String(brief.id),
      title: structured.contact.name || structured.contact.company || "creative brief",
      company: structured.contact.company || null,
      contentType: structured.project.content_type || "unknown",
      recommendation: structured.recommendation?.recommended_video_type || null,
      status: String(brief.status || "new"),
      createdAt: brief.created_at ? String(brief.created_at) : null,
      quoteReady: structured.readiness.quote_ready,
      blockers: structured.readiness.blockers,
      missingFields: structured.readiness.missing_fields,
      deliverables: structured.project.deliverables,
      href: `/root/marketing/briefs/${brief.id}`,
    };
  });
}

export async function getRootMarketingWorkflowSnapshot(
  workspace: RootBrandKey,
): Promise<RootMarketingWorkflowSnapshot> {
  if (workspace === "cc") {
    const briefQueue = await getRootMarketingBriefQueue("cc");
    const supabase = getSupabase();
    const briefIds = briefQueue.map((brief) => brief.id);
    const draftEventsRes = briefIds.length > 0
      ? await supabase
        .from("events")
        .select("payload, created_at")
        .eq("type", "cc_quote_draft_created")
        .in("channel", ["root", "internal"])
      : { data: [], error: null };

    const quoteIds = Array.from(new Set(
      (draftEventsRes.data || [])
        .map((event) => {
          const payload = event.payload as Record<string, unknown> | null;
          const briefId = payload?.brief_id ? String(payload.brief_id) : null;
          const quoteId = payload?.quote_id ? String(payload.quote_id) : null;
          return briefId && quoteId && briefIds.includes(briefId) ? quoteId : null;
        })
        .filter((value): value is string => Boolean(value)),
    ));

    const quotesRes = quoteIds.length > 0
      ? await supabase
        .from("quotes")
        .select("id, client_name, quote_number, internal_status, client_status, estimated_total")
        .in("id", quoteIds)
      : { data: [], error: null };

    const quotesById = new Map((quotesRes.data || []).map((quote) => [String(quote.id), quote]));
    const draftEventByBrief = new Map<string, string[]>();
    for (const event of draftEventsRes.data || []) {
      const payload = event.payload as Record<string, unknown> | null;
      const briefId = payload?.brief_id ? String(payload.brief_id) : null;
      const quoteId = payload?.quote_id ? String(payload.quote_id) : null;
      if (!briefId || !quoteId || !briefIds.includes(briefId)) continue;
      const existing = draftEventByBrief.get(briefId) || [];
      existing.push(quoteId);
      draftEventByBrief.set(briefId, existing);
    }

    const intake: RootMarketingWorkflowLaneItem[] = [];
    const ready: RootMarketingWorkflowLaneItem[] = [];
    const drafting: RootMarketingWorkflowLaneItem[] = [];
    const contracted: RootMarketingWorkflowLaneItem[] = [];

    for (const brief of briefQueue) {
      const relatedQuoteIds = draftEventByBrief.get(brief.id) || [];
      const relatedQuotes = relatedQuoteIds
        .map((id) => quotesById.get(id))
        .filter((value): value is NonNullable<typeof value> => Boolean(value));
      const latestQuote = relatedQuotes[0] || null;
      const laneItem: RootMarketingWorkflowLaneItem = {
        id: brief.id,
        title: brief.title,
        subtitle: [brief.company, preferredBriefProjectLabel(brief)].filter(Boolean).join(" · ") || "creative brief",
        status: brief.status,
        href: brief.href,
        note: brief.quoteReady
          ? "quote-ready intake"
          : brief.blockers.length > 0
            ? `needs ${brief.blockers.join(", ").replace(/_/g, " ")}`
            : "needs scope cleanup",
      };

      if (latestQuote) {
        const commercialStatus = String(latestQuote.client_status || latestQuote.internal_status || "pending");
        const contractedStatus = ["accepted", "ready_to_invoice", "approved"].includes(commercialStatus.toLowerCase());
        const itemWithQuote: RootMarketingWorkflowLaneItem = {
          ...laneItem,
          title: latestQuote.client_name ? String(latestQuote.client_name) : laneItem.title,
          subtitle: [latestQuote.quote_number, laneItem.subtitle].filter(Boolean).join(" · "),
          status: commercialStatus,
          note: latestQuote.estimated_total != null
            ? `estimated ${Number(latestQuote.estimated_total).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`
            : laneItem.note,
          href: `/root/quotes/${latestQuote.id}`,
        };
        if (contractedStatus) {
          contracted.push(itemWithQuote);
        } else {
          drafting.push(itemWithQuote);
        }
      } else if (brief.quoteReady) {
        ready.push(laneItem);
      } else {
        intake.push(laneItem);
      }
    }

    return {
      workspace,
      headline: "Content Co-op moves from intake to quote draft to contracted scope through the marketing + content engine.",
      lanes: [
        { id: "intake", label: "intake triage", description: "briefs that still need scope cleanup or operator follow-up", count: intake.length, items: intake.slice(0, 8) },
        { id: "ready", label: "ready for quote", description: "quote-ready briefs with no draft yet", count: ready.length, items: ready.slice(0, 8) },
        { id: "drafting", label: "commercial in motion", description: "draft quotes currently in review or pending send", count: drafting.length, items: drafting.slice(0, 8) },
        { id: "contracted", label: "contracted scope", description: "accepted or invoice-ready work flowing into delivery", count: contracted.length, items: contracted.slice(0, 8) },
      ],
    };
  }

  const supabase = getSupabase();
  const windowStart = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString();
  const quotesRes = await supabase
    .from("quotes")
    .select("id, quote_number, client_name, client_status, status, created_at")
    .eq("business_unit", "ACS")
    .gte("created_at", windowStart)
    .order("created_at", { ascending: false })
    .limit(24);

  const snapshot = await getRootMarketingSnapshot("acs");
  const inbound: RootMarketingWorkflowLaneItem[] = [];
  const followUp: RootMarketingWorkflowLaneItem[] = [];
  const booked: RootMarketingWorkflowLaneItem[] = [];
  const trustAssets: RootMarketingWorkflowLaneItem[] = snapshot.assetSummary.buckets.map((bucket) => ({
    id: bucket.label,
    title: bucket.label,
    subtitle: `canonical assets in ${snapshot.assetSummary.basePath}`,
    status: bucket.count > 0 ? "live" : "empty",
    note: `${bucket.count} assets available`,
  }));

  for (const quote of quotesRes.data || []) {
    const clientStatus = String(quote.client_status || quote.status || "new");
    const item: RootMarketingWorkflowLaneItem = {
      id: String(quote.id),
      title: String(quote.client_name || quote.quote_number || "acs quote"),
      subtitle: String(quote.quote_number || "quote request"),
      status: clientStatus,
      href: `/root/quotes/${quote.id}`,
      note: quote.created_at ? `created ${new Date(String(quote.created_at)).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : undefined,
    };
    const normalized = clientStatus.toLowerCase();
    if (["accepted", "approved", "ready_to_invoice"].includes(normalized)) {
      booked.push(item);
    } else if (["sent", "pending", "pending_internal", "not_sent"].includes(normalized)) {
      followUp.push(item);
    } else {
      inbound.push(item);
    }
  }

  return {
    workspace,
    headline: "Astro Cleanings uses the marketing lane to keep quote demand, trust assets, and booked work in one operator view.",
    lanes: [
      { id: "inbound", label: "new quote demand", description: "recent inbound requests entering the ACS funnel", count: inbound.length, items: inbound.slice(0, 8) },
      { id: "follow-up", label: "quote follow-up", description: "quotes in motion that still need send or follow-through", count: followUp.length, items: followUp.slice(0, 8) },
      { id: "booked", label: "booked work", description: "accepted work moving toward dispatch and invoicing", count: booked.length, items: booked.slice(0, 8) },
      { id: "trust-assets", label: "trust assets", description: "canonical ACS assets supporting public trust and conversion", count: trustAssets.length, items: trustAssets.slice(0, 8) },
    ],
  };
}

export async function getRootMarketingBriefDetail(
  workspace: RootBrandKey,
  briefId: string,
): Promise<RootMarketingBriefDetail | null> {
  if (workspace !== "cc") {
    return null;
  }

  const supabase = getSupabase();
  const { data: brief, error } = await supabase
    .from("creative_briefs")
    .select("*")
    .eq("id", briefId)
    .maybeSingle();

  if (error || !brief) {
    return null;
  }

  const fallbackPayloads = briefHasStructuredFallbackPayload(brief as unknown as Record<string, unknown>)
    ? new Map<string, Record<string, unknown>>()
    : await getLatestBriefSubmittedPayloads([briefId]);
  const mergedBrief = mergeBriefWithSubmittedPayload(
    brief as unknown as Record<string, unknown>,
    fallbackPayloads.get(briefId) || null,
  );

  const structured = hydrateStructuredCreativeBriefIntake(
    mergedBrief,
    BOOKING_CALENDAR_URL,
  );

  const [historyRes, draftEventsRes] = await Promise.all([
    supabase
      .from("brief_status_history")
      .select("id, status, notes, created_at")
      .eq("brief_id", briefId)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("events")
      .select("payload, created_at")
      .eq("type", "cc_quote_draft_created")
      .contains("payload", { brief_id: briefId })
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const quoteIds = Array.from(new Set(
    (draftEventsRes.data || [])
      .map((event) => {
        const payload = event.payload as Record<string, unknown> | null;
        const quoteId = payload?.quote_id;
        return quoteId ? String(quoteId) : null;
      })
      .filter((value): value is string => Boolean(value)),
  ));

  const relatedQuotesRes = quoteIds.length > 0
    ? await supabase
      .from("quotes")
      .select("id, quote_number, internal_status, client_status, estimated_total, created_at")
      .in("id", quoteIds)
      .order("created_at", { ascending: false })
    : { data: [], error: null };

  return {
    id: String(brief.id),
    workspace,
    status: String(brief.status || "new"),
    createdAt: brief.created_at ? String(brief.created_at) : null,
    updatedAt: brief.updated_at ? String(brief.updated_at) : null,
    source: {
      submissionMode: String(brief.submission_mode || structured.routing.submission_mode || "form"),
      bookingIntent: String(brief.booking_intent || structured.routing.booking_intent || "decide_after_brief"),
      sourcePath: String(brief.source_path || structured.routing.source_path || "/brief"),
    },
      contact: {
        name: structured.contact.name,
      email: structured.contact.email,
      phone: structured.contact.phone || null,
      company: structured.contact.company || null,
      role: structured.contact.role || null,
      location: structured.contact.location || null,
    },
      project: {
        contentType: structured.project.content_type,
        recommendation: structured.recommendation?.recommended_video_type || null,
        likelyScope: structured.recommendation?.likely_scope || null,
        productionLevel: structured.recommendation?.estimated_production_level || null,
        nextStep: structured.recommendation?.next_step || null,
        deliverables: structured.project.deliverables,
        audience: structured.project.audience || null,
      tone: structured.project.tone || null,
      deadline: structured.project.deadline || null,
      objective: structured.project.objective || null,
      keyMessages: structured.project.key_messages,
      references: structured.project.references,
      constraints: structured.project.constraints,
    },
    readiness: {
      quoteReady: structured.readiness.quote_ready,
      intakeComplete: structured.readiness.intake_complete,
      blockers: structured.readiness.blockers,
      missingFields: structured.readiness.missing_fields,
    },
    history: (historyRes.data || []).map((entry) => ({
      id: String(entry.id),
      status: String(entry.status || "updated"),
      note: entry.notes ? String(entry.notes) : null,
      createdAt: entry.created_at ? String(entry.created_at) : null,
    })),
    relatedQuotes: (relatedQuotesRes.data || []).map((quote) => ({
      id: String(quote.id),
      quoteNumber: quote.quote_number ? String(quote.quote_number) : null,
      internalStatus: quote.internal_status ? String(quote.internal_status) : null,
      clientStatus: quote.client_status ? String(quote.client_status) : null,
      estimatedTotal: typeof quote.estimated_total === "number" ? quote.estimated_total : null,
      createdAt: quote.created_at ? String(quote.created_at) : null,
    })),
  };
}

export async function getRootMarketingProofSnapshot(
  workspace: RootBrandKey,
): Promise<RootMarketingProofSnapshot> {
  if (workspace === "cc") {
    const approvedStudies = portfolioStudies.filter((study) => study.review?.status === "approved");
    const reviewBacklog = portfolioStudies.filter((study) => study.review?.status !== "approved");
    const galleryFrames = portfolioStudies.reduce((sum, study) => sum + (study.gallery?.length || 0), 0);
    const reviewedThisMonth = approvedStudies.filter((study) => {
      const reviewedAt = study.review?.reviewedAt;
      if (!reviewedAt) return false;
      return Date.now() - new Date(reviewedAt).getTime() <= 31 * 24 * 60 * 60 * 1000;
    }).length;

    return {
      workspace,
      headline: "Content Co-op uses the marketing engine to keep proof, review status, and delivery-ready case studies visible inside ROOT.",
      metrics: [
        { label: "approved studies", value: String(approvedStudies.length), note: "case studies cleared for public proof" },
        { label: "deliverables indexed", value: String(portfolioStats.deliverables), note: "deliverables attached across the portfolio manifest" },
        { label: "gallery frames", value: String(galleryFrames), note: "proof stills and support imagery in the portfolio manifest" },
        { label: "recent reviews", value: String(reviewedThisMonth), note: "studies reviewed in the last 31 days" },
      ],
      sections: [
        {
          id: "flagship-proof",
          label: "flagship proof",
          description: "the lead case study anchoring public credibility and sales conversations",
          count: 1,
          items: [{
            id: portfolioFlagshipStudy.id,
            title: portfolioFlagshipStudy.client,
            subtitle: `${portfolioFlagshipStudy.title} · ${portfolioFlagshipStudy.format}`,
            status: portfolioFlagshipStudy.review?.status || "review",
            note: `${portfolioFlagshipStudy.deliverables.length} deliverables · reviewed ${formatCompactDate(portfolioFlagshipStudy.review?.reviewedAt || null)}`,
            href: "https://contentco-op.com/portfolio",
          }],
        },
        {
          id: "featured-proof",
          label: "featured proof",
          description: "case studies ready to support pitch, proposal, and public proof surfaces",
          count: portfolioFeaturedStudies.length,
          items: portfolioFeaturedStudies.map((study) => ({
            id: study.id,
            title: study.client,
            subtitle: `${study.title} · ${study.sector}`,
            status: study.review?.status || "review",
            note: `${study.deliverables.length} deliverables · ${study.gallery.length} gallery assets`,
            href: "https://contentco-op.com/portfolio",
          })),
        },
        {
          id: "delivery-bench",
          label: "delivery bench",
          description: "supporting work that can be promoted into featured proof or repurposed into delivery references",
          count: portfolioSupportingStudies.length,
          items: portfolioSupportingStudies.slice(0, 6).map((study) => ({
            id: study.id,
            title: study.client,
            subtitle: `${study.title} · ${study.year}`,
            status: study.review?.status || "review",
            note: `${study.deliverables.length} deliverables · ${study.format}`,
            href: "https://contentco-op.com/portfolio",
          })),
        },
        {
          id: "review-backlog",
          label: "review backlog",
          description: "proof items that still need formal review before they should be treated as public authority",
          count: reviewBacklog.length,
          items: reviewBacklog.slice(0, 6).map((study) => ({
            id: study.id,
            title: study.client,
            subtitle: `${study.title} · ${study.sector}`,
            status: study.review?.status || "pending_review",
            note: study.review?.notes || "needs portfolio review and proof verification",
            href: "https://contentco-op.com/portfolio",
          })),
        },
      ],
      sourceNotes: [
        { label: "portfolio authority", value: "/Users/baileyeubanks/Desktop/Projects/contentco-op/monorepo/apps/home/lib/content/portfolio-manifest.json" },
        { label: "brand authority", value: "/Users/baileyeubanks/Desktop/Projects/brand/docs/brand-central/cc.html" },
      ],
      primaryAction: {
        label: "open portfolio",
        href: "https://contentco-op.com/portfolio",
        note: "public proof surface sourced from the reviewed portfolio manifest",
      },
    };
  }

  const supabase = getSupabase();
  const windowStart = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString();

  const customerReviewsRes = await supabase
    .from("customer_reviews")
    .select("id,rating,comment,source,reviewer_name,is_public,is_featured,status,created_at,sentiment")
    .order("created_at", { ascending: false })
    .limit(24);

  const reviewsRes = (!customerReviewsRes.data || customerReviewsRes.data.length === 0)
    ? await supabase
      .from("reviews")
      .select("id,rating,comment,source,created_at,sentiment")
      .order("created_at", { ascending: false })
      .limit(24)
    : { data: [], error: null };

  const completedJobsRes = await supabase
    .from("jobs")
    .select("id,title,status,scheduled_date,completed_at")
    .eq("business_unit", "ACS")
    .not("completed_at", "is", null)
    .gte("completed_at", windowStart)
    .order("completed_at", { ascending: false })
    .limit(12);

  const canonicalReviews = (customerReviewsRes.data && customerReviewsRes.data.length > 0)
    ? customerReviewsRes.data.map((row) => ({
      id: String(row.id),
      rating: typeof row.rating === "number" ? row.rating : null,
      comment: row.comment ? String(row.comment) : null,
      source: row.source ? String(row.source) : "direct",
      reviewerName: row.reviewer_name ? String(row.reviewer_name) : null,
      createdAt: row.created_at ? String(row.created_at) : null,
      sentiment: row.sentiment ? String(row.sentiment) : null,
      featured: Boolean(row.is_featured),
      published: row.status ? String(row.status) === "published" : Boolean(row.is_public),
    }))
    : (reviewsRes.data || []).map((row) => ({
      id: String(row.id),
      rating: typeof row.rating === "number" ? row.rating : null,
      comment: row.comment ? String(row.comment) : null,
      source: row.source ? String(row.source) : "direct",
      reviewerName: null,
      createdAt: row.created_at ? String(row.created_at) : null,
      sentiment: row.sentiment ? String(row.sentiment) : null,
      featured: (typeof row.rating === "number" ? row.rating : 0) >= 5,
      published: (typeof row.rating === "number" ? row.rating : 0) >= 4,
    }));

  const publishedReviews = canonicalReviews.filter((review) => review.published);
  const featuredReviews = canonicalReviews.filter((review) => review.featured || (review.rating || 0) >= 5);
  const avgRating = publishedReviews.length > 0
    ? (publishedReviews.reduce((sum, review) => sum + (review.rating || 0), 0) / publishedReviews.length).toFixed(1)
    : "0.0";

  const completedJobs = (completedJobsRes.data || []).map((job) => ({
    id: String(job.id),
    title: String(job.title || "completed job"),
    status: String(job.status || "completed"),
    completedAt: job.completed_at ? String(job.completed_at) : null,
    scheduledDate: job.scheduled_date ? String(job.scheduled_date) : null,
  }));

  return {
    workspace,
    headline: "Astro Cleanings uses the marketing engine to keep review velocity, trust proof, and post-job reputation follow-through visible inside ROOT.",
    metrics: [
      { label: "published reviews", value: String(publishedReviews.length), note: "reviews available for testimonial or trust use" },
      { label: "average rating", value: avgRating, note: "average across published reviews surfaced from Supabase" },
      { label: "featured testimonials", value: String(featuredReviews.length), note: "reviews that can anchor trust and public proof" },
      { label: "jobs completed (30d)", value: String(completedJobs.length), note: "recent ACS jobs that can feed review and reputation follow-up" },
    ],
    sections: [
      {
        id: "recent-reviews",
        label: "recent reviews",
        description: "fresh customer sentiment and proof that can support the public trust surface",
        count: publishedReviews.length,
        items: publishedReviews.slice(0, 8).map((review) => ({
          id: review.id,
          title: review.reviewerName || `${review.rating || 0}-star review`,
          subtitle: `${review.rating || 0} stars · ${sentenceCase(review.source)}`,
          status: review.sentiment || "published",
          note: review.comment || `posted ${formatCompactDate(review.createdAt)}`,
          href: "https://astrocleanings.com/review.html",
        })),
      },
      {
        id: "featured-testimonials",
        label: "featured testimonials",
        description: "highest-signal customer proof that should be visible in public trust and sales handoff surfaces",
        count: featuredReviews.length,
        items: featuredReviews.slice(0, 6).map((review) => ({
          id: `${review.id}-featured`,
          title: review.reviewerName || `${review.rating || 0}-star testimonial`,
          subtitle: `${review.rating || 0} stars · ${sentenceCase(review.source)}`,
          status: review.sentiment || "featured",
          note: review.comment || `featured ${formatCompactDate(review.createdAt)}`,
          href: "https://astrocleanings.com",
        })),
      },
      {
        id: "review-eligible-jobs",
        label: "review-eligible jobs",
        description: "recent completed jobs that should drive review requests and trust follow-through",
        count: completedJobs.length,
        items: completedJobs.slice(0, 8).map((job) => ({
          id: job.id,
          title: job.title,
          subtitle: `completed ${formatCompactDate(job.completedAt)}`,
          status: job.status,
          note: job.scheduledDate ? `scheduled ${formatCompactDate(job.scheduledDate)}` : "recent completed job",
          href: "/root/dispatch",
        })),
      },
      {
        id: "trust-actions",
        label: "trust actions",
        description: "external trust endpoints and brand-led follow-through that convert completed work into reputation assets",
        count: 2,
        items: [
          {
            id: "google-review-link",
            title: "google review request",
            subtitle: process.env.GOOGLE_REVIEW_LINK ? "configured" : "missing",
            status: process.env.GOOGLE_REVIEW_LINK ? "live" : "blocked",
            note: process.env.GOOGLE_REVIEW_LINK
              ? "google review link is configured for direct post-job follow-up"
              : "configure GOOGLE_REVIEW_LINK to enable direct review-request handoff",
            href: process.env.GOOGLE_REVIEW_LINK || "https://astrocleanings.com/review.html",
          },
          {
            id: "acs-public-reviews",
            title: "public review surface",
            subtitle: "astrocleanings.com/reviews section",
            status: "live",
            note: "public trust surface should stay aligned with current review proof and reputation workflow",
            href: "https://astrocleanings.com",
          },
        ],
      },
    ],
    sourceNotes: [
      { label: "review source", value: customerReviewsRes.data && customerReviewsRes.data.length > 0 ? "customer_reviews" : "reviews" },
      { label: "brand authority", value: "/Users/baileyeubanks/Desktop/Projects/brand/docs/brand-central/acs.html" },
    ],
    primaryAction: {
      label: process.env.GOOGLE_REVIEW_LINK ? "open google review" : "open review page",
      href: process.env.GOOGLE_REVIEW_LINK || "https://astrocleanings.com/review.html",
      note: "post-job reputation handoff and public trust proof entrypoint",
    },
  };
}

export async function getRootMarketingExecutionSnapshot(
  workspace: RootBrandKey,
): Promise<RootMarketingExecutionSnapshot> {
  const supabase = getSupabase();

  if (workspace === "cc") {
    const briefQueue = await getRootMarketingBriefQueue("cc");
    const briefIds = briefQueue.map((brief) => brief.id);
    const draftEventsRes = briefIds.length > 0
      ? await supabase
        .from("events")
        .select("payload, created_at")
        .eq("type", "cc_quote_draft_created")
        .in("channel", ["root", "internal"])
      : { data: [], error: null };

    const quoteIds = Array.from(new Set(
      (draftEventsRes.data || [])
        .map((event) => {
          const payload = event.payload as Record<string, unknown> | null;
          const briefId = payload?.brief_id ? String(payload.brief_id) : null;
          const quoteId = payload?.quote_id ? String(payload.quote_id) : null;
          return briefId && quoteId && briefIds.includes(briefId) ? quoteId : null;
        })
        .filter((value): value is string => Boolean(value)),
    ));

    const quotesRes = quoteIds.length > 0
      ? await supabase
        .from("quotes")
        .select("id,client_name,quote_number,internal_status,client_status,estimated_total,created_at,payload")
        .in("id", quoteIds)
        .order("created_at", { ascending: false })
      : { data: [], error: null };

    const quoteItemsRes = quoteIds.length > 0
      ? await supabase
        .from("quote_items")
        .select("quote_id,name,description,quantity,unit_price,phase_name,sort_order")
        .in("quote_id", quoteIds)
        .order("sort_order", { ascending: true })
      : { data: [], error: null };

    type ExecutionQuoteSummary = {
      quoteId: string;
      status: string;
      clientName: string;
      quoteNumber: string | null;
      estimatedTotal: number | null;
      createdAt: string | null;
      payload: {
        doc?: {
          phases?: Array<{
            title?: string;
            scheduleLabel?: string;
            items?: Array<{
              description?: string;
              quantity?: number;
              unit_price?: number;
            }>;
          }>;
        };
      } | null;
    };

    const latestQuoteByBrief = new Map<string, ExecutionQuoteSummary>();
    const quoteItemsByQuoteId = new Map<string, Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      phaseName: string | null;
    }>>();

    for (const row of quoteItemsRes.data || []) {
      const quoteId = String(row.quote_id || "");
      if (!quoteId) continue;
      const existing = quoteItemsByQuoteId.get(quoteId) || [];
      existing.push({
        description: String(row.description || row.name || "line item"),
        quantity: Number(row.quantity || 0),
        unitPrice: Number(row.unit_price || 0),
        phaseName: row.phase_name ? String(row.phase_name) : null,
      });
      quoteItemsByQuoteId.set(quoteId, existing);
    }

    for (const event of draftEventsRes.data || []) {
      const payload = event.payload as Record<string, unknown> | null;
      const briefId = payload?.brief_id ? String(payload.brief_id) : null;
      const quoteId = payload?.quote_id ? String(payload.quote_id) : null;
      if (!briefId || !quoteId || latestQuoteByBrief.has(briefId)) continue;
      const quote = (quotesRes.data || []).find((row) => String(row.id) === quoteId);
      if (!quote) continue;
      latestQuoteByBrief.set(briefId, {
        quoteId,
        status: String(quote.client_status || quote.internal_status || "draft"),
        clientName: String(quote.client_name || "client"),
        quoteNumber: quote.quote_number ? String(quote.quote_number) : null,
        estimatedTotal: typeof quote.estimated_total === "number" ? quote.estimated_total : null,
        createdAt: quote.created_at ? String(quote.created_at) : null,
        payload: quote.payload && typeof quote.payload === "object"
          ? quote.payload as ExecutionQuoteSummary["payload"]
          : null,
      });
    }

    const inProduction: RootMarketingExecutionItem[] = [];
    const contractReady: RootMarketingExecutionItem[] = [];
    const backlog: RootMarketingExecutionItem[] = [];
    let scopedDeliverables = 0;
    let plannedPhases = 0;

    function buildExecutionProjectItem(
      brief: RootMarketingBriefListItem,
      quote: ExecutionQuoteSummary,
    ): RootMarketingExecutionItem {
      const payloadPhases = (quote.payload?.doc?.phases || [])
        .map((phase) => ({
          title: String(phase.title || "").trim(),
          scheduleLabel: phase.scheduleLabel ? String(phase.scheduleLabel).trim() : null,
          items: Array.isArray(phase.items)
            ? phase.items
                .map((item) => ({
                  description: String(item.description || "").trim(),
                  quantity: Number(item.quantity || 0),
                  unitPrice: Number(item.unit_price || 0),
                }))
                .filter((item) => item.description)
            : [],
        }))
        .filter((phase) => phase.title || phase.items.length > 0);

      const quoteItems = quoteItemsByQuoteId.get(quote.quoteId) || [];
      const phaseNames = payloadPhases.length > 0
        ? uniqueCompact(payloadPhases.map((phase) => phase.title), 6)
        : uniqueCompact(quoteItems.map((item) => item.phaseName), 6);
      const scheduleLabels = uniqueCompact(payloadPhases.map((phase) => phase.scheduleLabel), 2);
      const deliverables = uniqueCompact(
        brief.deliverables.length > 0 ? brief.deliverables : quoteItems.map((item) => item.description),
        6,
      );
      const scopedItems = payloadPhases.reduce((sum, phase) => sum + phase.items.length, 0) || deliverables.length;

      scopedDeliverables += deliverables.length;
      plannedPhases += phaseNames.length;

      return {
        id: quote.quoteId,
        title: quote.clientName,
        subtitle: [quote.quoteNumber, preferredBriefProjectLabel(brief)].filter(Boolean).join(" · "),
        status: quote.status,
        note: quote.estimatedTotal != null
          ? `estimated ${Number(quote.estimatedTotal).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`
          : `drafted ${formatCompactDate(quote.createdAt)}`,
        href: `/root/quotes/${quote.quoteId}`,
        badges: [
          phaseNames.length > 0 ? `${phaseNames.length} phases` : null,
          deliverables.length > 0 ? `${deliverables.length} deliverables` : null,
          scopedItems > 0 ? `${scopedItems} scoped items` : null,
        ].filter((value): value is string => Boolean(value)),
        details: [
          deliverables.length > 0 ? `deliverables: ${deliverables.join(", ")}` : null,
          phaseNames.length > 0 ? `phase plan: ${phaseNames.join(" -> ")}` : null,
          scheduleLabels.length > 0 ? `schedule: ${scheduleLabels.join(" · ")}` : null,
        ].filter((value): value is string => Boolean(value)),
      };
    }

    for (const brief of briefQueue) {
      const quote = latestQuoteByBrief.get(brief.id);
      if (!quote) {
        backlog.push({
          id: brief.id,
          title: brief.title,
          subtitle: [brief.company, preferredBriefProjectLabel(brief)].filter(Boolean).join(" · ") || "creative brief",
          status: brief.quoteReady ? "ready_for_quote" : "intake_follow_up",
          note: brief.quoteReady ? "ready to convert into commercial motion" : `missing ${brief.missingFields.slice(0, 2).join(", ").replace(/_/g, " ") || "scope details"}`,
          href: brief.href,
          badges: [
            brief.deliverables.length > 0 ? `${brief.deliverables.length} deliverables requested` : null,
            brief.quoteReady ? "quote-ready" : null,
          ].filter((value): value is string => Boolean(value)),
          details: [
            brief.deliverables.length > 0 ? `deliverables: ${brief.deliverables.join(", ")}` : null,
            brief.blockers.length > 0 ? `needs: ${brief.blockers.join(", ").replace(/_/g, " ")}` : null,
          ].filter((value): value is string => Boolean(value)),
        });
        continue;
      }

      const normalized = quote.status.toLowerCase();
      const item = buildExecutionProjectItem(brief, quote);

      if (["accepted", "approved", "ready_to_invoice"].includes(normalized)) {
        contractReady.push(item);
      } else {
        inProduction.push(item);
      }
    }

    return {
      workspace,
      headline: "Content Co-op uses the execution lane to turn brief-linked quotes into explicit delivery projects with scoped deliverables and phase plans.",
      metrics: [
        { label: "delivery projects", value: String(inProduction.length + contractReady.length), note: "brief-linked projects with an execution quote attached" },
        { label: "scoped deliverables", value: String(scopedDeliverables), note: "requested outputs currently mapped into delivery work" },
        { label: "planned phases", value: String(plannedPhases), note: "execution phases parsed from quote payloads and scoped items" },
        { label: "backlog", value: String(backlog.length), note: "briefs still waiting on scope cleanup or first commercial handoff" },
      ],
      sections: [
        {
          id: "live-delivery",
          label: "live delivery",
          description: "client projects already in motion with scoped deliverables and a visible phase plan",
          count: inProduction.length,
          items: inProduction.slice(0, 8),
        },
        {
          id: "contract-ready",
          label: "contract ready",
          description: "accepted scope with enough structure to move cleanly into production and final delivery",
          count: contractReady.length,
          items: contractReady.slice(0, 8),
        },
        {
          id: "precedent-library",
          label: "precedent library",
          description: "reviewed case-study proof that can support delivery framing and client confidence",
          count: portfolioFeaturedStudies.length,
          items: portfolioFeaturedStudies.map((study) => ({
            id: study.id,
            title: study.client,
            subtitle: `${study.title} · ${study.format}`,
            status: study.review?.status || "review",
            note: `${study.deliverables.length} deliverables · ${study.gallery.length} support assets`,
            href: "https://contentco-op.com/portfolio",
          })),
        },
        {
          id: "execution-backlog",
          label: "execution backlog",
          description: "briefs not yet in real delivery motion and still needing operator cleanup",
          count: backlog.length,
          items: backlog.slice(0, 8),
        },
      ],
      sourceNotes: [
        { label: "brief source", value: "public.creative_briefs" },
        { label: "quote linkage", value: "events.type = cc_quote_draft_created" },
        { label: "delivery scope", value: "quotes.payload.doc.phases + quote_items" },
        { label: "delivery proof", value: "/Users/baileyeubanks/Desktop/Projects/contentco-op/monorepo/apps/home/lib/content/portfolio-manifest.json" },
      ],
      primaryAction: {
        label: "open quote board",
        href: "/root/quotes",
        note: "review scoped projects, tighten deliverables, and move approved work into execution",
      },
    };
  }

  const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString();
  const completedJobsRes = await supabase
    .from("jobs")
    .select("id,title,status,scheduled_date,completed_at")
    .eq("business_unit", "ACS")
    .not("completed_at", "is", null)
    .gte("completed_at", thirtyDaysAgo)
    .order("completed_at", { ascending: false })
    .limit(24);

  const customerReviewsRes = await supabase
    .from("customer_reviews")
    .select("id,job_id,rating,comment,source,reviewer_name,created_at,status,is_public")
    .order("created_at", { ascending: false })
    .limit(24);

  const fallbackReviewsRes = (!customerReviewsRes.data || customerReviewsRes.data.length === 0)
    ? await supabase
      .from("reviews")
      .select("id,job_id,rating,comment,source,created_at,sentiment")
      .order("created_at", { ascending: false })
      .limit(24)
    : { data: [], error: null };

  const normalizedReviews = (customerReviewsRes.data && customerReviewsRes.data.length > 0)
    ? customerReviewsRes.data.map((row) => ({
      id: String(row.id),
      jobId: row.job_id ? String(row.job_id) : null,
      rating: typeof row.rating === "number" ? row.rating : null,
      reviewerName: row.reviewer_name ? String(row.reviewer_name) : null,
      source: row.source ? String(row.source) : "direct",
      createdAt: row.created_at ? String(row.created_at) : null,
      comment: row.comment ? String(row.comment) : null,
      status: row.status ? String(row.status) : "published",
      isPublished: row.status ? String(row.status) === "published" : Boolean(row.is_public),
    }))
    : (fallbackReviewsRes.data || []).map((row) => ({
      id: String(row.id),
      jobId: row.job_id ? String(row.job_id) : null,
      rating: typeof row.rating === "number" ? row.rating : null,
      reviewerName: null,
      source: row.source ? String(row.source) : "direct",
      createdAt: row.created_at ? String(row.created_at) : null,
      comment: row.comment ? String(row.comment) : null,
      status: "published",
      isPublished: true,
    }));

  const reviewedJobIds = new Set(normalizedReviews.map((review) => review.jobId).filter((value): value is string => Boolean(value)));
  const completedJobs = (completedJobsRes.data || []).map((job) => ({
    id: String(job.id),
    title: String(job.title || "completed job"),
    status: String(job.status || "completed"),
    completedAt: job.completed_at ? String(job.completed_at) : null,
    scheduledDate: job.scheduled_date ? String(job.scheduled_date) : null,
  }));

  const needsReview = completedJobs.filter((job) => !reviewedJobIds.has(job.id));
  const reviewedJobs = completedJobs.filter((job) => reviewedJobIds.has(job.id));

  return {
    workspace,
    headline: "Astro Cleanings uses the execution lane to turn completed jobs into review requests, published proof, and stronger trust follow-through.",
    metrics: [
      { label: "completed jobs", value: String(completedJobs.length), note: "acs jobs completed in the last 30 days" },
      { label: "reviewed jobs", value: String(reviewedJobs.length), note: "completed jobs already paired to a recorded review" },
      { label: "needs request", value: String(needsReview.length), note: "completed jobs that should still get a review handoff" },
      { label: "published proof", value: String(normalizedReviews.filter((review) => review.isPublished).length), note: "published reviews available for trust use" },
    ],
    sections: [
      {
        id: "needs-review-request",
        label: "needs review request",
        description: "completed jobs that still need a direct review handoff or follow-through",
        count: needsReview.length,
        items: needsReview.slice(0, 8).map((job) => ({
          id: job.id,
          title: job.title,
          subtitle: `completed ${formatCompactDate(job.completedAt)}`,
          status: "review_request_needed",
          note: process.env.GOOGLE_REVIEW_LINK
            ? "review link configured and ready for post-job follow-through"
            : "configure GOOGLE_REVIEW_LINK so post-job requests can ship cleanly",
          href: "/root/dispatch",
        })),
      },
      {
        id: "review-closed-loop",
        label: "review closed loop",
        description: "completed jobs that already resulted in usable review proof",
        count: reviewedJobs.length,
        items: reviewedJobs.slice(0, 8).map((job) => ({
          id: `${job.id}-reviewed`,
          title: job.title,
          subtitle: `completed ${formatCompactDate(job.completedAt)}`,
          status: "reviewed",
          note: "job already has a linked review in the trust record",
          href: "/root/dispatch",
        })),
      },
      {
        id: "recent-proof",
        label: "recent proof",
        description: "fresh review proof that should reinforce public trust and quote conversion",
        count: normalizedReviews.length,
        items: normalizedReviews.slice(0, 8).map((review) => ({
          id: review.id,
          title: review.reviewerName || `${review.rating || 0}-star review`,
          subtitle: `${review.rating || 0} stars · ${sentenceCase(review.source)}`,
          status: review.status,
          note: review.comment || `captured ${formatCompactDate(review.createdAt)}`,
          href: process.env.GOOGLE_REVIEW_LINK || "https://astrocleanings.com/review.html",
        })),
      },
      {
        id: "trust-handoff",
        label: "trust handoff",
        description: "external endpoints and public surfaces that complete the ACS reputation loop",
        count: 2,
        items: [
          {
            id: "review-link",
            title: "google review handoff",
            subtitle: process.env.GOOGLE_REVIEW_LINK ? "configured" : "missing",
            status: process.env.GOOGLE_REVIEW_LINK ? "live" : "blocked",
            note: process.env.GOOGLE_REVIEW_LINK
              ? "operators can send a direct review request after completed work"
              : "review follow-through still relies on manual links until GOOGLE_REVIEW_LINK is present",
            href: process.env.GOOGLE_REVIEW_LINK || "https://astrocleanings.com/review.html",
          },
          {
            id: "public-trust-surface",
            title: "public trust surface",
            subtitle: "astrocleanings.com reviews section",
            status: "live",
            note: "public proof layer that should stay aligned with current review inventory",
            href: "https://astrocleanings.com",
          },
        ],
      },
    ],
    sourceNotes: [
      { label: "completed work", value: "jobs.completed_at scoped to ACS" },
      { label: "review source", value: customerReviewsRes.data && customerReviewsRes.data.length > 0 ? "customer_reviews" : "reviews" },
      { label: "handoff endpoint", value: "GOOGLE_REVIEW_LINK | /review.html" },
    ],
    primaryAction: {
      label: process.env.GOOGLE_REVIEW_LINK ? "open review handoff" : "open review page",
      href: process.env.GOOGLE_REVIEW_LINK || "https://astrocleanings.com/review.html",
      note: "send the next review request or verify the reputation handoff path",
    },
  };
}
