"use client";

import { useState } from "react";
import Link from "next/link";
import s from "./page.module.css";

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

interface FormState {
  project_name: string;
  company: string;
  contact_name: string;
  contact_email: string;
  content_type: string;
  audience: string;
  objective: string;
  tone: string;
  deliverables: string;
  deadline: string;
  key_messages: string;
  references: string;
  notes: string;
}

const empty: FormState = {
  project_name: "",
  company: "",
  contact_name: "",
  contact_email: "",
  content_type: CONTENT_TYPES[0],
  audience: AUDIENCES[0],
  objective: OBJECTIVES[0],
  tone: TONES[0],
  deliverables: DELIVERABLES[0],
  deadline: "",
  key_messages: "",
  references: "",
  notes: "",
};

export default function CoCreatePage() {
  const [form, setForm] = useState<FormState>(empty);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const set = (k: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.project_name || !form.contact_email) return;
    setStatus("submitting");
    try {
      const res = await fetch("/api/briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Server error");
      setStatus("success");
    } catch (err) {
      setErrorMsg("Submission failed — please email brief@contentco-op.com directly.");
      setStatus("error");
    }
  };

  return (
    <div className={s.wrap}>
      <div className={s.shell}>

        {/* Nav */}
        <nav className={s.nav}>
          <Link href="https://contentco-op.com" className={s.brand}>
            Content Co-op
          </Link>
          <div className={s.navLinks}>
            <Link href="https://contentco-op.com">Home</Link>
            <Link href="https://contentco-op.com/portfolio">Portfolio</Link>
            <Link href="https://coedit.contentco-op.com">Co-Edit</Link>
            <Link href="https://coscript.contentco-op.com">Co-Script</Link>
            <Link href="https://contentco-op.com/cocreate" className={s.active}>
              Co-Create
            </Link>
          </div>
          <div className={s.navAction}>
            <Link href="/login">Portal Login</Link>
          </div>
        </nav>

        {/* Header */}
        <div className={s.header}>
          <div>
            <p className={s.kicker}>Co-Create</p>
            <h1 className={s.title}>Creative Brief</h1>
            <p className={s.subtitle}>
              Tell us about your project. We'll take it from here.
            </p>
          </div>
        </div>

        {/* Body */}
        {status === "success" ? (
          <div className={s.grid}>
            <div className={s.success}>
              <div className={s.successIcon}>✓</div>
              <h2 className={s.successTitle}>Brief received.</h2>
              <p className={s.successBody}>
                We'll review {form.project_name ? `"${form.project_name}"` : "your brief"} and
                reach out to {form.contact_email} within one business day to discuss next steps.
              </p>
            </div>
          </div>
        ) : (
          <form className={s.grid} onSubmit={handleSubmit}>

            {/* Left — project context */}
            <div>
              <div className={s.panel}>
                <p className={s.panelLabel}>Project</p>
                <div className={s.formGrid}>
                  <div className={`${s.fieldWrap} ${s.formGridFull}`}>
                    <label className={s.label}>Project name *</label>
                    <input
                      className={s.field}
                      value={form.project_name}
                      onChange={set("project_name")}
                      placeholder="e.g. Fowler Ridge — Safety Series"
                      required
                    />
                  </div>
                  <div className={s.fieldWrap}>
                    <label className={s.label}>Company / Client</label>
                    <input
                      className={s.field}
                      value={form.company}
                      onChange={set("company")}
                      placeholder="Acme Energy Co."
                    />
                  </div>
                  <div className={s.fieldWrap}>
                    <label className={s.label}>Deadline</label>
                    <input
                      className={s.field}
                      type="date"
                      value={form.deadline}
                      onChange={set("deadline")}
                    />
                  </div>
                  <div className={s.fieldWrap}>
                    <label className={s.label}>Your name</label>
                    <input
                      className={s.field}
                      value={form.contact_name}
                      onChange={set("contact_name")}
                      placeholder="Jane Smith"
                    />
                  </div>
                  <div className={s.fieldWrap}>
                    <label className={s.label}>Email *</label>
                    <input
                      className={s.field}
                      type="email"
                      value={form.contact_email}
                      onChange={set("contact_email")}
                      placeholder="jane@company.com"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className={s.panel} style={{ marginTop: ".9rem" }}>
                <p className={s.panelLabel}>Scope</p>
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
                    <label className={s.label}>Audience</label>
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
                </div>
              </div>
            </div>

            {/* Right — brief details */}
            <div>
              <div className={s.panel}>
                <p className={s.panelLabel}>Brief</p>
                <div className={s.formGrid}>
                  <div className={`${s.fieldWrap} ${s.formGridFull}`}>
                    <label className={s.label}>Primary objective</label>
                    <select className={s.field} value={form.objective} onChange={set("objective")}>
                      {OBJECTIVES.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className={`${s.fieldWrap} ${s.formGridFull}`}>
                    <label className={s.label}>
                      Key messages
                    </label>
                    <textarea
                      className={s.textarea}
                      value={form.key_messages}
                      onChange={set("key_messages")}
                      placeholder={"— What must the viewer know, feel, or do?\n— Core narrative points\n— Any mandated messaging"}
                      rows={5}
                    />
                  </div>
                  <div className={`${s.fieldWrap} ${s.formGridFull}`}>
                    <label className={s.label}>
                      References / examples
                    </label>
                    <textarea
                      className={s.textarea}
                      value={form.references}
                      onChange={set("references")}
                      placeholder="Links, competitors, internal videos you admire — or describe the look/feel"
                      rows={3}
                    />
                  </div>
                  <div className={`${s.fieldWrap} ${s.formGridFull}`}>
                    <label className={s.label}>
                      Access, constraints & special notes
                    </label>
                    <textarea
                      className={s.textarea}
                      value={form.notes}
                      onChange={set("notes")}
                      placeholder="Site access requirements, safety protocols, existing footage, budget range, approval chain…"
                      rows={3}
                    />
                  </div>
                </div>

                <hr className={s.divider} />

                <div className={s.submitRow}>
                  <p className={s.submitNote}>
                    We'll follow up within one business day.
                    {errorMsg && <><br /><span style={{ color: "#de7676" }}>{errorMsg}</span></>}
                  </p>
                  <button
                    className={s.btnPrimary}
                    type="submit"
                    disabled={status === "submitting"}
                  >
                    {status === "submitting" ? "Sending…" : "Submit Brief"}
                  </button>
                </div>
              </div>
            </div>

          </form>
        )}
      </div>
    </div>
  );
}
