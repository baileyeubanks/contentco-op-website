/**
 * CCO OS Projects Engine — Airtable-pattern project tracking, deliverables, brief conversion.
 */

import { handoffBriefToProduction } from "@/lib/cco-brief-production-handoff";
import { getSupabase } from "@/lib/supabase";
import { emitTypedEvent } from "@/lib/os-event-log";
import type { RootBusinessScope } from "@/lib/os-request-scope";

// ─── Projects ───

export async function getProjects(scope: RootBusinessScope = null, options: { status?: string; limit?: number } = {}) {
  const sb = getSupabase();
  const { status, limit = 100 } = options;

  let query = sb
    .from("projects")
    .select("*, companies(id, name), contacts(id, full_name, name), deliverables(id, title, status)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (scope) query = query.eq("business_unit", scope);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  return { projects: data || [], error: error?.message || null };
}

export async function getProjectById(id: string) {
  const sb = getSupabase();

  const [{ data: project, error }, { data: deliverables }, { data: events }] = await Promise.all([
    sb.from("projects")
      .select("*, companies(id, name, domain), contacts(id, full_name, name, email), opportunities(id, title, stage, value_cents)")
      .eq("id", id)
      .maybeSingle(),
    sb.from("deliverables")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: true }),
    sb.from("events")
      .select("id, type, text, created_at")
      .eq("object_type", "project")
      .eq("object_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  return {
    project,
    deliverables: deliverables || [],
    timeline: events || [],
    error: error?.message || null,
  };
}

export async function createProject(data: {
  business_unit: string;
  title: string;
  company_id?: string;
  contact_id?: string;
  opportunity_id?: string;
  project_type?: string;
  start_date?: string;
  due_date?: string;
  budget_cents?: number;
}) {
  const sb = getSupabase();
  const { data: project, error } = await sb
    .from("projects")
    .insert({
      business_unit: data.business_unit || "CC",
      title: data.title,
      status: "planning",
      company_id: data.company_id || null,
      contact_id: data.contact_id || null,
      opportunity_id: data.opportunity_id || null,
      project_type: data.project_type || null,
      start_date: data.start_date || null,
      due_date: data.due_date || null,
      budget_cents: data.budget_cents || 0,
    })
    .select()
    .single();

  if (project) {
    await emitTypedEvent({
      type: "project.created",
      objectType: "project",
      objectId: project.id,
      businessUnit: (data.business_unit as "ACS" | "CC") || "CC",
      contactId: data.contact_id || null,
      text: `Project "${data.title}" created`,
    });
  }

  return { project, error: error?.message || null };
}

export async function updateProjectStatus(id: string, status: string) {
  const sb = getSupabase();
  const { data: project, error } = await sb
    .from("projects")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (project) {
    const eventType = status === "completed" ? "project.completed" : status === "cancelled" ? "project.cancelled" : "project.status_changed";
    await emitTypedEvent({
      type: eventType,
      objectType: "project",
      objectId: id,
      businessUnit: (project.business_unit as "ACS" | "CC") || "CC",
      text: `Project status changed to ${status}`,
      payload: { status },
    });
  }

  return { project, error: error?.message || null };
}

// ─── Deliverables ───

const DELIVERABLE_STATUS_ORDER = ["draft", "in_progress", "in_review", "revision", "approved", "delivered"];

export async function createDeliverable(data: {
  project_id: string;
  title: string;
  deliverable_type?: string;
  assignee_id?: string;
  due_date?: string;
  brief?: Record<string, unknown>;
}) {
  const sb = getSupabase();
  const { data: deliverable, error } = await sb
    .from("deliverables")
    .insert({
      project_id: data.project_id,
      title: data.title,
      deliverable_type: data.deliverable_type || "video",
      status: "draft",
      assignee_id: data.assignee_id || null,
      due_date: data.due_date || null,
      brief: data.brief || null,
    })
    .select()
    .single();

  if (deliverable) {
    await emitTypedEvent({
      type: "deliverable.created",
      objectType: "deliverable",
      objectId: deliverable.id,
      text: `Deliverable "${data.title}" created`,
      payload: { project_id: data.project_id, type: data.deliverable_type || "video" },
    });
  }

  return { deliverable, error: error?.message || null };
}

export async function updateDeliverableStatus(id: string, newStatus: string) {
  const sb = getSupabase();

  // Validate status transition
  const { data: current } = await sb.from("deliverables").select("status, title, project_id").eq("id", id).maybeSingle();
  if (!current) return { deliverable: null, error: "Deliverable not found" };

  const currentIdx = DELIVERABLE_STATUS_ORDER.indexOf(current.status);
  const newIdx = DELIVERABLE_STATUS_ORDER.indexOf(newStatus);

  // Allow forward transitions and revision (backward to revision from in_review/approved)
  const isRevision = newStatus === "revision" && ["in_review", "approved"].includes(current.status);
  if (newIdx < 0 || (newIdx <= currentIdx && !isRevision)) {
    return { deliverable: null, error: `Invalid status transition: ${current.status} → ${newStatus}` };
  }

  const { data: deliverable, error } = await sb
    .from("deliverables")
    .update({ status: newStatus })
    .eq("id", id)
    .select()
    .single();

  if (deliverable) {
    const eventMap: Record<string, string> = {
      in_review: "deliverable.submitted",
      approved: "deliverable.approved",
      revision: "deliverable.revision_requested",
      delivered: "deliverable.delivered",
    };
    const eventType = eventMap[newStatus] || "deliverable.created";

    await emitTypedEvent({
      type: eventType as any,
      objectType: "deliverable",
      objectId: id,
      text: `Deliverable "${current.title}" → ${newStatus}`,
      payload: { previous_status: current.status, new_status: newStatus, project_id: current.project_id },
    });
  }

  return { deliverable, error: error?.message || null };
}

// ─── Brief → Project Conversion ───

/** Commercial approval is the only path from a public brief into production. */
export async function createProjectFromBrief(briefId: string, businessUnit = "CC") {
  return handoffBriefToProduction(briefId, businessUnit);
}

// ─── Project Timeline ───

export async function getProjectTimeline(projectId: string) {
  const sb = getSupabase();

  const [{ data: projectEvents }, { data: deliverableEvents }] = await Promise.all([
    sb.from("events")
      .select("id, type, text, created_at, object_type, object_id")
      .eq("object_type", "project")
      .eq("object_id", projectId)
      .order("created_at", { ascending: false })
      .limit(50),
    sb.from("events")
      .select("id, type, text, created_at, object_type, object_id")
      .eq("object_type", "deliverable")
      .in("object_id", (await sb.from("deliverables").select("id").eq("project_id", projectId)).data?.map(d => d.id) || [])
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const timeline = [...(projectEvents || []), ...(deliverableEvents || [])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return { timeline };
}
