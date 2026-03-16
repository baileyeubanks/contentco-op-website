// @ts-nocheck
"use client";

import { Suspense, useEffect, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type {
  CreativeBriefBookingIntent,
  CreativeBriefFormData,
  CreativeBriefSubmissionMode,
} from "@contentco-op/types";

// Local fallback — avoids turbopack resolution flicker
interface CreativeBriefSubmissionResponse {
  id: string;
  access_token: string;
  status: string;
  created_at: string;
  portal_url: string;
}
import { Nav } from "@contentco-op/ui";
import {
  COMPANY_SCALES,
  CONTENT_TYPES,
  CREATIVE_BRIEF_HANDOFF_VERSION,
  CREATIVE_BRIEF_STEPS,
  DELIVERABLE_OPTIONS,
  EMPTY_CREATIVE_BRIEF_FORM,
  QUALITY_TIERS,
  TIMELINE_OPTIONS,
  TRAVEL_OPTIONS,
  estimateCreativeBriefPricing,
  getEstimateBreakdown,
  formatUsd,
  isCreativeBriefBookingIntent,
} from "@/lib/creative-brief";
import { BOOKING_CALENDAR_URL, CREATIVE_BRIEF_PATH } from "@/lib/public-booking";
import s from "./page.module.css";

// ── Extended form state (adds new scoping fields not in base type) ──────────
interface BriefFormState extends CreativeBriefFormData {
  content_types: string[];     // multi-select (primary → content_type on submit)
  scale: string;               // company scale
  quality_tier: string;        // production quality tier
  travel_scope: string;        // travel requirements
  timeline_range: string;      // preferred timeline
  context: string;             // optional free-text context
}

type TextKey = Exclude<keyof BriefFormState, "deliverables" | "booking_intent" | "content_types">;

const BOOKING_STATE_FROM_QUERY: Record<string, CreativeBriefBookingIntent> = {
  planned: "booked_or_planning",
};

const EMPTY_BRIEF_STATE: BriefFormState = {
  ...EMPTY_CREATIVE_BRIEF_FORM,
  content_types: [],
  scale: "",
  quality_tier: "",
  travel_scope: "",
  timeline_range: "",
  context: "",
};

// ── Proposal text generator ──────────────────────────────────────────────────
function generateApproach(state: BriefFormState): string {
  const types = state.content_types;
  const scale = state.scale;
  const quality = state.quality_tier;
  const travel = state.travel_scope;

  const typeText = types.length > 1
    ? `${types.slice(0, -1).join(", ")} and ${types[types.length - 1]}`
    : types[0] ?? "video production";

  const scaleNote = scale === "Fortune 500 / Enterprise"
    ? "Given the enterprise context, we recommend a full-service approach with field producer coordination, dedicated project management, and a senior crew."
    : scale === "Small / Startup"
    ? "We'll keep the production lean and efficient — a tight, experienced crew, targeted shoot days, and streamlined post."
    : "We'll build a professional crew matched to scope — experienced enough to execute at a high level, efficient enough to stay on budget.";

  const travelNote = travel && travel !== "Houston area only"
    ? ` The project includes ${travel.toLowerCase()}, which we'll account for in logistics.`
    : "";

  const qualityNote = quality === "Cinematic"
    ? " Cinematic quality requires our cinema-tier camera package and dedicated color grade."
    : quality === "Premium / Broadcast"
    ? " Premium / broadcast quality means cinema package, B-roll coverage, and broadcast-grade color and audio."
    : "";

  return `${scaleNote}${qualityNote}${travelNote} The scope below is calibrated to your inputs — final crew, schedule, and exact deliverables are confirmed on your strategy call.`;
}

function generateTimeline(state: BriefFormState): Array<{ week: string; task: string }> {
  const weeks = getEstimateBreakdown(
    { ...state, content_type: state.content_types[0] ?? "" },
    { scale: state.scale, qualityTier: state.quality_tier, travelScope: state.travel_scope },
  )?.weeks ?? 4;

  const lines: Array<{ week: string; task: string }> = [
    { week: "Wk 1", task: "Strategy call · scope alignment · creative brief sign-off" },
    { week: "Wk 1–2", task: "Pre-production: location scouting, talent scheduling, shot list" },
  ];

  const shootEnd = weeks <= 3 ? 2 : 3;
  lines.push({ week: `Wk ${shootEnd}`, task: "Principal photography — on-site shoot days" });

  if (weeks > 4) {
    lines.push({ week: `Wk ${shootEnd + 1}–${weeks - 1}`, task: "Post: offline edit, color grade, audio mix, motion graphics" });
    lines.push({ week: `Wk ${weeks}`, task: "Client review rounds · final approval · delivery" });
  } else {
    lines.push({ week: `Wk ${shootEnd + 1}–${weeks}`, task: "Post-production, review rounds & final delivery" });
  }

  return lines;
}

// ── Components ────────────────────────────────────────────────────────────────

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`${s.pill} ${active ? s.pillActive : ""}`} onClick={onClick}>
      {label}
    </button>
  );
}

