/**
 * CCO OS Projects Engine — Airtable-pattern project tracking, deliverables, brief conversion.
 */

import { ccoRecordId } from "@/lib/cco-record-id";
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

type ConversionDeliverable = { id: string; title: string; deliverable_type: string; due_date: string | null };
type ConversionManifest = { version: 1; deliverables: ConversionDeliverable[] };

function conversionManifest(value: unknown): ConversionManifest | null {
  if (!value || typeof value !== "object") return null;
  const manifest = value as ConversionManifest;
  if (manifest.version !== 1 || !Array.isArray(manifest.deliverables)) return null;
  return manifest.deliverables.every((item) => item && typeof item.id === "string" &&
    typeof item.title === "string" && typeof item.deliverable_type === "string" &&
    (item.due_date === null || typeof item.due_date === "string")) ? manifest : null;
}

export async function createProjectFromBrief(briefId: string, businessUnit: string = "CC") {
  const sb = getSupabase();
  let project: Record<string, any> | null = null;
  let replayed = false;
  const failed = (error: string, stage: string, retryable = true) => ({
    project, error, stage, retryable, partial: Boolean(project), replayed,
  });
  // This commercial handoff belongs only to CCO. A caller's scope must not
  // turn a CCO brief into an ACS project.
  if (businessUnit !== "CC") return failed("Brief conversion requires CCO scope", "scope", false);

  try {
    const { data: brief, error: briefError } = await sb
      .from("creative_briefs").select("*").eq("id", briefId).maybeSingle();
    if (briefError || !brief) return failed(briefError?.message || "Brief not found", "brief", Boolean(briefError));
    if (brief.company_account_id && brief.company_account_id !== "content-co-op") {
      return failed("Brief does not belong to CCO", "scope", false);
    }

    // Preserve the current public shape, with legacy brief fields as fallback.
    const structuredIntake = brief.structured_intake || {};
    const briefData = brief.data || {};
    const publicProject = briefData.project || structuredIntake.project || {};
    const projectTypes: string[] = Array.isArray(publicProject.projectTypes) ? publicProject.projectTypes.map(String) : [];
    const projectData = {
      content_type: publicProject.projectName || projectTypes.join(", ") || publicProject.content_type || brief.content_type || null,
      deliverables: publicProject.deliverables || [],
      deadline: publicProject.timeline || publicProject.deadline || null,
      audience: publicProject.audience || brief.audience,
      tone: publicProject.styleLevel || publicProject.tone || brief.tone,
      objective: publicProject.projectContext || publicProject.objective || brief.objective,
    };
    const contactData = { ...structuredIntake.contact,
      email: structuredIntake.contact?.email || brief.contact_email,
      name: structuredIntake.contact?.name || brief.contact_name,
      company: structuredIntake.contact?.company || brief.company,
    };

    // Old conversions used random IDs; reuse their source-brief link. Multiple
    // matches are an ambiguity to resolve, never permission to create another.
    const existing = await sb.from("projects").select("*").eq("business_unit", "CC")
      .contains("metadata", { source_brief_id: briefId }).maybeSingle();
    if (existing.error) return failed(existing.error.message, "project_lookup");
    project = existing.data;
    replayed = Boolean(project);

    const projectId = project?.id || ccoRecordId("brief-project", briefId);
    const buildManifest = (prior: Array<{ id: string; title: string }>): ConversionManifest => {
      const available = [...prior];
      const names = Array.isArray(projectData.deliverables) ? projectData.deliverables : [];
      return { version: 1, deliverables: names.map((name: unknown, index: number) => {
        const title = String(name);
        const priorIndex = available.findIndex((item) => item.title === title);
        const reused = priorIndex >= 0 ? available.splice(priorIndex, 1)[0] : null;
        return {
          id: reused?.id || ccoRecordId("brief-deliverable", `${projectId}:${index}`),
          title, deliverable_type: inferDeliverableType(title),
          // Public timelines are usually ranges such as "2–4 weeks", not dates.
          due_date: /^\d{4}-\d{2}-\d{2}$/.test(projectData.deadline || "") ? projectData.deadline : null,
        };
      }) };
    };

    if (!project) {
      let contactId: string | null = null;
      const savedContactId = typeof briefData.contact_id === "string" ? briefData.contact_id : null;
      if (savedContactId || contactData.email) {
        let query = sb.from("contacts").select("id").contains("business_unit", ["CC"]);
        query = savedContactId ? query.eq("id", savedContactId)
          : query.eq("cco_public_email_key", String(contactData.email).trim().toLowerCase());
        const contact = await query.maybeSingle();
        if (contact.error) return failed(contact.error.message, "contact_lookup");
        if (savedContactId && !contact.data) return failed("Saved CCO contact receipt missing", "contact_lookup", false);
        contactId = contact.data?.id || null;
      }
      const inserted = await sb.from("projects").insert({
        id: projectId, business_unit: "CC",
        title: projectData.content_type ? `${projectData.content_type} — ${contactData.company || contactData.name || "Client"}` : `Brief ${briefId.slice(0, 8)}`,
        status: "planning", contact_id: contactId, project_type: projectData.content_type,
        metadata: {
          source_brief_id: briefId, audience: projectData.audience, tone: projectData.tone,
          objective: projectData.objective, deadline: projectData.deadline,
          brief_conversion: buildManifest([]),
        },
      }).select().single();
      project = inserted.data;
      if (inserted.error?.code === "23505") {
        const winner = await sb.from("projects").select("*").eq("id", projectId)
          .eq("business_unit", "CC").contains("metadata", { source_brief_id: briefId }).maybeSingle();
        if (winner.error) return failed(winner.error.message, "project_lookup");
        project = winner.data;
        replayed = true;
      }
      if (!project) return failed(inserted.error?.message || "Failed to create project", "project_write");
    }

    // Freeze the initial deliverable list so a changed brief on a later retry
    // cannot silently expand the project. Adopt already-created legacy rows.
    let manifest = conversionManifest(project.metadata?.brief_conversion);
    if (!manifest && project.metadata?.brief_conversion != null) {
      return failed("Invalid stored conversion manifest", "manifest", false);
    }
    if (!manifest) {
      const prior = await sb.from("deliverables").select("id, title").eq("project_id", project.id)
        .order("created_at", { ascending: true }).order("id", { ascending: true });
      if (prior.error) return failed(prior.error.message, "deliverable_lookup");
      const saved = await sb.from("projects").update({ metadata: {
        ...project.metadata, brief_conversion: buildManifest(prior.data || []),
      } }).eq("id", project.id).is("metadata->brief_conversion", null)
        // Do not overwrite a simultaneous operator metadata edit while adopting
        // a legacy project. A changed row is re-read and retried instead.
        .eq("metadata", JSON.stringify(project.metadata)).select().maybeSingle();
      if (saved.error) return failed(saved.error.message, "manifest");
      if (saved.data) project = saved.data;
      else {
        const winner = await sb.from("projects").select("*").eq("id", project.id).single();
        if (winner.error || !winner.data) return failed(winner.error?.message || "Project receipt missing", "manifest");
        project = winner.data;
      }
      manifest = conversionManifest(project!.metadata?.brief_conversion);
      if (!manifest) return failed("Conversion manifest was not saved", "manifest");
    }

    for (const item of manifest.deliverables) {
      const existingDeliverable = await sb.from("deliverables").select("id, project_id").eq("id", item.id).maybeSingle();
      if (existingDeliverable.error) return failed(existingDeliverable.error.message, "deliverable_lookup");
      let deliverable = existingDeliverable.data;
      if (!deliverable) {
        const inserted = await sb.from("deliverables").insert({ ...item, project_id: project!.id, status: "draft" }).select().single();
        deliverable = inserted.data;
        if (inserted.error?.code === "23505") {
          const winner = await sb.from("deliverables").select("id, project_id").eq("id", item.id).maybeSingle();
          if (winner.error) return failed(winner.error.message, "deliverable_lookup");
          deliverable = winner.data;
        }
        if (!deliverable) return failed(inserted.error?.message || "Deliverable receipt missing", "deliverable_write");
      }
      if (deliverable.project_id !== project!.id) return failed("Deliverable belongs to another project", "deliverable_scope", false);
      const event = await emitTypedEvent({
        idempotencyKey: `brief-deliverable-created:${item.id}`,
        type: "deliverable.created", objectType: "deliverable", objectId: item.id, businessUnit: "CC",
        text: `Deliverable "${item.title}" created`,
        payload: { project_id: project!.id, type: item.deliverable_type },
      });
      if (!event.ok) return failed(event.error || "Deliverable handoff failed", "deliverable_event");
    }

    // Select the updated row: an error OR a zero-row update is incomplete.
    const marked = await sb.from("creative_briefs").update({ status: "converted" })
      .eq("id", briefId).select("id, status").single();
    if (marked.error || marked.data?.status !== "converted") {
      return failed(marked.error?.message || "Brief conversion status was not saved", "brief_status");
    }
    const event = await emitTypedEvent({
      idempotencyKey: `brief-converted:${briefId}`,
      type: "brief.converted", objectType: "project", objectId: project!.id,
      businessUnit: "CC", contactId: project!.contact_id,
      text: `Brief converted to project "${project!.title}"`,
      payload: { brief_id: briefId, deliverable_count: manifest.deliverables.length },
    });
    if (!event.ok) return failed(event.error || "Brief conversion handoff failed", "conversion_event");
    return { project, error: null, replayed, partial: false, retryable: false, stage: "complete" };
  } catch {
    return failed("Brief conversion temporarily unavailable", "request");
  }
}

function inferDeliverableType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("video") || lower.includes("film") || lower.includes("reel")) return "video";
  if (lower.includes("photo") || lower.includes("shoot")) return "photo";
  if (lower.includes("graphic") || lower.includes("design") || lower.includes("logo")) return "graphic";
  if (lower.includes("web") || lower.includes("site") || lower.includes("landing")) return "website";
  if (lower.includes("script") || lower.includes("copy")) return "script";
  if (lower.includes("doc") || lower.includes("report") || lower.includes("brief")) return "document";
  return "other";
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
