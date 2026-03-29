import { getSupabase } from "@/lib/supabase";

export type RootOverviewCard = {
  label: string;
  value: number;
  detail: string;
  tone: "neutral" | "positive" | "warning";
};

export type RootOverviewSummary = {
  cards: RootOverviewCard[];
  contactsTotal: number;
  clientsTotal: number;
  leadsTotal: number;
  quotesTotal: number;
  quotesNew: number;
  quotesAccepted: number;
  quotesAbandoned: number;
  jobsTotal: number;
  jobsScheduled: number;
  jobsToday: number;
};

export type RootOverviewQuote = {
  id: string;
  quoteNumber: string;
  clientName: string;
  businessUnit: string;
  status: string;
  estimatedTotal: number;
  createdAt: string | null;
};

export type RootOverviewJob = {
  id: string;
  title: string;
  clientName: string | null;
  status: string;
  scheduledDate: string | null;
  scheduledStart: string | null;
  completedAt: string | null;
  totalAmount: number;
  bucket: "upcoming" | "completed";
};

export type RootOverviewContact = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  contactType: string | null;
  priorityScore: number | null;
  lastContacted: string | null;
};

export type RootOverviewDiagnostics = {
  status: "healthy" | "degraded" | "slow";
  totalMs: number;
  payloadBytes: number;
  timingsMs: Record<string, number>;
  warnings: string[];
};

export type RootOverviewReadModel = {
  summary: RootOverviewSummary;
  recentQuotes: RootOverviewQuote[];
  recentJobs: RootOverviewJob[];
  contactsSnapshot: RootOverviewContact[];
  diagnostics: RootOverviewDiagnostics;
};

type TimedResult<T> = {
  key: string;
  durationMs: number;
  result: T;
};

function isoDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function errorMessage(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const maybeMessage = "message" in value ? (value as { message?: unknown }).message : null;
  return typeof maybeMessage === "string" && maybeMessage.trim().length > 0
    ? maybeMessage.trim()
    : null;
}

function readCount(result: { count: number | null; error: unknown }, warnings: string[], label: string) {
  const message = errorMessage(result.error);
  if (message) warnings.push(`${label}: ${message}`);
  return result.count ?? 0;
}

async function runTimed<T>(key: string, query: PromiseLike<T>): Promise<TimedResult<T>> {
  const startedAt = Date.now();
  const result = await query;
  return {
    key,
    durationMs: Date.now() - startedAt,
    result,
  };
}

