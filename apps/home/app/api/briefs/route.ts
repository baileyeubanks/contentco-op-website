import { NextResponse } from "next/server";
import {
  buildCreativeBriefHandoffEnvelope,
  normalizeCreativeBriefPayload,
} from "@/lib/creative-brief";
import { BOOKING_CALENDAR_URL } from "@/lib/public-booking";
import { enqueueWorkflowJob } from "@/lib/orchestrator-client";
import { invokeOpenClawTask } from "@/lib/openclaw";
import { supabase } from "@/lib/supabase";

function isMissingStructuredColumnError(error: unknown) {
  const message = typeof error === "object" && error && "message" in error
    ? String((error as { message?: string }).message || "")
    : String(error || "");
  const details = typeof error === "object" && error && "details" in error
    ? String((error as { details?: string }).details || "")
    : "";
  const combined = `${message} ${details}`.toLowerCase();

  return (
    combined.includes("column") &&
    (
      combined.includes("booking_intent") ||
      combined.includes("source_surface") ||
      combined.includes("source_path") ||
      combined.includes("submission_mode") ||
      combined.includes("intake_payload") ||
      combined.includes("structured_intake") ||
      combined.includes("handoff_payload")
    )
  );
}

async function findContentCoOpBusinessId() {
  const { data, error } = await supabase
    .from("businesses")
    .select("id")
    .eq("name", "Content Co-op")
    .maybeSingle();

  if (error) {
    console.warn("Unable to resolve Content Co-op business id for brief event payload.", error);
    return null;
  }

  return data?.id ? String(data.id) : null;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payload = normalizeCreativeBriefPayload(body);
  const { contact_input, legacy_form, diagnostic, summary_card, recommendation, quote_signal } = payload;
  if (!contact_input.name || !contact_input.email || !contact_input.phone) {
    return NextResponse.json(
      { error: "name, email, and phone are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("creative_briefs")
    .insert({
      contact_name: legacy_form.contact_name,
      contact_email: legacy_form.contact_email,
      phone: legacy_form.phone || null,
      company: legacy_form.company || null,
      role: legacy_form.role || null,
      location: legacy_form.location || null,
      content_type: legacy_form.content_type || null,
      deliverables: legacy_form.deliverables || null,
      audience: legacy_form.audience || null,
      tone: legacy_form.tone || null,
      deadline: legacy_form.deadline || null,
      objective: legacy_form.objective || null,
      key_messages: legacy_form.key_messages || null,
      references: legacy_form.references || null,
    })
    .select("id, access_token, status, created_at")
    .single();

  if (error) {
    console.error("Supabase insert error:", error);
    return NextResponse.json(
      { error: "Failed to save brief" },
      { status: 500 }
    );
  }

  const portalUrl = `/portal/${data.id}?token=${data.access_token}`;
  const bookingUrl = BOOKING_CALENDAR_URL;
  const intake = payload.intake;
  const handoff = buildCreativeBriefHandoffEnvelope({
    briefId: data.id,
    bookingUrl,
    payload,
    portalUrl,
  });

  const warnings: string[] = [];
  let structuredFieldPersistence: "full" | "legacy_only" = "full";

  const { error: structuredUpdateError } = await supabase
    .from("creative_briefs")
    .update({
      constraints: legacy_form.constraints || null,
      booking_intent: legacy_form.booking_intent,
      submission_mode: intake.submission_mode,
      source_surface: intake.source_surface,
      source_path: intake.source_path,
      intake_payload: payload,
      structured_intake: handoff.structured_intake,
      handoff_payload: handoff,
    })
    .eq("id", data.id)
    .select("id")
    .maybeSingle();

  if (structuredUpdateError) {
    if (isMissingStructuredColumnError(structuredUpdateError)) {
      structuredFieldPersistence = "legacy_only";
      warnings.push("structured_fields_pending_migration");
      console.warn("Creative brief persisted without structured columns; migration still pending.", structuredUpdateError);
      const { error: legacyUpdateError } = await supabase
        .from("creative_briefs")
        .update({
          constraints: legacy_form.constraints || null,
        })
        .eq("id", data.id)
        .select("id")
        .maybeSingle();
      if (legacyUpdateError) {
        console.error("Creative brief legacy constraint update failed after structured-column fallback:", legacyUpdateError);
      }
    } else {
      warnings.push("structured_fields_persist_failed");
      console.error("Creative brief structured persistence failed:", structuredUpdateError);
    }
  }

  // Insert into events table using the legacy production schema so fallback readers
  // can still recover the full handoff while the structured brief columns are pending.
  try {
    const contentCoOpBusinessId = await findContentCoOpBusinessId();
    await supabase.from("events").insert({
      type: "brief_submitted",
      business_id: contentCoOpBusinessId,
      business_unit: "CC",
      channel: "home",
      direction: "inbound",
      event_version: handoff.version,
      metadata: {
        source_surface: intake.source_surface,
        source_path: intake.source_path,
        persistence: structuredFieldPersistence,
      },
      payload: {
        brief_id: data.id,
        portal_url: portalUrl,
        booking_url: bookingUrl,
        contact_name: legacy_form.contact_name,
        contact_email: legacy_form.contact_email,
        phone: legacy_form.phone || null,
        company: legacy_form.company || null,
        content_type: legacy_form.content_type || null,
        deliverables: legacy_form.deliverables || null,
        objective: legacy_form.objective || null,
        deadline: legacy_form.deadline || null,
        references: legacy_form.references || null,
        intake_payload: payload,
        structured_intake: handoff.structured_intake,
        handoff,
      },
    });
  } catch (eventInsertError) {
    console.warn("Creative brief event bridge insert failed; continuing with direct API response.", eventInsertError);
    // non-fatal — event bridge notification only
  }

  const orchestratorJob = await enqueueWorkflowJob({
    workflowId: "brief-to-quote",
    type: "brief_submitted",
    idempotencyKey: `brief_submitted:${data.id}`,
    entity: { type: "creative_brief", id: data.id },
    event: {
      name: "brief_submitted",
      version: handoff.version,
      sourceSurface: "home",
      actorType: "external_share_actor",
      subject: { type: "creative_brief", id: data.id },
      correlationId: data.id,
      causationId: null,
      idempotencyKey: `brief_submitted:${data.id}`,
      workflowState: "queued",
      payload: handoff as unknown as Record<string, unknown>,
      timestamp: new Date().toISOString(),
    },
    payload: handoff as unknown as Record<string, unknown>,
    steps: ["source_context", "brief_validation"],
  });

  const openclaw = await invokeOpenClawTask({
    taskType: "research",
    businessUnit: "CC",
    prompt:
      "A new Content Co-op brief just arrived. Summarize the request, identify missing information, recommend the first follow-up, and draft a concise human acknowledgment.",
    context: {
      trigger: "brief_lead_intake",
      brief_id: data.id,
      status: data.status,
      created_at: data.created_at,
      brief: {
        contact_name: legacy_form.contact_name,
        contact_email: legacy_form.contact_email,
        phone: legacy_form.phone || null,
        company: legacy_form.company || null,
        role: legacy_form.role || null,
        location: legacy_form.location || null,
        content_type: legacy_form.content_type || null,
        deliverables: legacy_form.deliverables || null,
        audience: legacy_form.audience || null,
        tone: legacy_form.tone || null,
        deadline: legacy_form.deadline || null,
        objective: legacy_form.objective || null,
        key_messages: legacy_form.key_messages || null,
        diagnostic,
        recommendation,
        quote_signal,
      },
      portal_url: portalUrl,
    },
    timeoutMs: Number(process.env.OPENCLAW_TASK_TIMEOUT_MS || 4000),
  });

  if (!openclaw.ok && !openclaw.skipped) {
    console.error("OpenClaw brief intake failed:", openclaw.error || openclaw.statusCode);
  }

  return NextResponse.json({
    id: data.id,
    access_token: data.access_token,
    status: data.status,
    created_at: data.created_at,
    portal_url: portalUrl,
    booking_url: bookingUrl,
    summary: summary_card,
    warnings: warnings.length > 0 ? warnings : undefined,
    persistence: {
      structured_fields: structuredFieldPersistence,
    },
    handoff: {
      version: handoff.version,
      event_type: handoff.event_type,
      target: handoff.target,
      contact_key: handoff.structured_intake.contact.contact_key,
      quote_ready: handoff.structured_intake.readiness.quote_ready,
      blockers: handoff.structured_intake.readiness.blockers,
      requested_actions: handoff.root_handoff.requested_actions,
      channels: ["supabase_event", "orchestrator", "openclaw"],
      orchestrator: {
        ok: orchestratorJob.ok,
        status_code: orchestratorJob.status,
      },
      openclaw: {
        ok: openclaw.ok,
        skipped: Boolean(openclaw.skipped),
        status_code: openclaw.statusCode,
      },
    },
    openclaw: {
      ok: openclaw.ok,
      skipped: Boolean(openclaw.skipped),
      status_code: openclaw.statusCode,
    },
  });
}
