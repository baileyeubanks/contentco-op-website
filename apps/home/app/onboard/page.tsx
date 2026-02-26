"use client";

import { useState } from "react";
import Link from "next/link";
import s from "./page.module.css";

/* ── Option lists (reused from cocreate) ── */
const CONTENT_TYPES = [
  "Executive Thought Piece",
  "Safety & Compliance Update",
  "Operational Change Communication",
  "Culture & Values Story",
  "Training & Onboarding",
  "Brand / Capabilities Reel",
  "Mini-Series",
  "Other",
];

const AUDIENCES = [
  "Field Operators",
  "Plant Leadership",
  "Corporate / C-Suite",
  "External / Public",
  "Mixed — Multiple audiences",
];

const OBJECTIVES = [
  "Drive behavior change",
  "Inform & align",
  "Build trust / credibility",
  "Train / onboard",
  "Showcase capability",
  "Reassure stakeholders",
];

const TONES = [
  "Cinematic — high production, emotive",
  "Clean & corporate — direct, polished",
  "Documentary — authentic, on-the-ground",
  "Training — clear, structured, instructional",
  "Mixed — varies by segment",
];

const DELIVERABLES = [
  "Single video (final cut only)",
  "Single video + raw files",
  "2–3 short-form cuts",
  "Full series (3+ episodes)",
  "Script only — no production",
];

const STEPS = ["Contact", "Scope", "Creative", "Review"];

/* ── Form state ── */
interface FormState {
  contact_name: string;
  contact_email: string;
  company: string;
  role: string;
  content_type: string;
  deliverables: string;
  audience: string;
  tone: string;
  deadline: string;
  objective: string;
  key_messages: string;
  references: string;
  constraints: string;
}

const empty: FormState = {
  contact_name: "",
  contact_email: "",
  company: "",
  role: "",
  content_type: CONTENT_TYPES[0],
  deliverables: DELIVERABLES[0],
  audience: AUDIENCES[0],
  tone: TONES[0],
  deadline: "",
  objective: OBJECTIVES[0],
  key_messages: "",
  references: "",
  constraints: "",
};

