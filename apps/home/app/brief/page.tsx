"use client";

import { useState, type FormEvent } from "react";
import { Nav } from "@contentco-op/ui";
import { PublicFooter } from "@/app/components/public-footer";
import s from "./page.module.css";

const VIDEO_TYPES = [
  "Brand film",
  "Recruitment video",
  "Training content",
  "Event coverage",
  "Leadership message",
  "Product / service explainer",
  "Social campaign",
  "Documentary / series",
  "Not sure yet",
];

const DESTINATIONS = [
  "Website",
  "Social media",
  "Sales deck",
  "Email campaign",
  "Event screen",
  "Recruiting page",
  "Training portal",
  "Internal comms",
];

const AUDIENCES = [
  "Prospects",
  "Customers",
  "Internal team",
  "New hires",
  "Leadership",
  "Public",
  "Event attendees",
];

const VIDEO_COUNTS = ["1", "2", "3", "4+"];
const RUNTIMES = ["Under 30s", "30–60s", "1–2 min", "2–5 min", "Not sure"];
const TIMELINES = ["ASAP", "2–4 weeks", "1–2 months", "Flexible"];
const BUDGETS = ["Under $5K", "$5–10K", "$10–20K", "$20K+", "Figuring it out"];

const PRODUCTION_NEEDS = [
  "Interviews",
  "Voiceover",
  "Motion graphics",
  "Drone",
  "B-roll",
  "Script help",
  "Subtitles / captions",
];

function toggleSet(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function CheckCard({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`${s.checkCard} ${checked ? s.checkCardActive : ""}`} onClick={onClick}>
      <span className={s.checkBox}>{checked && <span className={s.checkMark}>✓</span>}</span>
      <span>{label}</span>
    </button>
  );
}

function SegmentBtn({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`${s.segBtn} ${selected ? s.segBtnActive : ""}`} onClick={onClick}>
      {label}
    </button>
  );
}