function ScaleCard({
  label,
  desc,
  active,
  onClick,
}: { label: string; desc: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`${s.scaleCard} ${active ? s.scaleCardActive : ""}`}
      onClick={onClick}
    >
      <span className={s.scaleCardTitle}>{label}</span>
      <span className={s.scaleCardDesc}>{desc}</span>
    </button>
  );
}

// ── Step 1: Contact ───────────────────────────────────────────────────────────
function StepContact({
  form,
  setField,
}: {
  form: BriefFormState;
  setField: (key: TextKey) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
}) {
  return (
    <>
      <h2 className={s.panelTitle}>Who should we reach out to?</h2>
      <p className={s.panelSub}>Name and email are all we need. Phone and company help us prep.</p>

      <div className={s.formGrid}>
        <div className={s.fieldWrap}>
          <label className={s.label}>Name *</label>
          <input className={s.field} value={form.contact_name} onChange={setField("contact_name")} placeholder="Jane Smith" autoComplete="name" />
        </div>
        <div className={s.fieldWrap}>
          <label className={s.label}>Email *</label>
          <input className={s.field} type="email" value={form.contact_email} onChange={setField("contact_email")} placeholder="jane@company.com" autoComplete="email" />
        </div>
        <div className={s.fieldWrap}>
          <label className={s.label}>Phone</label>
          <input className={s.field} type="tel" value={form.phone} onChange={setField("phone")} placeholder="(713) 555-0100" autoComplete="tel" />
        </div>
        <div className={s.fieldWrap}>
          <label className={s.label}>Company</label>
          <input className={s.field} value={form.company} onChange={setField("company")} placeholder="Acme Energy Co." autoComplete="organization" />
        </div>
      </div>
    </>
  );
}

