import { NextResponse } from "next/server";
import { buildRootOverviewReadModel } from "@/lib/root-overview";

export const dynamic = "force-dynamic";

export async function GET() {
  const model = await buildRootOverviewReadModel();
  const compatibilityStats = {
    contacts_total: model.summary.contactsTotal,
    contacts_loaded: model.contactsSnapshot.length,
    contacts_with_email: model.contactsSnapshot.filter((contact) => contact.email).length,
    contacts_with_bu: 0,
    contacts_clients: model.summary.clientsTotal,
    contacts_leads: model.summary.leadsTotal,
    quotes_total: model.summary.quotesTotal,
    quotes_new: model.summary.quotesNew,
    quotes_accepted: model.summary.quotesAccepted,
    quotes_abandoned: model.summary.quotesAbandoned,
    quotes_pipeline: 0,
    quotes_accepted_value: model.recentQuotes
      .filter((quote) => quote.status === "accepted")
      .reduce((sum, quote) => sum + quote.estimatedTotal, 0),
    jobs_total: model.summary.jobsTotal,
    jobs_scheduled: model.summary.jobsScheduled,
    jobs_completed: model.recentJobs.filter((job) => job.bucket === "completed").length,
    jobs_today: model.summary.jobsToday,
  };

  const headers = new Headers();
  headers.set("x-root-overview-status", model.diagnostics.status);
  headers.set("x-root-overview-total-ms", String(model.diagnostics.totalMs));
  headers.set("x-root-overview-payload-bytes", String(model.diagnostics.payloadBytes));
  headers.set(
    "server-timing",
    Object.entries(model.diagnostics.timingsMs)
      .map(([key, duration]) => `${key};dur=${Math.round(duration)}`)
      .join(", "),
  );

  return NextResponse.json(
    {
      summary: model.summary,
      recent_quotes: model.recentQuotes,
      recent_jobs: model.recentJobs,
      contacts_snapshot: model.contactsSnapshot,
      diagnostics: model.diagnostics,
      quotes: model.recentQuotes,
      jobs: model.recentJobs,
      contacts: model.contactsSnapshot,
      stats: compatibilityStats,
    },
    { headers },
  );
}
