import { NextResponse } from "next/server";
import {
  buildCreativeBriefHandoffEnvelope,
  normalizeCreativeBriefPayload,
} from "@/lib/creative-brief";
import { emitBlazeHandoff } from "@/lib/blaze-handoff";
import {
  createQuoteDraftFromBriefId,
  renderQuotePdfForQuoteId,
} from "@/lib/creative-brief-quote-draft";
import { renderCreativeBriefProposalPdf } from "@/lib/creative-brief-proposal-pdf";
import { sendTransactionalEmail } from "@/lib/email-sender";
import { BOOKING_CALENDAR_URL } from "@/lib/public-booking";
import { enqueueWorkflowJob } from "@/lib/orchestrator-client";
import { SITE_URL } from "@/lib/seo";
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

function toAbsoluteUrl(pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = SITE_URL.replace(/\/+$/, "");
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${base}${path}`;
}

function buildThankYouEmailHtml(args: {
  name: string;
  company?: string | null;
  bookingUrl: string;
  portalUrl: string;
  quoteAttached: boolean;
  proposalAttached: boolean;
}) {
  const attachmentLine = [
    args.quoteAttached ? "draft quote PDF" : null,
    args.proposalAttached ? "proposal snapshot PDF" : null,
  ].filter(Boolean).join(" and ");

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
      <div style="padding:24px 0;border-bottom:1px solid #e2e8f0;">
        <div style="font-size:20px;font-weight:700;letter-spacing:0.02em;">Content Co-Op</div>
      </div>
      <div style="padding:24px 0 8px;">
        <p style="margin:0 0 14px;">Hi ${args.name || "there"},</p>
        <p style="margin:0 0 14px;line-height:1.7;">We received your creative brief${args.company ? ` for ${args.company}` : ""}. Hermes is routing it now so Bailey has the right context before the call.</p>
        <p style="margin:0 0 14px;line-height:1.7;">Next step: book a 20 min discovery call with Bailey so we can shape scope, timing, and the right production path.</p>
        ${attachmentLine ? `<p style="margin:0 0 18px;line-height:1.7;">Attached: ${attachmentLine}.</p>` : ""}
        <div style="margin:24px 0;">
          <a href="${args.bookingUrl}" style="display:inline-block;padding:12px 24px;background:#1a4fff;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;">Book a 20 min discovery call</a>
        </div>
        <p style="margin:0 0 14px;line-height:1.7;">If you need to review your submission first, your private portal is ready here:</p>
        <p style="margin:0 0 24px;"><a href="${args.portalUrl}" style="color:#1a4fff;text-decoration:none;font-weight:600;">Open your brief portal</a></p>
      </div>
      <div style="padding:16px 0;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
        Sent automatically by Blaze for Content Co-Op.
      </div>
    </div>
  `;
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
      { status: 400 },
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
    return NextResponse.json({ error: "Failed to save brief" }, { status: 500 });
  }

  const portalUrl = `/portal/${data.id}?token=${data.access_token}`;
  const bookingUrl = BOOKING_CALENDAR_URL;
  const absolutePortalUrl = toAbsoluteUrl(portalUrl);
  const absoluteBookingUrl = toAbsoluteUrl(bookingUrl);
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

  const hermes = await emitBlazeHandoff({
    businessUnit: "CC",
    channel: "website",
    sourceSystem: "cco_creative_brief",
    identityHints: {
      brief_id: data.id,
      external_id: data.id,
      email: legacy_form.contact_email,
      phone: legacy_form.phone || null,
      contact_key: handoff.structured_intake.contact.contact_key,
    },
    payload: {
      event_type: "brief_submitted",
      brief_id: data.id,
      status: data.status,
      created_at: data.created_at,
      booking_url: bookingUrl,
      portal_url: portalUrl,
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
    },
    metadata: {
      source_surface: intake.source_surface,
      source_path: intake.source_path,
      structured_fields: structuredFieldPersistence,
    },
  });

  if (!hermes.ok && !hermes.skipped) {
    console.error("Hermes brief intake failed:", hermes.error || hermes.statusCode);
  }

  let quoteDraft: Awaited<ReturnType<typeof createQuoteDraftFromBriefId>> | null = null;
  let quotePdfAttachment: { filename: string; content: string; contentType: string } | null = null;
  let proposalPdfAttachment: { filename: string; content: string; contentType: string } | null = null;

  try {
    quoteDraft = await createQuoteDraftFromBriefId(data.id);
  } catch (quoteError) {
    warnings.push("quote_draft_failed");
    console.error("Creative brief quote draft failed:", quoteError);
  }

  if (quoteDraft?.quote?.id) {
    try {
      const quotePdf = await renderQuotePdfForQuoteId(String(quoteDraft.quote.id));
      quotePdfAttachment = {
        filename: quotePdf.filename,
        content: quotePdf.buffer.toString("base64"),
        contentType: "application/pdf",
      };
    } catch (quotePdfError) {
      warnings.push("quote_pdf_failed");
      console.error("Creative brief quote PDF render failed:", quotePdfError);
    }

    try {
      const proposalPdf = await renderCreativeBriefProposalPdf({
        brief: quoteDraft.normalizedBrief as Record<string, unknown>,
        quote: quoteDraft.quote as Record<string, unknown>,
        bookingUrl: absoluteBookingUrl,
      });
      proposalPdfAttachment = {
        filename: proposalPdf.filename,
        content: proposalPdf.buffer.toString("base64"),
        contentType: "application/pdf",
      };
    } catch (proposalPdfError) {
      warnings.push("proposal_pdf_failed");
      console.error("Creative brief proposal PDF render failed:", proposalPdfError);
    }
  }

  const emailResult = await sendTransactionalEmail({
    to: legacy_form.contact_email,
    from: "Content Co-Op <blaze@contentco-op.com>",
    senderSub: "blaze@contentco-op.com",
    subject: "Creative brief received — book a 20 min discovery call",
    html: buildThankYouEmailHtml({
      name: legacy_form.contact_name,
      company: legacy_form.company || null,
      bookingUrl: absoluteBookingUrl,
      portalUrl: absolutePortalUrl,
      quoteAttached: Boolean(quotePdfAttachment),
      proposalAttached: Boolean(proposalPdfAttachment),
    }),
    businessUnit: "CC",
    attachments: [quotePdfAttachment, proposalPdfAttachment].filter(Boolean) as Array<{
      filename: string;
      content: string;
      contentType?: string;
    }>,
  });

  if (!emailResult.ok) {
    warnings.push("thank_you_email_failed");
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
    workflow: {
      ok: orchestratorJob.ok,
      status_code: orchestratorJob.status,
    },
    email_queued: emailResult.ok,
    persistence: {
      structured_fields: structuredFieldPersistence,
    },
    quote: quoteDraft?.quote
      ? {
          id: quoteDraft.quote.id,
          quote_number: quoteDraft.quote.quote_number,
          estimated_total: quoteDraft.quote.estimated_total,
        }
      : null,
    documents: {
      quote_pdf_attached: Boolean(quotePdfAttachment),
      proposal_pdf_attached: Boolean(proposalPdfAttachment),
    },
    handoff: {
      version: handoff.version,
      event_type: handoff.event_type,
      target: handoff.target,
      contact_key: handoff.structured_intake.contact.contact_key,
      quote_ready: handoff.structured_intake.readiness.quote_ready,
      blockers: handoff.structured_intake.readiness.blockers,
      requested_actions: handoff.root_handoff.requested_actions,
      channels: ["supabase_event", "orchestrator", "hermes", "email"],
      orchestrator: {
        ok: orchestratorJob.ok,
        status_code: orchestratorJob.status,
      },
      hermes: {
        ok: hermes.ok,
        skipped: Boolean(hermes.skipped),
        status_code: hermes.statusCode,
      },
    },
    hermes: {
      ok: hermes.ok,
      skipped: Boolean(hermes.skipped),
      status_code: hermes.statusCode,
    },
  });
}
