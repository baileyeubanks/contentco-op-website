import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";

/**
 * GET /api/os/dispatch/jobs?start=ISO&end=ISO
 *
 * Fetch jobs for the dispatch calendar within a date range.
 * Maps CCO-DB `jobs` columns (no client_name / service_address) via contacts.
 */
export async function GET(req: Request) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.dispatch.jobs.read",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["project_read"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json(
      { error: "start and end query params (ISO dates) are required" },
      { status: 400 },
    );
  }

  const startDate = start.slice(0, 10);
  const endDate = end.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return NextResponse.json(
      { error: "start and end must be ISO datetimes or YYYY-MM-DD dates" },
      { status: 400 },
    );
  }

  const sb = getSupabase();

  const { data: rows, error } = await sb
    .from("jobs")
    .select(
      "id, contact_id, title, status, scheduled_start, scheduled_end, scheduled_date, notes, total_amount_cents, total_price, assigned_team, business_unit, description",
    )
    .gte("scheduled_date", startDate)
    .lte("scheduled_date", endDate)
    .order("scheduled_start", { ascending: true });

  if (error) {
    console.error("[dispatch/jobs] Supabase error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch jobs" },
      { status: 500 },
    );
  }

  const contactIds = Array.from(
    new Set(
      (rows ?? [])
        .map((row) => row.contact_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  );

  const contactLookup: Record<
    string,
    { name: string; email: string | null; phone: string | null; address: string }
  > = {};

  if (contactIds.length > 0) {
    const { data: contacts, error: contactError } = await sb
      .from("contacts")
      .select("id, name, full_name, display_name, email, phone, address, street_address, city")
      .in("id", contactIds);

    if (contactError) {
      console.error("[dispatch/jobs] contact lookup error:", contactError);
    }

    for (const contact of contacts ?? []) {
      const street = contact.street_address || contact.address || "";
      const city = contact.city || "";
      const address = [street, city].filter(Boolean).join(", ");
      contactLookup[contact.id] = {
        name: contact.full_name || contact.display_name || contact.name || "Unknown contact",
        email: contact.email || null,
        phone: contact.phone || null,
        address: address || "Address not on file",
      };
    }
  }

  const jobs = (rows ?? []).map((row) => {
    const contact = row.contact_id ? contactLookup[row.contact_id] : undefined;
    const scheduledStart =
      row.scheduled_start ||
      (row.scheduled_date ? `${row.scheduled_date}T12:00:00.000Z` : null);

    return {
      id: row.id,
      contact_id: row.contact_id,
      client_name: contact?.name || row.title || "Untitled job",
      client_email: contact?.email || undefined,
      client_phone: contact?.phone || undefined,
      service_address: contact?.address || "Address not on file",
      service_type: row.business_unit || undefined,
      title: row.title || "Untitled job",
      scheduled_start: scheduledStart,
      scheduled_end: row.scheduled_end,
      scheduled_date: row.scheduled_date,
      status: normalizeStatus(row.status),
      crew_assigned: row.assigned_team ? [String(row.assigned_team)] : [],
      notes: row.notes || row.description || undefined,
      total_amount_cents:
        typeof row.total_amount_cents === "number"
          ? row.total_amount_cents
          : typeof row.total_price === "number"
            ? Math.round(Number(row.total_price) * 100)
            : undefined,
      business_unit: row.business_unit || null,
    };
  });

  return NextResponse.json({ ok: true, jobs });
}

function normalizeStatus(
  status: string | null | undefined,
): "scheduled" | "in_progress" | "completed" | "cancelled" {
  const value = (status || "scheduled").toLowerCase();
  if (value === "completed" || value === "cancelled" || value === "in_progress") {
    return value;
  }
  if (["arrived", "on_my_way", "in-progress", "active"].includes(value)) {
    return "in_progress";
  }
  if (["canceled", "no_show"].includes(value)) {
    return "cancelled";
  }
  return "scheduled";
}
