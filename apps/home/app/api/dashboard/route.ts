import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * GET /api/dashboard — Aggregated dashboard data for root.
 * Server-side only, uses service role key (bypasses RLS).
 * Returns contacts, quotes, jobs with client names joined.
 */
export async function GET() {
  const sb = getSupabase();

  // Fetch in parallel: prioritized contacts, all quotes, recent + completed jobs
  const [
    contactsPrimary,
    contactsSecondary,
    quotesRes,
    jobsScheduled,
    jobsCompleted,
    contactTotalRes,
    jobsTotalRes,
  ] = await Promise.all([
    // Primary contacts: those with email OR business_unit OR contact_type set
    sb
      .from("contacts")
      .select(
        "id,name,full_name,email,phone,company,business_unit,contact_type,status,total_revenue,total_jobs,last_contacted,priority_score,city,state,orbit_tier,tags,created_at",
      )
      .not("name", "is", null)
      .neq("name", "")
      .or("email.neq.,contact_type.neq.,company.neq.")
      .order("priority_score", { ascending: false, nullsFirst: false })
      .order("name", { ascending: true })
      .limit(500),

    // Secondary contacts: the rest, by name (for total count fidelity)
    sb
      .from("contacts")
      .select(
        "id,name,full_name,email,phone,company,business_unit,contact_type,status,total_revenue,total_jobs,last_contacted,priority_score,city,state,orbit_tier,tags,created_at",
      )
      .not("name", "is", null)
      .neq("name", "")
      .is("email", null)
      .is("contact_type", null)
      .is("company", null)
      .order("name", { ascending: true })
      .limit(500),

    // All quotes
    sb
      .from("quotes")
      .select(
        "id,quote_number,client_name,client_email,estimated_total,status,client_status,business_unit,service_type,frequency,booked_date,booked_slot,address,created_at,contact_id",
      )
      .order("created_at", { ascending: false })
      .limit(200),

    // Jobs: today + upcoming (next 14 days)
    sb
      .from("jobs")
      .select(
        "id,title,status,scheduled_date,scheduled_start,total_price,total_amount_cents,estimated_duration_min,assigned_team,contact_id,business_id,completed_at,notes,created_at",
      )
      .gte("scheduled_date", new Date().toISOString().split("T")[0])
      .lte(
        "scheduled_date",
        new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
      )
      .order("scheduled_date", { ascending: true })
      .limit(200),

    // Jobs: completed (most recent first)
    sb
      .from("jobs")
      .select(
        "id,title,status,scheduled_date,scheduled_start,total_price,total_amount_cents,estimated_duration_min,assigned_team,contact_id,business_id,completed_at,notes,created_at",
      )
      .eq("status", "completed")
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(200),

    // Total contacts count
    sb.from("contacts").select("id", { count: "exact", head: true }),

    // Total jobs count
    sb.from("jobs").select("id", { count: "exact", head: true }),
  ]);

  // Merge contacts: primary first, then secondary (deduped)
  // Also filter out contacts where name is an email address or just digits
  function isJunkName(name: string | null): boolean {
    if (!name) return true;
    const n = name.trim();
    if (n.includes("@")) return true; // email as name
    if (/^\d{5,}$/.test(n)) return true; // just digits (phone numbers)
    if (/^[\d\s+()-]{7,}$/.test(n)) return true; // phone-like
    return false;
  }

  const primaryIds = new Set(
    (contactsPrimary.data || []).map((c: Record<string, unknown>) => c.id),
  );
  const allContacts = [
    ...(contactsPrimary.data || []).filter(
      (c: Record<string, unknown>) => !isJunkName(c.name as string),
    ),
    ...(contactsSecondary.data || []).filter(
      (c: Record<string, unknown>) =>
        !primaryIds.has(c.id) && !isJunkName(c.name as string),
    ),
  ];

  // Merge jobs: today/upcoming first, then rest (deduped)
  const upcomingIds = new Set(
    (jobsScheduled.data || []).map((j: Record<string, unknown>) => j.id),
  );
  const allJobsRaw = [
    ...(jobsScheduled.data || []), // today + next 14 days first
    ...(jobsCompleted.data || []).filter(
      (j: Record<string, unknown>) => !upcomingIds.has(j.id),
    ), // then past/far-future
  ];

  // Resolve contact names for jobs and quotes
  const contactIds = new Set<string>();
  for (const q of quotesRes.data || []) {
    if (q.contact_id && !q.client_name) contactIds.add(q.contact_id);
  }
  for (const j of allJobsRaw) {
    if (j.contact_id) contactIds.add(j.contact_id);
  }

  const contactMap: Record<string, { name: string; email: string; phone: string }> = {};
  if (contactIds.size > 0) {
    const ids = Array.from(contactIds);
    const { data: linked } = await sb
      .from("contacts")
      .select("id,name,full_name,email,phone")
      .in("id", ids);
    if (linked) {
      for (const c of linked) {
        contactMap[c.id] = {
          name: c.full_name || c.name || "",
          email: c.email || "",
          phone: c.phone || "",
        };
      }
    }
  }

  // Enrich quotes
  const quotes = (quotesRes.data || []).map((q: Record<string, unknown>) => ({
    ...q,
    client_name:
      q.client_name ||
      (q.contact_id ? contactMap[q.contact_id as string]?.name : null) ||
      null,
    client_email:
      q.client_email ||
      (q.contact_id ? contactMap[q.contact_id as string]?.email : null) ||
      null,
  }));

  // Enrich jobs
  const jobs = allJobsRaw.map((j) => ({
    ...j,
    client_name: j.contact_id ? contactMap[j.contact_id]?.name || null : null,
    client_email: j.contact_id ? contactMap[j.contact_id]?.email || null : null,
    client_phone: j.contact_id ? contactMap[j.contact_id]?.phone || null : null,
  }));

  // Stats
  const totalContactCount = contactTotalRes.count || allContacts.length;
  const withEmail = allContacts.filter(
    (c: Record<string, unknown>) => c.email && String(c.email).length > 0,
  ).length;
  const withBU = allContacts.filter(
    (c: Record<string, unknown>) =>
      c.business_unit && Array.isArray(c.business_unit) && (c.business_unit as unknown[]).length > 0,
  ).length;
  const clients = allContacts.filter(
    (c: Record<string, unknown>) => c.contact_type === "client",
  ).length;
  const leads = allContacts.filter(
    (c: Record<string, unknown>) => c.contact_type === "lead",
  ).length;

  const today = new Date().toISOString().split("T")[0];
  const todayJobs = jobs.filter((j) => j.scheduled_date === today);

  const stats = {
    contacts_total: totalContactCount,
    contacts_loaded: allContacts.length,
    contacts_with_email: withEmail,
    contacts_with_bu: withBU,
    contacts_clients: clients,
    contacts_leads: leads,
    quotes_total: quotes.length,
    quotes_new: quotes.filter((q: Record<string, unknown>) => q.status === "new").length,
    quotes_accepted: quotes.filter((q: Record<string, unknown>) => q.status === "accepted").length,
    quotes_abandoned: quotes.filter((q: Record<string, unknown>) => q.status === "abandoned").length,
    quotes_pipeline: quotes
      .filter((q: Record<string, unknown>) => ["new", "sent", "pending"].includes(q.status as string))
      .reduce((s: number, q: Record<string, unknown>) => s + (Number(q.estimated_total) || 0), 0),
    quotes_accepted_value: quotes
      .filter((q: Record<string, unknown>) => q.status === "accepted")
      .reduce((s: number, q: Record<string, unknown>) => s + (Number(q.estimated_total) || 0), 0),
    jobs_total: jobsTotalRes.count || jobs.length,
    jobs_scheduled: jobs.filter((j) => j.status === "scheduled").length,
    jobs_completed: jobs.filter((j) => j.status === "completed").length,
    jobs_today: todayJobs.length,
  };

  return NextResponse.json({ contacts: allContacts, quotes, jobs, stats });
}
