import { NextResponse } from "next/server";
import { invokeOpenClawTask } from "@/lib/openclaw";
import { supabase } from "@/lib/supabase";

interface Props {
  params: Promise<{ id: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function briefNeedsStructuredFallback(brief: Record<string, unknown>) {
  return !isRecord(brief.structured_intake) && !isRecord(brief.intake_payload);
}

async function withSubmittedBriefPayloadFallback(brief: Record<string, unknown>) {
  if (!briefNeedsStructuredFallback(brief) || !brief.id) {
    return brief;
  }

  const { data } = await supabase
    .from("events")
    .select("payload")
    .eq("type", "brief_submitted")
    .contains("payload", { brief_id: String(brief.id) })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!isRecord(data?.payload)) {
    return brief;
  }

  return {
    ...brief,
    structured_intake: isRecord(data.payload.structured_intake) ? data.payload.structured_intake : brief.structured_intake,
    intake_payload: isRecord(data.payload.intake_payload) ? data.payload.intake_payload : brief.intake_payload,
  };
}

function parseList(value: string | null | undefined) {
  return String(value || "")
    .split(/\n|,|•/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function daysUntil(dateValue: string | null | undefined) {
  if (!dateValue) return null;
  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - Date.now()) / 86400000);
}

function estimateBase(contentType: string | null | undefined) {
  const key = String(contentType || "").toLowerCase();
  if (key.includes("customer") || key.includes("case")) return 6800;
  if (key.includes("executive") || key.includes("thought")) return 5400;
  if (key.includes("brand") || key.includes("anthem")) return 7600;
  if (key.includes("event")) return 4200;
  if (key.includes("social")) return 3200;
  return 4800;
}

function buildDraftFromBrief(brief: Record<string, unknown>) {
  const structured = (brief.structured_intake && typeof brief.structured_intake === "object")
    ? (brief.structured_intake as Record<string, unknown>)
    : null;
  const project = structured && typeof structured.project === "object"
    ? (structured.project as Record<string, unknown>)
    : null;
  const recommendation = structured && typeof structured.recommendation === "object"
    ? (structured.recommendation as Record<string, unknown>)
    : null;
  const quoteSignal = structured && typeof structured.quote_signal === "object"
    ? (structured.quote_signal as Record<string, unknown>)
    : null;
  const diagnostic = structured && typeof structured.diagnostic === "object"
    ? (structured.diagnostic as Record<string, unknown>)
    : null;
  const deliverables = parseList(String(project?.deliverables || brief.deliverables || ""));
  const references = parseList(String(project?.references || brief.references || ""));
  const keyMessages = parseList(String(project?.key_messages || brief.key_messages || ""));
  const base = typeof recommendation?.starting_range_low === "number"
    ? recommendation.starting_range_low
    : typeof quoteSignal?.base_range_low === "number"
      ? quoteSignal.base_range_low
      : estimateBase(String(project?.content_type || brief.content_type || ""));
  const deliverableBonus = Math.max(0, deliverables.length - 1) * 450;
  const rushDays = daysUntil(String(project?.deadline || brief.deadline || ""));
  const rushMultiplier = quoteSignal?.rush === true || (rushDays != null && rushDays <= 14) ? 1.2 : 1;

  const discovery = Math.round((base * 0.18) / 50) * 50;
  const production = Math.round(((base * 0.46) + deliverableBonus * 0.5) / 50) * 50;
  const post = Math.round(((base * 0.36) + deliverableBonus * 0.5) / 50) * 50;
  const rush = rushMultiplier > 1 ? Math.round(((discovery + production + post) * (rushMultiplier - 1)) / 50) * 50 : 0;
  const total = discovery + production + post + rush;

  const phases = [
    {
      title: "Phase 1 — Discovery & Story Architecture",
      scheduleLabel: String(brief.deadline || "").trim() ? `Target delivery: ${String(brief.deadline).trim()}` : "Initial strategy window",
      narrative: [
        String(brief.objective || "Clarify the business objective and shape the story before production.").trim(),
        keyMessages.length ? `Key messages: ${keyMessages.join("; ")}` : "Translate the brief into a production-ready narrative outline.",
      ].filter(Boolean),
      items: [
        { description: "Creative brief analysis + story architecture", quantity: 1, unit_price: discovery },
      ],
    },
    {
      title: "Phase 2 — Production",
      scheduleLabel: String(brief.location || "").trim() || "Production schedule TBD",
      narrative: [
        deliverables.length ? `Planned outputs: ${deliverables.join(", ")}` : "Capture interviews, b-roll, and supporting material required for the core deliverable.",
        references.length ? `Reference direction: ${references.join("; ")}` : "Production scope will be tuned to the final schedule and stakeholder approvals.",
      ].filter(Boolean),
      items: [
        { description: "Field production / interview capture", quantity: 1, unit_price: production },
      ],
    },
    {
      title: "Phase 3 — Edit, Review & Delivery",
      scheduleLabel: rush ? "Accelerated turnaround requested" : "Standard review cycle",
      narrative: [
        String(brief.tone || "").trim() ? `Tone: ${String(brief.tone).trim()}` : "Edit, review rounds, finishing, and final delivery.",
      ].filter(Boolean),
      items: [
        { description: "Post-production, review, and final delivery", quantity: 1, unit_price: post },
        ...(rush ? [{ description: "Rush turnaround", quantity: 1, unit_price: rush }] : []),
      ],
    },
  ];

  const items = phases.flatMap((phase) => phase.items);
  return {
    estimatedTotal: total,
    items,
    doc: {
      title: "Price Quote",
      reference: String(brief.company || brief.contact_name || "Content Co-op Project").trim(),
      payment_terms: "50% to reserve production, balance on final delivery",
      payment_note: "Final scope and scheduling are subject to internal review and client approval.",
      notes_terms: [
        "Quote is valid for 14 days from issue date.",
        "Scheduling and travel are subject to crew availability.",
        "Additional deliverables or revision rounds may require a change order.",
      ],
      project: {
        title: String(brief.company || brief.contact_name || "Content Co-op Project").trim(),
        meta: [
          recommendation?.recommended_video_type || project?.content_type || brief.content_type,
          brief.location,
          project?.deadline || brief.deadline,
        ].filter(Boolean),
        summary: [
          project?.objective || brief.objective,
          project?.audience || brief.audience,
          diagnostic?.placement ? `Placement: ${String(diagnostic.placement)}` : null,
        ].filter(Boolean).map((value) => String(value)),
      },
      bill_to: {
        name: String(brief.contact_name || "").trim(),
        company: String(brief.company || "").trim(),
        email: String(brief.contact_email || "").trim(),
      },
      phases,
    },
  };
}

async function findOrCreateCcContact(brief: Record<string, unknown>, businessId: string) {
  const email = String(brief.contact_email || "").trim().toLowerCase();
  const phone = String(brief.phone || "").trim();

  let existing = null;
  if (email) {
    const { data } = await supabase.from("contacts").select("*").eq("email", email).maybeSingle();
    existing = data;
  }
  if (!existing && phone) {
    const { data } = await supabase.from("contacts").select("*").eq("phone", phone).maybeSingle();
    existing = data;
  }

  const payload = {
    name: String(brief.contact_name || brief.company || "Content Co-op Lead").trim(),
    email: email || null,
    phone: phone || null,
    company: String(brief.company || "").trim() || null,
    metadata: {
      source: "creative_brief",
      brief_id: brief.id,
    },
  };

  let contact = existing;
  if (existing?.id) {
    const { data, error } = await supabase.from("contacts").update(payload).eq("id", existing.id).select("*").single();
    if (error) throw error;
    contact = data;
  } else {
    const { data, error } = await supabase.from("contacts").insert(payload).select("*").single();
    if (error) throw error;
    contact = data;
  }

  await supabase.from("contact_business_map").upsert({ contact_id: contact.id, business_id: businessId }, { onConflict: "contact_id,business_id" });
  return contact;
}

export async function POST(_req: Request, { params }: Props) {
  const { id } = await params;

  const { data: brief, error } = await supabase
    .from("creative_briefs")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !brief) {
    return NextResponse.json({ error: "brief_not_found" }, { status: 404 });
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("name", "Content Co-op")
    .maybeSingle();

  if (!business?.id) {
    return NextResponse.json({ error: "content_co_op_business_missing" }, { status: 500 });
  }

  const normalizedBrief = await withSubmittedBriefPayloadFallback(brief as Record<string, unknown>);
  const contact = await findOrCreateCcContact(normalizedBrief, business.id);
  const draft = buildDraftFromBrief(normalizedBrief);

  let advisory: unknown = null;
  const openclaw = await invokeOpenClawTask({
    taskType: "research",
    businessUnit: "CC",
    prompt: "Turn this creative brief into a phased quote recommendation. Suggest phase naming, scope language, and any pricing/risk notes for internal review.",
    context: {
      trigger: "creative_brief_to_quote_draft",
      brief_id: brief.id,
      brief: normalizedBrief,
      current_draft: draft,
    },
    timeoutMs: Number(process.env.OPENCLAW_TASK_TIMEOUT_MS || 4000),
  });
  if (openclaw.ok) {
    advisory = openclaw.payload;
  }

  const issueDate = new Date();
  const validUntil = new Date(issueDate.getTime() + 14 * 86400000);

  const quotePayload = {
    doc: {
      ...draft.doc,
      issue_date: issueDate.toISOString().slice(0, 10),
      valid_until: validUntil.toISOString().slice(0, 10),
      advisory,
      source: {
        brief_id: brief.id,
        trigger: "creative_brief",
      },
    },
    items: draft.items,
  };

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      contact_id: contact.id,
      business_id: business.id,
      business_unit: "CC",
      status: "pending",
      internal_status: "pending_internal",
      client_status: "not_sent",
      issue_date: issueDate.toISOString().slice(0, 10),
      valid_until: validUntil.toISOString().slice(0, 10),
      payment_terms: draft.doc.payment_terms,
      client_name: String(brief.contact_name || "").trim() || null,
      client_email: String(brief.contact_email || "").trim() || null,
      client_phone: String(brief.phone || "").trim() || null,
      service_address: String(brief.location || "").trim() || null,
      estimated_total: draft.estimatedTotal,
      notes: "Auto-generated from Content Co-op creative brief. Internal review required before sending.",
      payload: quotePayload,
    })
    .select("id, quote_number, estimated_total, status, internal_status, client_status")
    .single();

  if (quoteError || !quote) {
    return NextResponse.json({ error: quoteError?.message || "quote_insert_failed" }, { status: 500 });
  }

  const quoteItems = draft.items.map((item, index) => ({
    quote_id: quote.id,
    sort_order: index + 1,
    name: item.description,
    description: null,
    quantity: item.quantity,
    unit_price: item.unit_price,
  }));
  await supabase.from("quote_items").insert(quoteItems);

  await supabase.from("events").insert({
    type: "cc_quote_draft_created",
    business_id: business.id,
    contact_id: contact.id,
    payload: {
      brief_id: brief.id,
      quote_id: quote.id,
      estimated_total: draft.estimatedTotal,
    },
  });

  return NextResponse.json({
    ok: true,
    quote,
    advisory_used: Boolean(advisory),
  });
}