export async function buildRootOverviewReadModel(): Promise<RootOverviewReadModel> {
  const startedAt = Date.now();
  const supabase = getSupabase();
  const today = isoDateOnly(new Date());
  const fourteenDaysFromNow = isoDateOnly(new Date(Date.now() + 14 * 86_400_000));

  const timedResults = await Promise.all([
    runTimed(
      "contacts_snapshot",
      supabase
        .from("contacts")
        .select(
          "id,name,full_name,email,company,contact_type,priority_score,last_contacted,created_at",
        )
        .not("name", "is", null)
        .neq("name", "")
        .order("priority_score", { ascending: false, nullsFirst: false })
        .order("last_contacted", { ascending: false, nullsFirst: false })
        .limit(8),
    ),
    runTimed(
      "quotes_recent",
      supabase
        .from("quotes")
        .select(
          "id,quote_number,client_name,estimated_total,status,client_status,business_unit,created_at,contact_id",
        )
        .order("created_at", { ascending: false })
        .limit(8),
    ),
    runTimed(
      "jobs_upcoming",
      supabase
        .from("jobs")
        .select(
          "id,title,status,scheduled_date,scheduled_start,total_price,total_amount_cents,contact_id,completed_at",
        )
        .gte("scheduled_date", today)
        .lte("scheduled_date", fourteenDaysFromNow)
        .order("scheduled_date", { ascending: true })
        .limit(6),
    ),
    runTimed(
      "jobs_completed",
      supabase
        .from("jobs")
        .select(
          "id,title,status,scheduled_date,scheduled_start,total_price,total_amount_cents,contact_id,completed_at",
        )
        .eq("status", "completed")
        .order("completed_at", { ascending: false, nullsFirst: false })
        .limit(4),
    ),
    runTimed("contacts_total", supabase.from("contacts").select("id", { count: "exact", head: true })),
    runTimed(
      "contacts_clients",
      supabase.from("contacts").select("id", { count: "exact", head: true }).eq("contact_type", "client"),
    ),
    runTimed(
      "contacts_leads",
      supabase.from("contacts").select("id", { count: "exact", head: true }).eq("contact_type", "lead"),
    ),
    runTimed("quotes_total", supabase.from("quotes").select("id", { count: "exact", head: true })),
    runTimed("quotes_new", supabase.from("quotes").select("id", { count: "exact", head: true }).eq("status", "new")),
    runTimed(
      "quotes_accepted",
      supabase.from("quotes").select("id", { count: "exact", head: true }).eq("status", "accepted"),
    ),
    runTimed(
      "quotes_abandoned",
      supabase.from("quotes").select("id", { count: "exact", head: true }).eq("status", "abandoned"),
    ),
    runTimed("jobs_total", supabase.from("jobs").select("id", { count: "exact", head: true })),
    runTimed(
      "jobs_scheduled",
      supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "scheduled"),
    ),
    runTimed(
      "jobs_today",
      supabase.from("jobs").select("id", { count: "exact", head: true }).eq("scheduled_date", today),
    ),
  ]);

  const timingMap = Object.fromEntries(timedResults.map((entry) => [entry.key, entry.durationMs]));
  const resultMap = Object.fromEntries(timedResults.map((entry) => [entry.key, entry.result])) as Record<string, unknown>;
  const warnings: string[] = [];

  const quotesRecent = resultMap.quotes_recent as {
    data: Array<{
      id: string;
      quote_number: string | null;
      client_name: string | null;
      estimated_total: number | null;
      status: string | null;
      client_status: string | null;
      business_unit: string | null;
      created_at: string | null;
      contact_id: string | null;
    }> | null;
    error: unknown;
  };
  const jobsUpcoming = resultMap.jobs_upcoming as {
    data: Array<{
      id: string;
      title: string | null;
      status: string | null;
      scheduled_date: string | null;
      scheduled_start: string | null;
      total_price: number | null;
      total_amount_cents: number | null;
      contact_id: string | null;
      completed_at: string | null;
    }> | null;
    error: unknown;
  };
  const jobsCompleted = resultMap.jobs_completed as typeof jobsUpcoming;
  const contactsSnapshotResult = resultMap.contacts_snapshot as {
    data: Array<{
      id: string;
      name: string | null;
      full_name: string | null;
      email: string | null;
      company: string | null;
      contact_type: string | null;
      priority_score: number | null;
      last_contacted: string | null;
    }> | null;
    error: unknown;
  };

  for (const entry of [
    { label: "contacts_snapshot", error: contactsSnapshotResult.error },
    { label: "quotes_recent", error: quotesRecent.error },
    { label: "jobs_upcoming", error: jobsUpcoming.error },
    { label: "jobs_completed", error: jobsCompleted.error },
  ]) {
    const message = errorMessage(entry.error);
    if (message) warnings.push(`${entry.label}: ${message}`);
  }

  const recentQuotesRaw = quotesRecent.data ?? [];
  const recentJobsRaw = [...(jobsUpcoming.data ?? []), ...(jobsCompleted.data ?? [])];
  const contactIds = Array.from(
    new Set(
      [...recentQuotesRaw.map((quote) => quote.contact_id), ...recentJobsRaw.map((job) => job.contact_id)].filter(
        (value): value is string => typeof value === "string" && value.length > 0,
      ),
    ),
  );

  const contactLookup: Record<string, { name: string; email: string | null }> = {};

  if (contactIds.length > 0) {
    const lookupStartedAt = Date.now();
    const { data, error } = await supabase
      .from("contacts")
      .select("id,name,full_name,email")
      .in("id", contactIds);
    timingMap.contact_lookup = Date.now() - lookupStartedAt;
    const message = errorMessage(error);
    if (message) warnings.push(`contact_lookup: ${message}`);
    for (const item of data ?? []) {
      contactLookup[item.id] = {
        name: item.full_name || item.name || "Unknown contact",
        email: item.email || null,
      };
    }
  }

  const recentQuotes: RootOverviewQuote[] = recentQuotesRaw.map((quote) => ({
    id: quote.id,
    quoteNumber: quote.quote_number || `Q-${quote.id.slice(0, 6)}`,
    clientName:
      quote.client_name ||
      (quote.contact_id ? contactLookup[quote.contact_id]?.name : null) ||
      "Unknown client",
    businessUnit: quote.business_unit || "ACS",
    status: quote.status || quote.client_status || "draft",
    estimatedTotal: normalizeNumber(quote.estimated_total),
    createdAt: quote.created_at,
  }));

  const upcomingIds = new Set((jobsUpcoming.data ?? []).map((job) => job.id));
  const recentJobs: RootOverviewJob[] = recentJobsRaw.map((job) => ({
    id: job.id,
    title: job.title || "Untitled job",
    clientName: job.contact_id ? contactLookup[job.contact_id]?.name || null : null,
    status: job.status || "scheduled",
    scheduledDate: job.scheduled_date,
    scheduledStart: job.scheduled_start,
    completedAt: job.completed_at,
    totalAmount:
      normalizeNumber(job.total_price) ||
      normalizeNumber(job.total_amount_cents) / 100,
    bucket: upcomingIds.has(job.id) ? "upcoming" : "completed",
  }));

  const contactsSnapshot: RootOverviewContact[] = (contactsSnapshotResult.data ?? []).map((contact) => ({
    id: contact.id,
    name: contact.full_name || contact.name || "Unknown contact",
    email: contact.email,
    company: contact.company,
    contactType: contact.contact_type,
    priorityScore: contact.priority_score,
    lastContacted: contact.last_contacted,
  }));

  const contactsTotal = readCount(
    resultMap.contacts_total as { count: number | null; error: unknown },
    warnings,
    "contacts_total",
  );
  const clientsTotal = readCount(
    resultMap.contacts_clients as { count: number | null; error: unknown },
    warnings,
    "contacts_clients",
  );
  const leadsTotal = readCount(
    resultMap.contacts_leads as { count: number | null; error: unknown },
    warnings,
    "contacts_leads",
  );
  const quotesTotal = readCount(
    resultMap.quotes_total as { count: number | null; error: unknown },
    warnings,
    "quotes_total",
  );
  const quotesNew = readCount(
    resultMap.quotes_new as { count: number | null; error: unknown },
    warnings,
    "quotes_new",
  );
  const quotesAccepted = readCount(
    resultMap.quotes_accepted as { count: number | null; error: unknown },
    warnings,
    "quotes_accepted",
  );
  const quotesAbandoned = readCount(
    resultMap.quotes_abandoned as { count: number | null; error: unknown },
    warnings,
    "quotes_abandoned",
  );
  const jobsTotal = readCount(
    resultMap.jobs_total as { count: number | null; error: unknown },
    warnings,
    "jobs_total",
  );
  const jobsScheduled = readCount(
    resultMap.jobs_scheduled as { count: number | null; error: unknown },
    warnings,
    "jobs_scheduled",
  );
  const jobsToday = readCount(
    resultMap.jobs_today as { count: number | null; error: unknown },
    warnings,
    "jobs_today",
  );

  const summary: RootOverviewSummary = {
    cards: [
      {
        label: "New quotes",
        value: quotesNew,
        detail: `${quotesAccepted} accepted this cycle`,
        tone: quotesNew > 0 ? "warning" : "neutral",
      },
      {
        label: "Jobs scheduled",
        value: jobsScheduled,
        detail: `${jobsToday} landing today`,
        tone: jobsToday > 0 ? "positive" : "neutral",
      },
      {
        label: "Contacts in play",
        value: contactsTotal,
        detail: `${clientsTotal} clients · ${leadsTotal} leads`,
        tone: "neutral",
      },
      {
        label: "Quotes at risk",
        value: quotesAbandoned,
        detail: `${quotesTotal} total in the commercial lane`,
        tone: quotesAbandoned > 0 ? "warning" : "positive",
      },
    ],
    contactsTotal,
    clientsTotal,
    leadsTotal,
    quotesTotal,
    quotesNew,
    quotesAccepted,
    quotesAbandoned,
    jobsTotal,
    jobsScheduled,
    jobsToday,
  };

  const basePayload = {
    summary,
    recent_quotes: recentQuotes,
    recent_jobs: recentJobs,
    contacts_snapshot: contactsSnapshot,
  };

  const totalMs = Date.now() - startedAt;
  const diagnostics: RootOverviewDiagnostics = {
    status: warnings.length > 0 ? "degraded" : totalMs > 1200 ? "slow" : "healthy",
    totalMs,
    payloadBytes: Buffer.byteLength(JSON.stringify(basePayload), "utf8"),
    timingsMs: timingMap,
    warnings,
  };

  return {
    summary,
    recentQuotes,
    recentJobs,
    contactsSnapshot,
    diagnostics,
  };
}
