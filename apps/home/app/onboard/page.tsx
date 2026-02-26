"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import s from "./page.module.css";

const VoiceBrief = dynamic(() => import("./voice-brief"), { ssr: false });

/* ── Options ── */

const CONTENT_TYPES = [
  "Safety Film",
  "Training Video",
  "Brand Reel",
  "Culture Story",
  "Thought Piece",
  "Change Comms",
  "Event Coverage",
  "Facility Tour",
  "Product Demo",
  "Mini-Series",
  "Testimonial",
  "Other",
];

const DELIVERABLES_OPTS = [
  "Final Cut",
  "Raw Files",
  "Social Cuts",
  "Vertical Cuts",
  "Script Only",
  "Full Series",
  "B-Roll Pack",
  "Rough Cut",
  "Highlights Reel",
  "Photo Package",
];

const AUDIENCES = [
  "Field Ops",
  "Plant Leadership",
  "Executive",
  "External",
  "Multi-Audience",
];

const TONES = [
  "Cinematic",
  "Corporate",
  "Documentary",
  "Training",
  "Mixed",
];

const OBJECTIVES = [
  "Drive Behavior",
  "Inform & Align",
  "Build Trust",
  "Train / Onboard",
  "Showcase Work",
];

const STEPS = ["Contact", "Scope", "Details", "Review"];

/* ── Pricing engine ── */

const TIERS: Record<string, [number, number, number]> = {
  //                         [low,   high,    weeks]
  "Safety Film":             [5000,  12000,   4],
  "Training Video":          [6000,  15000,   5],
  "Brand Reel":              [18000, 45000,   8],
  "Culture Story":           [12000, 30000,   6],
  "Thought Piece":           [8000,  22000,   5],
  "Change Comms":            [8000,  20000,   4],
  "Event Coverage":          [4000,  10000,   3],
  "Facility Tour":           [10000, 25000,   5],
  "Product Demo":            [6000,  16000,   4],
  "Mini-Series":             [40000, 100000,  14],
  "Testimonial":             [3000,  8000,    3],
  "Other":                   [8000,  25000,   6],
};

const DELIVERABLE_ADD: Record<string, [number, number]> = {
  "Raw Files":               [500,   1500],
  "Social Cuts":             [2000,  5000],
  "Vertical Cuts":           [1500,  3500],
  "Full Series":             [20000, 60000],
  "B-Roll Pack":             [2000,  5000],
  "Highlights Reel":         [1500,  3000],
  "Photo Package":           [3000,  7000],
};

function estimatePricing(form: FormState): { low: number; high: number; weeks: number } | null {
  if (!form.content_type) return null;
  const [baseLow, baseHigh, baseWeeks] = TIERS[form.content_type] ?? [8000, 25000, 6];
  let addLow = 0, addHigh = 0;
  for (const d of form.deliverables) {
    const [al, ah] = DELIVERABLE_ADD[d] ?? [0, 0];
    addLow += al;
    addHigh += ah;
  }
  let rush = 1.0;
  if (form.deadline) {
    const days = (new Date(form.deadline).getTime() - Date.now()) / 86400000;
    if (days < 14) rush = 1.4;
    else if (days < 28) rush = 1.2;
  }
  return {
    low: Math.round((baseLow + addLow) * rush / 500) * 500,
    high: Math.round((baseHigh + addHigh) * rush / 500) * 500,
    weeks: baseWeeks,
  };
}

function fmtMoney(n: number) {
  return "$" + n.toLocaleString("en-US");
}

/* ── Form state ── */

interface FormState {
  contact_name: string;
  contact_email: string;
  phone: string;
  company: string;
  role: string;
  location: string;
  content_type: string;
  deliverables: string[];
  audience: string;
  tone: string;
  deadline: string;
  objective: string;
  key_messages: string;
  references: string;
}

// Keys that map to string values (safe to use with event-based `set` handler)
type TextKey = Exclude<keyof FormState, "deliverables">;

const empty: FormState = {
  contact_name: "",
  contact_email: "",
  phone: "",
  company: "",
  role: "",
  location: "",
  content_type: "",
  deliverables: [],
  audience: "",
  tone: "",
  deadline: "",
  objective: "",
  key_messages: "",
  references: "",
};

/* ── Main ── */