export default function BriefPage() {
  const [videoTypes, setVideoTypes] = useState<Set<string>>(new Set());
  const [destinations, setDestinations] = useState<Set<string>>(new Set());
  const [audiences, setAudiences] = useState<Set<string>>(new Set());
  const [videoCount, setVideoCount] = useState("");
  const [runtime, setRuntime] = useState("");
  const [timeline, setTimeline] = useState("");
  const [budget, setBudget] = useState("");
  const [prodNeeds, setProdNeeds] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [submitError, setSubmitError] = useState("");

  const contactReady = name.trim() && email.trim();
  const canSubmit = contactReady && submitState !== "submitting";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitState("submitting");
    setSubmitError("");

    try {
      const res = await fetch("/api/briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: "cco.home.creative-brief.v3",
          intake: {
            source_surface: "cco_home",
            source_path: "/brief",
            handoff_version: "cco.home.creative-brief.v3",
            submission_mode: "form",
            booking_intent: "book_after_brief",
          },
          diagnostic: {
            goal: Array.from(videoTypes).join(", ") || "Not sure yet",
            audiences: Array.from(audiences),
            placement: Array.from(destinations).join(", ") || "Website",
            mainVideoCount: videoCount || "1",
            targetRuntime: runtime || "Not sure",
            filmingLocations: "1",
            timeline: timeline || "Flexible",
            polish: "Polished and professional",
            editingStyle: "Edit with graphics",
            budgetComfort: budget || "Figuring it out",
            productionNeeds: Array.from(prodNeeds),
          },
          contact: {
            name: name.trim(),
            company: company.trim(),
            email: email.trim(),
            phone: phone.trim(),
            notes: notes.trim(),
          },
        }),
      });

      if (!res.ok) throw new Error(`${res.status}`);
      setSubmitState("success");
      setTimeout(() => {
        window.location.href = "/book";
      }, 2500);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitState("error");
    }
  }

  if (submitState === "success") {
    return (
      <main className={`page ${s.page}`}>
        <Nav surface="home" />
        <div className={s.successWrap}>
          <div className={s.successIcon}>&#10003;</div>
          <h2 className={s.successTitle}>Brief sent.</h2>
          <p className={s.successSub}>
            We&rsquo;re reviewing your project now. Redirecting you to book a call&hellip;
          </p>
          <a href="/book" className={s.successLink}>
            Book now &rarr;
          </a>
        </div>
        <PublicFooter />
      </main>
    );
  }

  return (
    <main className={`page ${s.page}`}>
      <Nav surface="home" />

      <div className={s.shell}>
        <header className={s.header}>
          <p className={s.kicker}>Production intake</p>
          <h1 className={s.title}>Start your <em>creative brief.</em></h1>
          <p className={s.subtitle}>
            Tell us what you need. We&rsquo;ll sort the rest together after the handoff.
          </p>
        </header>

        <form onSubmit={handleSubmit} className={s.form}>
          <fieldset className={`${s.section} ${s.sectionIntro}`}>
            <legend className={s.sectionTitle}>Start here</legend>

            <div className={s.sectionHead}>
              <div>
                <p className={s.sectionLead}>Who should we contact?</p>
                <p className={s.sectionCopy}>
                  This is the only part you need to complete before sending. Everything below can be
                  filled in now or worked out with us after.
                </p>
              </div>
              <div className={`${s.statusPill} ${contactReady ? s.statusPillReady : ""}`}>
                {contactReady ? "Contact saved" : "Need name + email"}
              </div>
            </div>

            <div className={s.inputRow}>
              <div className={s.inputGroup}>
                <label className={s.label} htmlFor="brief-name">Name</label>
                <input
                  id="brief-name"
                  className={s.input}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
              <div className={s.inputGroup}>
                <label className={s.label} htmlFor="brief-email">Email</label>
                <input
                  id="brief-email"
                  className={s.input}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className={s.inputRow}>
              <div className={s.inputGroup}>
                <label className={s.label} htmlFor="brief-company">Company <span className={s.hint}>(optional)</span></label>
                <input
                  id="brief-company"
                  className={s.input}
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  autoComplete="organization"
                />
              </div>
              <div className={s.inputGroup}>
                <label className={s.label} htmlFor="brief-phone">Phone <span className={s.hint}>(optional)</span></label>
                <input
                  id="brief-phone"
                  className={s.input}
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                />
              </div>
            </div>

            <div className={s.inputGroup}>
              <label className={s.label} htmlFor="brief-notes">Anything else? <span className={s.hint}>(optional)</span></label>
              <textarea
                id="brief-notes"
                className={s.textarea}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="If you already know the deadline, location, or rough idea, put it here."
              />
            </div>
          </fieldset>

          {/* Section 2: What do you need? */}
          <fieldset className={s.section}>
            <legend className={s.sectionTitle}>Project shape <span className={s.hint}>(optional)</span></legend>

            <div className={s.sectionHead}>
              <div>
                <p className={s.sectionLead}>What do you know so far?</p>
                <p className={s.sectionCopy}>
                  Pick whatever is clear already. Skip the rest if you&rsquo;re still sorting the brief.
                </p>
              </div>
            </div>

            <label className={s.label}>Video type <span className={s.hint}>(select all that apply)</span></label>
            <div className={s.cardGrid}>
              {VIDEO_TYPES.map((t) => (
                <CheckCard key={t} label={t} checked={videoTypes.has(t)} onClick={() => setVideoTypes(toggleSet(videoTypes, t))} />
              ))}
            </div>

            <label className={s.label}>Content destination <span className={s.hint}>(select all that apply)</span></label>
            <div className={s.cardGrid}>
              {DESTINATIONS.map((d) => (
                <CheckCard key={d} label={d} checked={destinations.has(d)} onClick={() => setDestinations(toggleSet(destinations, d))} />
              ))}
            </div>

            <label className={s.label}>Audience <span className={s.hint}>(select all that apply)</span></label>
            <div className={s.cardGrid}>
              {AUDIENCES.map((a) => (
                <CheckCard key={a} label={a} checked={audiences.has(a)} onClick={() => setAudiences(toggleSet(audiences, a))} />
              ))}
            </div>
          </fieldset>

          {/* Section 3: Scope */}
          <fieldset className={s.section}>
            <legend className={s.sectionTitle}>Scope <span className={s.hint}>(optional)</span></legend>

            <div className={s.sectionHead}>
              <div>
                <p className={s.sectionLead}>Dial in the details if you have them.</p>
                <p className={s.sectionCopy}>
                  These answers help tighten pricing and timing, but they are not required to get the conversation moving.
                </p>
              </div>
            </div>

            <label className={s.label}>How many videos?</label>
            <div className={s.segGroup}>
              {VIDEO_COUNTS.map((c) => (
                <SegmentBtn key={c} label={c} selected={videoCount === c} onClick={() => setVideoCount(c)} />
              ))}
            </div>

            <label className={s.label}>Target runtime</label>
            <div className={s.segGroup}>
              {RUNTIMES.map((r) => (
                <SegmentBtn key={r} label={r} selected={runtime === r} onClick={() => setRuntime(r)} />
              ))}
            </div>

            <label className={s.label}>Timeline</label>
            <div className={s.segGroup}>
              {TIMELINES.map((t) => (
                <SegmentBtn key={t} label={t} selected={timeline === t} onClick={() => setTimeline(t)} />
              ))}
            </div>

            <label className={s.label}>Budget range</label>
            <div className={s.segGroup}>
              {BUDGETS.map((b) => (
                <SegmentBtn key={b} label={b} selected={budget === b} onClick={() => setBudget(b)} />
              ))}
            </div>

            <label className={s.label}>Production needs <span className={s.hint}>(select all that apply)</span></label>
            <div className={s.cardGrid}>
              {PRODUCTION_NEEDS.map((n) => (
                <CheckCard key={n} label={n} checked={prodNeeds.has(n)} onClick={() => setProdNeeds(toggleSet(prodNeeds, n))} />
              ))}
            </div>
          </fieldset>

          {submitError && (
            <div className={s.errorBar}>{submitError}</div>
          )}

          <button
            type="submit"
            className={s.submitBtn}
            disabled={!canSubmit}
          >
            {submitState === "submitting" ? "Sending..." : "Send Brief & Book a Call"}
          </button>
        </form>
      </div>

      <PublicFooter />
    </main>
  );
}