// ── Step 2: Project ───────────────────────────────────────────────────────────
function StepProject({
  form,
  setField,
  setPill,
  toggleContentType,
  toggleDeliverable,
  estimate,
}: {
  form: BriefFormState;
  setField: (key: TextKey) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  setPill: (key: TextKey, value: string) => void;
  toggleContentType: (value: string) => void;
  toggleDeliverable: (value: string) => void;
  estimate: ReturnType<typeof estimateCreativeBriefPricing>;
}) {
  return (
    <>
      <h2 className={s.panelTitle}>Tell us about the project.</h2>
      <p className={s.panelSub}>Select what applies — the more context you give, the tighter the estimate.</p>

      {/* Content type */}
      <div className={s.formSection}>
        <label className={s.label}>
          Content type * <span className={s.labelHint}>select all that apply</span>
        </label>
        <div className={s.pillGrid}>
          {CONTENT_TYPES.map((t) => (
            <Pill key={t} label={t} active={form.content_types.includes(t)} onClick={() => toggleContentType(t)} />
          ))}
        </div>
      </div>

      {/* Scale */}
      <div className={s.formSection}>
        <label className={s.label}>Organization scale</label>
        <div className={s.scaleGrid}>
          <ScaleCard
            label="Fortune 500 / Enterprise"
            desc="Large org, formal approvals, full crew expected"
            active={form.scale === "Fortune 500 / Enterprise"}
            onClick={() => setPill("scale", "Fortune 500 / Enterprise")}
          />
          <ScaleCard
            label="Mid-size Corporate"
            desc="Established company, professional standard required"
            active={form.scale === "Mid-size Corporate"}
            onClick={() => setPill("scale", "Mid-size Corporate")}
          />
          <ScaleCard
            label="Small / Startup"
            desc="Lean budget, tight scope, still needs to look great"
            active={form.scale === "Small / Startup"}
            onClick={() => setPill("scale", "Small / Startup")}
          />
        </div>
      </div>

      {/* Quality tier */}
      <div className={s.formSection}>
        <label className={s.label}>Production quality required</label>
        <div className={s.scaleGrid}>
          <ScaleCard
            label="Corporate Standard"
            desc="Clean, professional — internal comms, training, events"
            active={form.quality_tier === "Corporate Standard"}
            onClick={() => setPill("quality_tier", "Corporate Standard")}
          />
          <ScaleCard
            label="Premium / Broadcast"
            desc="Cinema package, broadcast-grade color + audio"
            active={form.quality_tier === "Premium / Broadcast"}
            onClick={() => setPill("quality_tier", "Premium / Broadcast")}
          />
          <ScaleCard
            label="Cinematic"
            desc="Full cinema tier — RED/ARRI, dual cam, full post suite"
            active={form.quality_tier === "Cinematic"}
            onClick={() => setPill("quality_tier", "Cinematic")}
          />
        </div>
      </div>

      {/* Deliverables */}
      <div className={s.formSection}>
        <label className={s.label}>
          What deliverables do you need? * <span className={s.labelHint}>select all</span>
        </label>
        <div className={s.pillGrid}>
          {DELIVERABLE_OPTIONS.map((d) => (
            <Pill key={d} label={d} active={form.deliverables?.includes(d) ?? false} onClick={() => toggleDeliverable(d)} />
          ))}
        </div>
      </div>

      {/* Travel + Timeline row */}
      <div className={s.formGrid} style={{ marginTop: "1.5rem" }}>
        <div className={s.fieldWrap}>
          <label className={s.label}>Production location</label>
          <input className={s.field} value={form.location} onChange={setField("location")} placeholder="Houston, TX or multiple sites" />
        </div>
        <div className={s.fieldWrap}>
          <label className={s.label}>Travel scope</label>
          <select className={s.field} value={form.travel_scope} onChange={setField("travel_scope")}>
            <option value="">Select travel scope…</option>
            {TRAVEL_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className={s.fieldWrap}>
          <label className={s.label}>Target timeline</label>
          <select className={s.field} value={form.timeline_range} onChange={setField("timeline_range")}>
            <option value="">Select preferred timeline…</option>
            {TIMELINE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className={s.fieldWrap}>
          <label className={s.label}>Hard deadline <span className={s.labelHint}>optional</span></label>
          <p className={s.fieldHint}>Under 28 days triggers a rush fee.</p>
          <input className={s.field} type="date" value={form.deadline} onChange={setField("deadline")} />
        </div>
      </div>

      {/* Live estimate */}
      {estimate && (
        <div className={s.estimateLive}>
          <span className={s.estimateLiveLabel}>Live estimate</span>
          <span className={s.estimateLiveRange}>{formatUsd(estimate.low)} – {formatUsd(estimate.high)}</span>
          <span className={s.estimateLiveMeta}>~{estimate.weeks}-week delivery · tightens after strategy call</span>
        </div>
      )}

      {/* Context */}
      <div className={s.formSection}>
        <label className={s.label}>Anything else we should know? <span className={s.labelHint}>optional</span></label>
        <textarea
          className={s.textarea}
          value={form.context}
          onChange={setField("context")}
          placeholder="Access restrictions, approvals required, key stakeholders, existing assets, or anything that shapes how we'd plan this."
          rows={3}
        />
      </div>
    </>
  );
}

// ── Step 3: Proposal ──────────────────────────────────────────────────────────
function StepProposal({
  form,
  onEdit,
  bookingHref,
}: {
  form: BriefFormState;
  onEdit: (step: number) => void;
  bookingHref: string;
}) {
  const primaryType = form.content_types[0] ?? "";
  const breakdown = getEstimateBreakdown(
    { ...form, content_type: primaryType },
    { scale: form.scale, qualityTier: form.quality_tier, travelScope: form.travel_scope },
  );
  const timeline = generateTimeline(form);
  const approach = generateApproach(form);
  const now = new Date();
  const briefId = `CCO-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

  return (
    <>
      {/* Proposal document */}
      <div className={s.proposalDoc}>
        {/* Header */}
        <div className={s.proposalHeader}>
          <div>
            <div className={s.proposalEyebrow}>Production Brief</div>
            <div className={s.proposalCompany}>
              ContentCo-op{form.company ? ` × ${form.company}` : ""}
            </div>
          </div>
          <div className={s.proposalMeta}>
            <span className={s.proposalId}>{briefId}</span>
            <span className={s.proposalDate}>{now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          </div>
        </div>

        {/* Scope summary */}
        <div className={s.proposalSection}>
          <div className={s.proposalSectionLabel}>Project Scope</div>
          <div className={s.proposalScopePills}>
            {form.content_types.map((t) => (
              <span key={t} className={s.proposalTag}>{t}</span>
            ))}
            {form.scale && <span className={s.proposalTagMuted}>{form.scale}</span>}
            {form.quality_tier && <span className={s.proposalTagMuted}>{form.quality_tier}</span>}
            {form.location && <span className={s.proposalTagMuted}>{form.location}</span>}
            {form.travel_scope && form.travel_scope !== "Houston area only" && (
              <span className={s.proposalTagTravel}>{form.travel_scope}</span>
            )}
          </div>
          {form.context && (
            <p className={s.proposalContextNote}>{form.context}</p>
          )}
        </div>

        {/* Recommended approach */}
        <div className={s.proposalSection}>
          <div className={s.proposalSectionLabel}>Recommended Approach</div>
          <p className={s.proposalApproach}>{approach}</p>
        </div>

        {/* Timeline */}
        {breakdown && (
          <div className={s.proposalSection}>
            <div className={s.proposalSectionLabel}>
              Production Timeline <span className={s.proposalTimelineMeta}>~{breakdown.weeks} weeks total</span>
            </div>
            <div className={s.proposalTimeline}>
              {timeline.map((row) => (
                <div key={row.week} className={s.proposalTimelineRow}>
                  <span className={s.proposalTimelineWk}>{row.week}</span>
                  <span className={s.proposalTimelineTask}>{row.task}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Investment estimate */}
        {breakdown && (
          <div className={s.proposalSection}>
            <div className={s.proposalSectionLabel}>Investment Estimate</div>

            {breakdown.production.length > 0 && (
              <div className={s.estGroup}>
                <span className={s.estGroupLabel}>Production</span>
                {breakdown.production.map((item) => (
                  <div key={item.label} className={s.estLine}>
                    <span className={s.estLineName}>{item.label}</span>
                    <span className={s.estLineDetail}>{item.detail}</span>
                    <span className={s.estLineAmt}>{formatUsd(item.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {breakdown.prePro.length > 0 && (
              <div className={s.estGroup}>
                <span className={s.estGroupLabel}>Pre-Production</span>
                {breakdown.prePro.map((item) => (
                  <div key={item.label} className={s.estLine}>
                    <span className={s.estLineName}>{item.label}</span>
                    <span className={s.estLineDetail}>{item.detail}</span>
                    <span className={s.estLineAmt}>{formatUsd(item.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {breakdown.post.length > 0 && (
              <div className={s.estGroup}>
                <span className={s.estGroupLabel}>Post-Production</span>
                {breakdown.post.map((item) => (
                  <div key={item.label} className={s.estLine}>
                    <span className={s.estLineName}>{item.label}</span>
                    <span className={s.estLineDetail}>{item.detail}</span>
                    <span className={s.estLineAmt}>{formatUsd(item.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {breakdown.addons.length > 0 && (
              <div className={s.estGroup}>
                <span className={s.estGroupLabel}>Deliverables & Add-ons</span>
                {breakdown.addons.map((item) => (
                  <div key={item.label} className={s.estLine}>
                    <span className={s.estLineName}>{item.label}</span>
                    <span className={s.estLineDetail}>{item.detail}</span>
                    <span className={s.estLineAmt}>+{formatUsd(item.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className={s.estGroup}>
              <div className={s.estLine}>
                <span className={s.estLineName}>{breakdown.overhead.label}</span>
                <span className={s.estLineDetail}>{breakdown.overhead.detail}</span>
                <span className={s.estLineAmt}>{formatUsd(breakdown.overhead.amount)}</span>
              </div>
              {breakdown.rush && (
                <div className={`${s.estLine} ${s.estLineRush}`}>
                  <span className={s.estLineName}>{breakdown.rush.label}</span>
                  <span className={s.estLineDetail}>{breakdown.rush.detail}</span>
                  <span className={s.estLineAmt}>+{formatUsd(breakdown.rush.amount)}</span>
                </div>
              )}
            </div>

            <div className={s.estTotal}>
              <span className={s.estTotalLabel}>Total estimate</span>
              <span className={s.estTotalRange}>{formatUsd(breakdown.low)} – {formatUsd(breakdown.high)}</span>
            </div>
            <p className={s.estDisclaimer}>
              Based on Houston commercial production rates (IATSE/AICP scale, 2024–25). ±$1,000 range narrows after scope is confirmed on your strategy call.
            </p>
          </div>
        )}

        {/* Book CTA */}
        <div className={s.proposalBookBlock}>
          <div className={s.proposalBookLeft}>
            <p className={s.proposalBookHeading}>Book 30 minutes with Bailey</p>
            <p className={s.proposalBookNote}>
              Your brief is submitted. The call locks in scope, confirms this estimate, and gets the project moving.
            </p>
          </div>
          <a href={bookingHref} className={s.bookBtn} target="_blank" rel="noopener noreferrer">
            Book your strategy call →
          </a>
        </div>
      </div>

      {/* Compact review — editable */}
      <div className={s.reviewGrid} style={{ marginTop: "1rem" }}>
        <div className={s.reviewSection}>
          <div className={s.reviewHeader}>
            <span className={s.reviewSectionTitle}>Contact</span>
            <button className={s.editBtn} onClick={() => onEdit(0)} type="button">Edit</button>
          </div>
          {[["Name", form.contact_name], ["Email", form.contact_email], ["Phone", form.phone], ["Company", form.company]].map(([k, v]) => (
            v ? (
              <div key={k} className={s.reviewRow}>
                <span className={s.reviewKey}>{k}</span>
                <span className={s.reviewVal}>{v}</span>
              </div>
            ) : null
          ))}
        </div>
        <div className={s.reviewSection}>
          <div className={s.reviewHeader}>
            <span className={s.reviewSectionTitle}>Project</span>
            <button className={s.editBtn} onClick={() => onEdit(1)} type="button">Edit</button>
          </div>
          {form.content_types.length > 0 && (
            <div className={s.reviewRow}>
              <span className={s.reviewKey}>Content</span>
              <span className={s.reviewVal}>{form.content_types.join(", ")}</span>
            </div>
          )}
          {form.scale && (
            <div className={s.reviewRow}>
              <span className={s.reviewKey}>Scale</span>
              <span className={s.reviewVal}>{form.scale}</span>
            </div>
          )}
          {form.quality_tier && (
            <div className={s.reviewRow}>
              <span className={s.reviewKey}>Quality</span>
              <span className={s.reviewVal}>{form.quality_tier}</span>
            </div>
          )}
          {(form.deliverables?.length ?? 0) > 0 && (
            <div className={s.reviewRow}>
              <span className={s.reviewKey}>Deliverables</span>
              <span className={s.reviewVal}>{form.deliverables?.join(", ")}</span>
            </div>
          )}
          {form.travel_scope && (
            <div className={s.reviewRow}>
              <span className={s.reviewKey}>Travel</span>
              <span className={s.reviewVal}>{form.travel_scope}</span>
            </div>
          )}
          {form.timeline_range && (
            <div className={s.reviewRow}>
              <span className={s.reviewKey}>Timeline</span>
              <span className={s.reviewVal}>{form.timeline_range}</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function OnboardContent() {
  const searchParams = useSearchParams();
  const bookingQuery = searchParams.get("booking") || "";
  const [captureMode, setCaptureMode] = useState<CreativeBriefSubmissionMode>("form");
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<BriefFormState>(EMPTY_BRIEF_STATE);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [submission, setSubmission] = useState<CreativeBriefSubmissionResponse | null>(null);

  useEffect(() => {
    const bookingIntent = BOOKING_STATE_FROM_QUERY[bookingQuery];
    if (!bookingIntent) return;
    setForm((current) => {
      if (current.booking_intent === bookingIntent) return current;
      if (current.booking_intent !== "decide_after_brief") return current;
      return { ...current, booking_intent: bookingIntent };
    });
  }, [bookingQuery]);

  const setField = (key: TextKey) => (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setCaptureMode("form");
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const setPill = (key: TextKey, value: string) => {
    setCaptureMode("form");
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleContentType = (value: string) => {
    setCaptureMode("form");
    setForm((current) => ({
      ...current,
      content_types: current.content_types.includes(value)
        ? current.content_types.filter((t) => t !== value)
        : [...current.content_types, value],
      // Keep content_type in sync with first selection for pricing
      content_type: current.content_types.includes(value)
        ? (current.content_types.filter((t) => t !== value)[0] ?? "")
        : current.content_type || value,
    }));
  };

  const toggleDeliverable = (value: string) => {
    setCaptureMode("form");
    setForm((current) => {
      const dels = current.deliverables ?? [];
      return {
        ...current,
        deliverables: dels.includes(value)
          ? dels.filter((d) => d !== value)
          : [...dels, value],
      };
    });
  };

  const canAdvance = () => {
    if (step === 0) {
      return form.contact_name.trim() !== "" && /\S+@\S+\.\S+/.test(form.contact_email);
    }
    if (step === 1) {
      return form.content_types.length > 0 && form.deliverables.length > 0;
    }
    return true;
  };

  const next = () => {
    if (step < CREATIVE_BRIEF_STEPS.length - 1 && canAdvance()) setStep(step + 1);
  };

  const back = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSubmit = async () => {
    setStatus("submitting");
    setErrorMsg("");

    // Merge extended state back to base CreativeBriefFormData
    const primaryType = form.content_types[0] ?? "";
    const contextNote = [
      form.scale && `Scale: ${form.scale}`,
      form.quality_tier && `Quality: ${form.quality_tier}`,
      form.travel_scope && `Travel: ${form.travel_scope}`,
      form.timeline_range && `Timeline: ${form.timeline_range}`,
      form.content_types.length > 1 && `Additional types: ${form.content_types.slice(1).join(", ")}`,
      form.context && form.context,
    ].filter(Boolean).join(" · ");

    try {
      const res = await fetch("/api/briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          content_type: primaryType,
          key_messages: contextNote,
          intake: {
            source_surface: "cco_home",
            source_path: CREATIVE_BRIEF_PATH,
            handoff_version: CREATIVE_BRIEF_HANDOFF_VERSION,
            submission_mode: captureMode,
            booking_intent: form.booking_intent,
          },
        }),
      });

      const data = (await res.json()) as CreativeBriefSubmissionResponse | { error?: string };
      if (!res.ok) {
        throw new Error(data && "error" in data && data.error ? data.error : "Submission failed");
      }

      setSubmission(data as CreativeBriefSubmissionResponse);
      setStatus("success");
    } catch (error) {
      setErrorMsg(
        error instanceof Error && error.message
          ? error.message
          : "Submission failed. Please email brief@contentco-op.com directly.",
      );
      setStatus("error");
    }
  };

  // Estimate (live, updated as user fills out Project step)
  const estimate = estimateCreativeBriefPricing(
    { ...form, content_type: form.content_types[0] ?? "" },
    { scale: form.scale, qualityTier: form.quality_tier, travelScope: form.travel_scope },
  );

  const bookingHref = submission?.booking_url || BOOKING_CALENDAR_URL;
  const bookingReturnBanner = BOOKING_STATE_FROM_QUERY[bookingQuery] === "booked_or_planning";

  return (
    <div className={s.wrap}>
      <Nav surface="brief" />
      <div className={s.shell}>
        <Link href="/" className={s.backLink}>&larr; Back to Home</Link>

        <div className={s.header}>
          <p className={s.kicker}>Project Intake</p>
          <h1 className={s.title}>Creative brief</h1>
          <p className={s.subtitle}>
            Three steps. Under two minutes. Walk away with a real estimate and a booking link.
          </p>
          <p className={s.bookAnchor}>
            Not ready to scope yet?{" "}
            <a href={BOOKING_CALENDAR_URL} target="_blank" rel="noopener noreferrer">
              Book a strategy call directly →
            </a>
          </p>
        </div>

        {bookingReturnBanner && (
          <div className={s.notice}>
            Use the same name and email on the calendar invite and this brief — the team matches them automatically.
          </div>
        )}

        {status === "success" ? (
          <div className={s.success}>
            <div className={s.successIcon}>&#10003;</div>
            <h2 className={s.successTitle}>Brief received.</h2>
            <p className={s.successBody}>
              Your intake is saved. A structured handoff is queued for team review. The estimate below is waiting for you on the call.
            </p>

            {estimate && (
              <div className={s.successEst}>
                <span className={s.successEstLabel}>Preliminary estimate</span>
                <span className={s.successEstRange}>
                  {formatUsd(estimate.low)} – {formatUsd(estimate.high)}
                </span>
                <span className={s.successEstMeta}>~{estimate.weeks}-week delivery window</span>
              </div>
            )}

            <div className={s.successActions}>
              <a href={bookingHref} className={s.portalLink} target="_blank" rel="noopener noreferrer">
                Book 30 minutes with Bailey →
              </a>
              {submission?.portal_url && (
                <a href={submission.portal_url} className={s.portalLinkSecondary}>
                  Open your project portal
                </a>
              )}
            </div>

            <div className={s.successMeta}>
              <span>Team reviews your brief and matches it to your call using the same contact details.</span>
            </div>
          </div>
        ) : (
          <>
            <div className={s.progress}>
              {CREATIVE_BRIEF_STEPS.map((label, index) => (
                <div
                  key={label}
                  className={`${s.step} ${index < step ? s.stepDone : ""}`}
                  onClick={() => { if (index < step) setStep(index); }}
                  style={{ cursor: index < step ? "pointer" : "default" }}
                >
                  <div className={`${s.stepDot} ${index === step ? s.stepDotActive : ""} ${index < step ? s.stepDotDone : ""}`}>
                    {index < step ? "\u2713" : index + 1}
                  </div>
                  <span className={`${s.stepLabel} ${index === step ? s.stepLabelActive : ""}`}>{label}</span>
                </div>
              ))}
            </div>

            <div className={s.panel}>
              {step === 0 && <StepContact form={form} setField={setField} />}
              {step === 1 && (
                <StepProject
                  form={form}
                  setField={setField}
                  setPill={setPill}
                  toggleContentType={toggleContentType}
                  toggleDeliverable={toggleDeliverable}
                  estimate={estimate}
                />
              )}
              {step === 2 && <StepProposal form={form} onEdit={setStep} bookingHref={bookingHref} />}

              <div className={s.navRow}>
                {step > 0 ? (
                  <button className={s.btnBack} onClick={back} type="button">Back</button>
                ) : (
                  <div />
                )}

                {step < CREATIVE_BRIEF_STEPS.length - 1 ? (
                  <button className={s.btnNext} onClick={next} disabled={!canAdvance()} type="button">
                    Continue
                  </button>
                ) : (
                  <button
                    className={s.btnSubmit}
                    onClick={handleSubmit}
                    disabled={status === "submitting"}
                    type="button"
                  >
                    {status === "submitting" ? "Submitting…" : "Submit brief"}
                  </button>
                )}
              </div>

              {errorMsg && <p className={s.errorText}>{errorMsg}</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function OnboardPage() {
  return (
    <Suspense
      fallback={(
        <div className={s.wrap}>
          <Nav surface="brief" />
          <div className={s.shell} />
        </div>
      )}
    >
      <OnboardContent />
    </Suspense>
  );
}