export default function OnboardPage() {
  const [mode, setMode] = useState<"form" | "voice">("form");
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(empty);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [portalUrl, setPortalUrl] = useState("");

  function handleVoiceComplete(voiceForm: FormState) {
    setForm(voiceForm);
    setStep(3); // Jump to review
    setMode("form"); // Switch back to form mode to show review
  }

  // Text/date/select input handler
  const set = (k: TextKey) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Single-select pill
  const setPill = (k: TextKey, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Multi-select deliverable toggle
  const toggleDeliverable = (v: string) =>
    setForm((f) => ({
      ...f,
      deliverables: f.deliverables.includes(v)
        ? f.deliverables.filter((d) => d !== v)
        : [...f.deliverables, v],
    }));

  const canAdvance = () => {
    if (step === 0) return form.contact_name.trim() !== "" && form.contact_email.trim() !== "";
    if (step === 1) return form.content_type !== "" && form.deliverables.length > 0;
    return true;
  };

  const next = () => { if (step < 3 && canAdvance()) setStep(step + 1); };
  const back = () => { if (step > 0) setStep(step - 1); };

  const handleSubmit = async () => {
    setStatus("submitting");
    try {
      const res = await fetch("/api/briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          deliverables: form.deliverables.join(", "),
        }),
      });
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      setPortalUrl(`/portal/${data.id}?token=${data.access_token}`);
      setStatus("success");
    } catch {
      setErrorMsg("Submission failed — please email brief@contentco-op.com directly.");
      setStatus("error");
    }
  };

  const est = estimatePricing(form);

  return (
    <div className={s.wrap}>
      <div className={s.shell}>
        <Link href="/" className={s.backLink}>&larr; Back to Home</Link>

        <div className={s.header}>
          <p className={s.kicker}>Onboarding</p>
          <h1 className={s.title}>Start Your Project</h1>
          <p className={s.subtitle}>Four quick steps. We&apos;ll handle the rest.</p>

          {/* Mode toggle */}
          <div className={s.modeToggle}>
            <button
              type="button"
              className={`${s.modeBtn} ${mode === "form" ? s.modeBtnActive : ""}`}
              onClick={() => setMode("form")}
            >
              Fill out form
            </button>
            <button
              type="button"
              className={`${s.modeBtn} ${mode === "voice" ? s.modeBtnActive : ""}`}
              onClick={() => setMode("voice")}
            >
              Talk to AI
            </button>
          </div>
        </div>

        {mode === "voice" && status !== "success" ? (
          <VoiceBrief onComplete={handleVoiceComplete} />
        ) : status === "success" ? (
          <div className={s.success}>
            <div className={s.successIcon}>&#10003;</div>
            <h2 className={s.successTitle}>Brief received.</h2>
            <p className={s.successBody}>
              We&apos;ll review your brief and reach out to {form.contact_email} within one
              business day. Track status, upload files, and message our team from your portal.
            </p>
            {est && (
              <div className={s.successEst}>
                <span className={s.successEstLabel}>Preliminary estimate</span>
                <span className={s.successEstRange}>{fmtMoney(est.low)} – {fmtMoney(est.high)}</span>
                <span className={s.successEstMeta}>~{est.weeks}-week delivery</span>
              </div>
            )}
            {portalUrl && (
              <a href={portalUrl} className={s.portalLink}>Open Your Portal &rarr;</a>
            )}
          </div>
        ) : (
          <>
            {/* Progress */}
            <div className={s.progress}>
              {STEPS.map((label, i) => (
                <div
                  key={label}
                  className={`${s.step} ${i < step ? s.stepDone : ""}`}
                  onClick={() => { if (i < step) setStep(i); }}
                  style={{ cursor: i < step ? "pointer" : "default" }}
                >
                  <div className={`${s.stepDot} ${i === step ? s.stepDotActive : ""} ${i < step ? s.stepDotDone : ""}`}>
                    {i < step ? "\u2713" : i + 1}
                  </div>
                  <span className={`${s.stepLabel} ${i === step ? s.stepLabelActive : ""}`}>
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* Step panels */}
            <div className={s.panel}>
              {step === 0 && <StepContact form={form} set={set} />}
              {step === 1 && <StepScope form={form} set={set} setPill={setPill} toggleDeliverable={toggleDeliverable} />}
              {step === 2 && <StepDetails form={form} set={set} setPill={setPill} />}
              {step === 3 && <StepReview form={form} onEdit={setStep} est={est} />}

              {/* Nav */}
              <div className={s.navRow}>
                {step > 0 ? (
                  <button className={s.btnBack} onClick={back} type="button">Back</button>
                ) : <div />}

                {step < 3 ? (
                  <button
                    className={s.btnNext}
                    onClick={next}
                    disabled={!canAdvance()}
                    type="button"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    className={s.btnSubmit}
                    onClick={handleSubmit}
                    disabled={status === "submitting"}
                    type="button"
                  >
                    {status === "submitting" ? "Submitting\u2026" : "Submit Brief"}
                  </button>
                )}
              </div>

              {errorMsg && (
                <p style={{ color: "#de7676", fontSize: ".82rem", marginTop: ".8rem", textAlign: "center" }}>
                  {errorMsg}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Pill (shared) ── */

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`${s.pill} ${active ? s.pillActive : ""}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

/* ── Step 1: Contact ── */

function StepContact({ form, set }: {
  form: FormState;
  set: (k: TextKey) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
}) {
  return (
    <>
      <h2 className={s.panelTitle}>Who are you?</h2>
      <p className={s.panelSub}>Tell us who we&apos;re working with.</p>
      <div className={s.formGrid}>
        <div className={s.fieldWrap}>
          <label className={s.label}>Your name *</label>
          <input className={s.field} value={form.contact_name} onChange={set("contact_name")} placeholder="Jane Smith" required />
        </div>
        <div className={s.fieldWrap}>
          <label className={s.label}>Email *</label>
          <input className={s.field} type="email" value={form.contact_email} onChange={set("contact_email")} placeholder="jane@company.com" required />
        </div>
        <div className={s.fieldWrap}>
          <label className={s.label}>Phone</label>
          <input className={s.field} type="tel" value={form.phone} onChange={set("phone")} placeholder="(713) 555-0100" />
        </div>
        <div className={s.fieldWrap}>
          <label className={s.label}>Company</label>
          <input className={s.field} value={form.company} onChange={set("company")} placeholder="Acme Energy Co." />
        </div>
        <div className={s.fieldWrap}>
          <label className={s.label}>Your role</label>
          <input className={s.field} value={form.role} onChange={set("role")} placeholder="Director of Communications" />
        </div>
        <div className={s.fieldWrap}>
          <label className={s.label}>Location</label>
          <input className={s.field} value={form.location} onChange={set("location")} placeholder="Houston, TX" />
        </div>
      </div>
    </>
  );
}

/* ── Step 2: Scope ── */

function StepScope({ form, set, setPill, toggleDeliverable }: {
  form: FormState;
  set: (k: TextKey) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  setPill: (k: TextKey, v: string) => void;
  toggleDeliverable: (v: string) => void;
}) {
  return (
    <>
      <h2 className={s.panelTitle}>What do you need?</h2>
      <p className={s.panelSub}>Scope the project. Your selections generate a preliminary estimate.</p>

      <div className={s.formSection}>
        <label className={s.label}>Content type *</label>
        <div className={s.pillGrid}>
          {CONTENT_TYPES.map((t) => (
            <Pill key={t} label={t} active={form.content_type === t} onClick={() => setPill("content_type", t)} />
          ))}
        </div>
      </div>

      <div className={s.formSection}>
        <label className={s.label}>Deliverables * <span className={s.labelHint}>select all that apply</span></label>
        <div className={s.pillGrid}>
          {DELIVERABLES_OPTS.map((d) => (
            <Pill key={d} label={d} active={form.deliverables.includes(d)} onClick={() => toggleDeliverable(d)} />
          ))}
        </div>
      </div>

      <div className={s.formSection}>
        <label className={s.label}>Target audience</label>
        <div className={s.pillGrid}>
          {AUDIENCES.map((a) => (
            <Pill key={a} label={a} active={form.audience === a} onClick={() => setPill("audience", a)} />
          ))}
        </div>
      </div>

      <div className={s.formSection}>
        <label className={s.label}>Tone</label>
        <div className={s.pillGrid}>
          {TONES.map((t) => (
            <Pill key={t} label={t} active={form.tone === t} onClick={() => setPill("tone", t)} />
          ))}
        </div>
      </div>

      <div className={s.formSection}>
        <label className={s.label}>Deadline</label>
        <input className={s.fieldDate} type="date" value={form.deadline} onChange={set("deadline")} />
      </div>
    </>
  );
}

/* ── Step 3: Details ── */

function StepDetails({ form, set, setPill }: {
  form: FormState;
  set: (k: TextKey) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  setPill: (k: TextKey, v: string) => void;
}) {
  return (
    <>
      <h2 className={s.panelTitle}>A little more detail</h2>
      <p className={s.panelSub}>Optional, but it shapes how we approach your project.</p>

      <div className={s.formSection}>
        <label className={s.label}>Primary objective</label>
        <div className={s.pillGrid}>
          {OBJECTIVES.map((o) => (
            <Pill key={o} label={o} active={form.objective === o} onClick={() => setPill("objective", o)} />
          ))}
        </div>
      </div>

      <div className={s.formSection}>
        <label className={s.label}>Key messages</label>
        <p className={s.fieldHint}>What must the viewer know, feel, or do? Core narrative points, mandated messaging, tone notes.</p>
        <textarea
          className={s.textarea}
          value={form.key_messages}
          onChange={set("key_messages")}
          placeholder="What's the one thing viewers should walk away knowing?"
          rows={5}
        />
      </div>

      <div className={s.formSection}>
        <label className={s.label}>References</label>
        <input
          className={s.field}
          value={form.references}
          onChange={set("references")}
          placeholder="YouTube link, competitor, or describe the look and feel"
        />
      </div>
    </>
  );
}

/* ── Step 4: Review ── */

function StepReview({ form, onEdit, est }: {
  form: FormState;
  onEdit: (step: number) => void;
  est: { low: number; high: number; weeks: number } | null;
}) {
  const row = (label: string, value: string, long?: boolean) => (
    <div className={s.reviewRow} style={long ? { flexDirection: "column", gap: ".2rem" } : undefined}>
      <span className={s.reviewKey}>{label}</span>
      {long ? (
        <span className={s.reviewValLong}>{value || "—"}</span>
      ) : (
        <span className={value ? s.reviewVal : s.reviewValEmpty}>{value || "Not provided"}</span>
      )}
    </div>
  );

  return (
    <>
      <h2 className={s.panelTitle}>Review your brief</h2>
      <p className={s.panelSub}>Double-check everything. Click &ldquo;Edit&rdquo; to go back to any section.</p>

      {est && (
        <div className={s.estCard}>
          <div className={s.estLeft}>
            <span className={s.estLabel}>Preliminary estimate</span>
            <span className={s.estNote}>Confirmed after scoping call</span>
          </div>
          <div className={s.estRight}>
            <span className={s.estRange}>{fmtMoney(est.low)} – {fmtMoney(est.high)}</span>
            <span className={s.estWeeks}>~{est.weeks}-week delivery</span>
          </div>
        </div>
      )}

      <div className={s.reviewGrid}>
        <div className={s.reviewSection}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className={s.reviewSectionTitle}>Contact</span>
            <button className={s.editBtn} onClick={() => onEdit(0)} type="button">Edit</button>
          </div>
          {row("Name", form.contact_name)}
          {row("Email", form.contact_email)}
          {row("Phone", form.phone)}
          {row("Company", form.company)}
          {row("Role", form.role)}
          {row("Location", form.location)}
        </div>

        <div className={s.reviewSection}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className={s.reviewSectionTitle}>Scope</span>
            <button className={s.editBtn} onClick={() => onEdit(1)} type="button">Edit</button>
          </div>
          {row("Content Type", form.content_type)}
          {row("Deliverables", form.deliverables.join(", "))}
          {row("Audience", form.audience)}
          {row("Tone", form.tone)}
          {row("Deadline", form.deadline || "Flexible")}
        </div>

        <div className={s.reviewSection}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className={s.reviewSectionTitle}>Details</span>
            <button className={s.editBtn} onClick={() => onEdit(2)} type="button">Edit</button>
          </div>
          {row("Objective", form.objective)}
          {row("Key Messages", form.key_messages, true)}
          {row("References", form.references)}
        </div>
      </div>
    </>
  );
}