export default function OnboardPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(empty);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [portalUrl, setPortalUrl] = useState("");

  const set = (k: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const canAdvance = () => {
    if (step === 0) return form.contact_name.trim() !== "" && form.contact_email.trim() !== "";
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
        body: JSON.stringify(form),
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

  return (
    <div className={s.wrap}>
      <div className={s.shell}>
        <Link href="/" className={s.backLink}>&larr; Back to Home</Link>

        <div className={s.header}>
          <p className={s.kicker}>Onboarding</p>
          <h1 className={s.title}>Start Your Project</h1>
          <p className={s.subtitle}>
            Four quick steps. We&apos;ll handle the rest.
          </p>
        </div>

        {status === "success" ? (
          <div className={s.success}>
            <div className={s.successIcon}>&#10003;</div>
            <h2 className={s.successTitle}>Brief received.</h2>
            <p className={s.successBody}>
              We&apos;ll review your brief and reach out to {form.contact_email} within one
              business day. You can track your project status, upload files, and message
              our team from your portal.
            </p>
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
              {step === 1 && <StepScope form={form} set={set} />}
              {step === 2 && <StepCreative form={form} set={set} />}
              {step === 3 && <StepReview form={form} onEdit={setStep} />}

              {/* Nav buttons */}
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

/* ── Step 1: Contact ── */
function StepContact({ form, set }: { form: FormState; set: (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void }) {
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
          <label className={s.label}>Company</label>
          <input className={s.field} value={form.company} onChange={set("company")} placeholder="Acme Energy Co." />
        </div>
        <div className={s.fieldWrap}>
          <label className={s.label}>Your role</label>
          <input className={s.field} value={form.role} onChange={set("role")} placeholder="Director of Communications" />
        </div>
      </div>
    </>
  );
}

/* ── Step 2: Scope ── */
function StepScope({ form, set }: { form: FormState; set: (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void }) {
  return (
    <>
      <h2 className={s.panelTitle}>What do you need?</h2>
      <p className={s.panelSub}>Scope the project so we can match the right crew and timeline.</p>
      <div className={s.formGrid}>
        <div className={s.fieldWrap}>
          <label className={s.label}>Content type</label>
          <select className={s.field} value={form.content_type} onChange={set("content_type")}>
            {CONTENT_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className={s.fieldWrap}>
          <label className={s.label}>Deliverables</label>
          <select className={s.field} value={form.deliverables} onChange={set("deliverables")}>
            {DELIVERABLES.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div className={s.fieldWrap}>
          <label className={s.label}>Target audience</label>
          <select className={s.field} value={form.audience} onChange={set("audience")}>
            {AUDIENCES.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>
        <div className={s.fieldWrap}>
          <label className={s.label}>Tone</label>
          <select className={s.field} value={form.tone} onChange={set("tone")}>
            {TONES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className={`${s.fieldWrap} ${s.formGridFull}`}>
          <label className={s.label}>Deadline</label>
          <input className={s.field} type="date" value={form.deadline} onChange={set("deadline")} />
        </div>
      </div>
    </>
  );
}

/* ── Step 3: Creative ── */
function StepCreative({ form, set }: { form: FormState; set: (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void }) {
  return (
    <>
      <h2 className={s.panelTitle}>Tell us more</h2>
      <p className={s.panelSub}>The details that shape the story.</p>
      <div className={s.formGrid}>
        <div className={`${s.fieldWrap} ${s.formGridFull}`}>
          <label className={s.label}>Primary objective</label>
          <select className={s.field} value={form.objective} onChange={set("objective")}>
            {OBJECTIVES.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div className={`${s.fieldWrap} ${s.formGridFull}`}>
          <label className={s.label}>Key messages</label>
          <textarea
            className={s.textarea}
            value={form.key_messages}
            onChange={set("key_messages")}
            placeholder={"What must the viewer know, feel, or do?\nCore narrative points\nAny mandated messaging"}
            rows={4}
          />
        </div>
        <div className={`${s.fieldWrap} ${s.formGridFull}`}>
          <label className={s.label}>References / examples</label>
          <textarea
            className={s.textarea}
            value={form.references}
            onChange={set("references")}
            placeholder="Links, competitors, internal videos you admire — or describe the look/feel"
            rows={3}
          />
        </div>
        <div className={`${s.fieldWrap} ${s.formGridFull}`}>
          <label className={s.label}>Access, constraints & notes</label>
          <textarea
            className={s.textarea}
            value={form.constraints}
            onChange={set("constraints")}
            placeholder="Site access, safety protocols, existing footage, budget range, approval chain..."
            rows={3}
          />
        </div>
      </div>
    </>
  );
}

/* ── Step 4: Review ── */
function StepReview({ form, onEdit }: { form: FormState; onEdit: (step: number) => void }) {
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
      <p className={s.panelSub}>Double-check everything. You can click &ldquo;Edit&rdquo; to go back to any section.</p>
      <div className={s.reviewGrid}>
        {/* Contact */}
        <div className={s.reviewSection}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className={s.reviewSectionTitle}>Contact</span>
            <button className={s.editBtn} onClick={() => onEdit(0)} type="button">Edit</button>
          </div>
          {row("Name", form.contact_name)}
          {row("Email", form.contact_email)}
          {row("Company", form.company)}
          {row("Role", form.role)}
        </div>

        {/* Scope */}
        <div className={s.reviewSection}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className={s.reviewSectionTitle}>Scope</span>
            <button className={s.editBtn} onClick={() => onEdit(1)} type="button">Edit</button>
          </div>
          {row("Content Type", form.content_type)}
          {row("Deliverables", form.deliverables)}
          {row("Audience", form.audience)}
          {row("Tone", form.tone)}
          {row("Deadline", form.deadline || "Flexible")}
        </div>

        {/* Creative */}
        <div className={s.reviewSection}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className={s.reviewSectionTitle}>Creative</span>
            <button className={s.editBtn} onClick={() => onEdit(2)} type="button">Edit</button>
          </div>
          {row("Objective", form.objective)}
          {row("Key Messages", form.key_messages, true)}
          {row("References", form.references, true)}
          {row("Constraints", form.constraints, true)}
        </div>
      </div>
    </>
  );
}
