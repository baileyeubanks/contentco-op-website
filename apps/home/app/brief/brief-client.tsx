"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { buildBriefPricingInputs, calculateEstimate, formatCurrency } from "@/lib/pricing";
import s from "./page.module.css";

type SubmitState = "idle" | "saving_lead" | "submitting" | "success" | "error";
type FieldErrors = Partial<Record<keyof BriefDraft, string>>;

const PROJECT_TYPES = [
  { id: "brand", label: "Brand film", desc: "Tell your company narrative with cinematic depth" },
  { id: "product", label: "Product / explainer", desc: "Showcase what you offer with polish" },
  { id: "social", label: "Social content", desc: "Social-first content and general use" },
  { id: "executive", label: "Executive message", desc: "Leadership communications with clarity" },
  { id: "training", label: "Training", desc: "Inform and educate your team" },
  { id: "testimonials", label: "Testimonials", desc: "Build trust with customer stories" },
] as const;

const INDUSTRIES = [
  { id: "energy", label: "Energy / Industrial" },
  { id: "corporate", label: "Corporate / Professional" },
  { id: "healthcare", label: "Healthcare / Medical" },
  { id: "tech", label: "Technology / SaaS" },
  { id: "consumer", label: "Consumer / Retail" },
  { id: "other", label: "Other" },
] as const;

const ENHANCEMENTS = [
  { id: "subtitles", label: "Captions / Subtitles", desc: "Accessibility, compliance, and sound-off viewing" },
  { id: "motiongfx", label: "Motion Graphics", desc: "Animated titles, lower thirds, data viz" },
  { id: "music", label: "Premium Music", desc: "Curated, high-quality tracks" },
  { id: "sound", label: "Sound Design", desc: "Layered audio & SFX" },
  { id: "color", label: "Color Grade", desc: "A more finished, campaign-ready image pass" },
  { id: "multiformat", label: "Platform Versions", desc: "Horizontal, vertical, square, and display-ready exports" },
] as const;

const PLACEMENTS = ["Internal", "Business to Business", "Website", "TV", "Social", "Trade Show", "Billboard", "Theatre", "Stadium", "Other"] as const;
const DELIVERABLES = ["Main Film", "Social Cutdowns", "Interview Selects", "B-roll Stringout", "Shoot-only RAW Footage", "Photo Selects"] as const;
const RUNTIMES = ["Under 30 sec", "30-60 sec", "60-90 sec", "2-3 min", "3-5 min", "Not sure"] as const;
const SHOOT_DAYS = ["0.5", "1", "1.5", "2", "2.5", "3", "3.5", "4+"] as const;
const LOCATION_COUNTS = ["1", "2", "3", "4+"] as const;
const PRODUCTION_NEEDS = ["Interviews", "B-roll Capture", "Voiceover", "Drone", "Multi-camera", "Teleprompter", "Script Help", "Location Sound"] as const;
const TRAVEL_SCOPES = ["Houston / local", "Texas regional", "Domestic", "Extended / custom"] as const;
const STYLE_LEVELS = ["Clean Editorial", "Polished Commercial", "Cinematic Campaign"] as const;
const REVISION_EXPECTATIONS = ["1 round", "2 rounds", "3+ rounds"] as const;
const COMPANY_SCALES = ["Not sure", "Small / local team", "Regional company", "Mid-market company", "Enterprise / public company"] as const;

const GOAL_BY_PROJECT_TYPE: Record<string, string> = {
  brand: "Build trust",
  product: "Explain clearly",
  social: "Support sales",
  executive: "Leadership message",
  training: "Train people",
  testimonials: "Build trust",
};

type BriefDraft = {
  name: string;
  email: string;
  phone: string;
  company: string;
  companyScale: string;
  role: string;
  website: string;
  address: string;
  projectTypes: string[];
  industry: string;
  projectName: string;
  projectContext: string;
  audience: string;
  outcome: string;
  placements: string[];
  deliverables: string[];
  enhancements: string[];
  targetRuntime: string;
  shootDayCount: string;
  filmingLocations: string;
  travelScope: string;
  productionNeeds: string[];
  styleLevel: string;
  revisionExpectation: string;
  timeline: string;
  budgetRange: string;
  successDefinition: string;
  bookingPreference: "20";
};

const DEFAULT_DRAFT: BriefDraft = {
  name: "",
  email: "",
  phone: "",
  company: "",
  companyScale: "Not sure",
  role: "",
  website: "",
  address: "",
  projectTypes: [],
  industry: "",
  projectName: "",
  projectContext: "",
  audience: "",
  outcome: "",
  placements: ["Website"],
  deliverables: ["Main Film"],
  enhancements: [],
  targetRuntime: "60-90 sec",
  shootDayCount: "1",
  filmingLocations: "1",
  travelScope: "Houston / local",
  productionNeeds: ["Interviews", "B-roll Capture", "Location Sound"],
  styleLevel: "Polished Commercial",
  revisionExpectation: "2 rounds",
  timeline: "2-4 weeks",
  budgetRange: "$10,000-$20,000",
  successDefinition: "",
  bookingPreference: "20",
};

function formatMissingList(items: string[]) {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function missingLeadFields(draft: BriefDraft) {
  const missing: string[] = [];
  if (draft.name.trim().length <= 1) missing.push("name");
  if (!isValidEmail(draft.email)) missing.push("email");
  if (normalizePhone(draft.phone).length < 10) missing.push("phone");
  if (draft.company.trim().length <= 1) missing.push("company");
  if (draft.address.trim().length <= 1) missing.push("location");
  return missing;
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function isValidEmail(value: string) {
  return /^\S+@\S+\.\S+$/.test(value.trim());
}

function inferGoal(selection: string[]) {
  const first = selection[0];
  return first ? GOAL_BY_PROJECT_TYPE[first] ?? "Build trust" : "Build trust";
}

function normalizeDraft(raw: Partial<BriefDraft> | null | undefined): Partial<BriefDraft> {
  const source = raw && typeof raw === "object" ? raw : {};
  const mapList = (value: unknown, valid: readonly string[], replacements: Record<string, string> = {}) => {
    const list = Array.isArray(value) ? value : [];
    return Array.from(new Set(list
      .map((item) => replacements[String(item)] || String(item))
      .filter((item) => valid.includes(item))));
  };

  return {
    ...source,
    placements: mapList(source.placements, PLACEMENTS, {
      "Sales deck": "Business to Business",
      Email: "Internal",
      "Event screen": "Trade Show",
      "Training portal": "Internal",
    }),
    deliverables: mapList(source.deliverables, DELIVERABLES, {
      "Main film": "Main Film",
      "Social cutdowns": "Social Cutdowns",
      "Photo pull": "Photo Selects",
      "Review link": "Main Film",
    }),
    enhancements: mapList(source.enhancements, ENHANCEMENTS.map((item) => item.id), {
      photo: "color",
    }),
    productionNeeds: mapList(source.productionNeeds, PRODUCTION_NEEDS, {
      "B-roll only": "B-roll Capture",
      "Script help": "Script Help",
      "Location sound": "Location Sound",
      "Motion graphics": "B-roll Capture",
      Subtitles: "B-roll Capture",
      "Vertical versions": "B-roll Capture",
    }),
    styleLevel: source.styleLevel === "Cinematic and premium"
      ? "Cinematic Campaign"
      : source.styleLevel === "Simple and direct"
        ? "Clean Editorial"
        : source.styleLevel === "Polished and professional"
          ? "Polished Commercial"
          : source.styleLevel,
    companyScale: COMPANY_SCALES.includes(source.companyScale as (typeof COMPANY_SCALES)[number])
      ? source.companyScale
      : "Not sure",
    bookingPreference: "20",
  };
}

function toggleValue(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function formatShootDayLabel(days: string) {
  if (days === "4+") return "4+ days";
  return `${days} day${days === "1" || days === "0.5" ? "" : "s"}`;
}

const STORAGE_KEY = "cco-brief-draft-v1";

export function BriefClientPage() {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof BriefDraft, boolean>>>({});
  const [result, setResult] = useState<{ briefId: string; bookingUrl: string; adminUrl: string } | null>(null);

  const [draft, setDraft] = useState<BriefDraft>(DEFAULT_DRAFT);

  /* ── Auto-save / restore ── */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setDraft((prev) => ({ ...prev, ...normalizeDraft(JSON.parse(saved)) }));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch { /* ignore */ }
  }, [draft]);

  function validateField<K extends keyof BriefDraft>(key: K, value: BriefDraft[K]): string | undefined {
    switch (key) {
      case "name":
        return (value as string).trim().length < 2 ? "Please enter your full name." : undefined;
      case "email":
        return !isValidEmail(value as string) ? "Please enter a valid email address." : undefined;
      case "phone":
        return normalizePhone(value as string).length < 10 ? "Please enter a valid 10-digit phone number." : undefined;
      case "company":
        return (value as string).trim().length < 2 ? "Please enter your company name." : undefined;
      case "address":
        return (value as string).trim().length < 2 ? "Please enter your location." : undefined;
      case "projectTypes":
        return (value as string[]).length === 0 ? "Please select at least one project type." : undefined;
      case "projectContext":
        return (value as string).trim().length < 18 ? "Please add a bit more detail about your project." : undefined;
      case "placements":
        return (value as string[]).length === 0 ? "Please select at least one placement." : undefined;
      case "deliverables":
        return (value as string[]).length === 0 ? "Please select at least one deliverable." : undefined;
      case "targetRuntime":
        return !(value as string).trim() ? "Please select a target runtime." : undefined;
      case "productionNeeds":
        return (value as string[]).length === 0 ? "Please select at least one production need." : undefined;
      case "styleLevel":
        return !(value as string).trim() ? "Please select a post-production finish." : undefined;
      case "revisionExpectation":
        return !(value as string).trim() ? "Please select a revision expectation." : undefined;
      case "timeline":
        return !(value as string).trim() ? "Please select a timeline." : undefined;
      default:
        return undefined;
    }
  }

  const touch = <K extends keyof BriefDraft>(key: K) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
    const error = validateField(key, draft[key]);
    setFieldErrors((prev) => ({ ...prev, [key]: error }));
  };

  const update = <K extends keyof BriefDraft>(key: K, value: BriefDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    if (touched[key]) {
      const error = validateField(key, value);
      setFieldErrors((prev) => ({ ...prev, [key]: error }));
    }
    clearMessage();
  };

  const progress = `${((step + 1) / 4) * 100}%`;
  const isBusy = submitState === "saving_lead" || submitState === "submitting";

  const leadReady = useMemo(() => {
    return (
      draft.name.trim().length > 1 &&
      isValidEmail(draft.email) &&
      normalizePhone(draft.phone).length >= 10 &&
      draft.company.trim().length > 1 &&
      draft.address.trim().length > 1
    );
  }, [draft]);

  const projectReady = draft.projectTypes.length > 0 && draft.projectContext.trim().length > 18;
  const scopeReady =
    draft.placements.length > 0 &&
    draft.deliverables.length > 0 &&
    draft.productionNeeds.length > 0 &&
    draft.targetRuntime.trim().length > 0 &&
    draft.styleLevel.trim().length > 0 &&
    draft.revisionExpectation.trim().length > 0 &&
    draft.timeline.trim().length > 0;

  const quoteDiagnostics = useMemo(() => {
    const missing = [
      !draft.successDefinition.trim() ? "definition of success" : "",
      draft.targetRuntime === "Not sure" ? "target runtime" : "",
      draft.budgetRange === "Figuring it out" ? "budget comfort" : "",
    ].filter(Boolean);
    const shootDays = draft.shootDayCount === "4+" ? 4 : Number(draft.shootDayCount || 1);
    const productionComplexity =
      shootDays >= 3.5 || draft.filmingLocations === "4+" || draft.travelScope === "Extended / custom"
        ? "Complex / custom"
        : shootDays >= 2 || draft.filmingLocations === "3" || draft.travelScope === "Domestic"
          ? "Expanded"
          : shootDays > 1 || draft.filmingLocations === "2" || draft.travelScope === "Texas regional"
            ? "Standard"
            : "Lite";
    const postComplexity =
      draft.styleLevel === "Cinematic Campaign" || draft.revisionExpectation === "3+ rounds" || draft.deliverables.length >= 4
        ? "Expanded"
        : draft.enhancements.includes("motiongfx") || draft.enhancements.includes("multiformat")
          ? "Standard"
          : "Lite";
    const confidence = missing.length === 0
      ? "High quote confidence"
      : missing.length <= 2
        ? "Medium quote confidence"
        : "Follow-up needed";

    return {
      missing,
      productionComplexity,
      postComplexity,
      confidence,
    };
  }, [draft]);

  /* ── Live estimate ── */
  const estimate = useMemo(() => {
    return calculateEstimate(buildBriefPricingInputs(draft));
  }, [draft]);

  const discoveryBookingHref = useMemo(() => {
    const params = new URLSearchParams({ duration: "20" });
    if (draft.name.trim()) params.set("name", draft.name.trim());
    if (draft.email.trim()) params.set("email", draft.email.trim());
    if (draft.company.trim()) params.set("company", draft.company.trim());
    return `/book?${params.toString()}`;
  }, [draft.company, draft.email, draft.name]);

  function clearMessage() {
    if (submitError) setSubmitError("");
    if (submitState === "error") setSubmitState("idle");
  }

  async function saveLeadSnapshot() {
    const response = await fetch("/api/cco/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contact: {
          name: draft.name,
          email: draft.email,
          phone: draft.phone,
          company: draft.company,
          role: draft.role,
          website: draft.website,
          address: draft.address,
        },
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error || "Lead capture failed");
    return payload;
  }

  async function scheduleProgressReminder() {
    if (!isValidEmail(draft.email)) return;
    try {
      await fetch("/api/cco/briefs/email-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "schedule", email: draft.email, draft }),
      });
    } catch {
      // Local draft autosave still works if the remote reminder queue is unavailable.
    }
  }

  async function cancelProgressReminder(email: string) {
    if (!isValidEmail(email)) return;
    try {
      await fetch("/api/cco/briefs/email-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", email }),
      });
    } catch {
      // Non-blocking; a submitted brief also queues the normal received email.
    }
  }

  async function moveTo(next: 0 | 1 | 2 | 3) {
    clearMessage();
    try {
      if (step === 0 && next > 0) {
        if (!leadReady) {
          const missing = missingLeadFields(draft);
          setSubmitState("error");
          setSubmitError(
            missing.length
              ? `Add ${formatMissingList(missing)}.`
              : "Add name, email, phone, company, and location.",
          );
          return;
        }
        setSubmitState("saving_lead");
        await saveLeadSnapshot();
        await scheduleProgressReminder();
        setSubmitState("idle");
      }
      if (step === 1 && next > 1 && !projectReady) {
        setSubmitState("error");
        setSubmitError("Choose a project type and add a short summary.");
        return;
      }
      if (step === 2 && next > 2 && !scopeReady) {
        setSubmitState("error");
        setSubmitError("Choose a placement, deliverable, and timeline.");
        return;
      }
      setStep(next);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setSubmitState("error");
      setSubmitError(error instanceof Error ? error.message : "Lead capture failed");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!leadReady || !projectReady || !scopeReady) {
      setSubmitState("error");
      setSubmitError("Finish the required fields.");
      return;
    }

    setSubmitState("submitting");
    setSubmitError("");

    try {
      await saveLeadSnapshot();
      const response = await fetch("/api/cco/briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourcePath: "/brief",
          contact: {
            name: draft.name,
            email: draft.email,
            phone: draft.phone,
            company: draft.company,
            role: draft.role,
            website: draft.website,
            address: draft.address,
          },
          project: {
            projectTypes: draft.projectTypes,
            projectName: draft.projectName || draft.projectTypes.join(", "),
            goal: inferGoal(draft.projectTypes),
            audience: draft.audience,
            placements: draft.placements,
            deliverables: draft.deliverables,
            timeline: draft.timeline,
            budgetRange: draft.budgetRange,
            projectContext: draft.projectContext,
            successDefinition: draft.successDefinition,
            industry: draft.industry,
            outcome: draft.outcome,
            enhancements: draft.enhancements,
            targetRuntime: draft.targetRuntime,
            shootDayCount: draft.shootDayCount,
            filmingLocations: draft.filmingLocations,
            travelScope: draft.travelScope,
            productionNeeds: draft.productionNeeds,
            styleLevel: draft.styleLevel,
            revisionExpectation: draft.revisionExpectation,
            companyScale: draft.companyScale,
            quoteConfidence: quoteDiagnostics.confidence,
            quoteMissingInputs: quoteDiagnostics.missing,
            productionComplexity: quoteDiagnostics.productionComplexity,
            postComplexity: quoteDiagnostics.postComplexity,
          },
          bookingPreference: draft.bookingPreference,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Brief submission failed");
      await cancelProgressReminder(draft.email);

      const briefId = String(payload.id);

      // Generate AI proposal
      setSubmitState("submitting");
      const proposalRes = await fetch("/api/cco/briefs/proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          briefId,
          contact: {
            name: draft.name,
            email: draft.email,
            company: draft.company,
            role: draft.role,
          },
          project: {
            projectTypes: draft.projectTypes,
            projectName: draft.projectName || draft.projectTypes.join(", "),
            industry: draft.industry,
            audience: draft.audience,
            projectContext: draft.projectContext,
            outcome: draft.outcome,
            placements: draft.placements,
            deliverables: draft.deliverables,
            enhancements: draft.enhancements,
            targetRuntime: draft.targetRuntime,
            shootDayCount: draft.shootDayCount,
            filmingLocations: draft.filmingLocations,
            travelScope: draft.travelScope,
            productionNeeds: draft.productionNeeds,
            styleLevel: draft.styleLevel,
            revisionExpectation: draft.revisionExpectation,
            companyScale: draft.companyScale,
            quoteConfidence: quoteDiagnostics.confidence,
            quoteMissingInputs: quoteDiagnostics.missing,
            productionComplexity: quoteDiagnostics.productionComplexity,
            postComplexity: quoteDiagnostics.postComplexity,
            timeline: draft.timeline,
            budgetRange: draft.budgetRange,
            successDefinition: draft.successDefinition,
          },
        }),
      });

      const proposalPayload = await proposalRes.json().catch(() => null);
      if (!proposalRes.ok || !proposalPayload?.proposal) {
        // Fallback: show success without proposal redirect
        setResult({
          briefId,
          bookingUrl: String(payload.booking_url || "/book"),
          adminUrl: String(payload.admin_url || "/admin"),
        });
        setSubmitState("success");
        localStorage.removeItem(STORAGE_KEY);
        return;
      }

      // Redirect to proposal page
      const proposalEncoded = encodeURIComponent(JSON.stringify(proposalPayload.proposal));
      window.location.href = `/brief/proposal/${briefId}?proposal=${proposalEncoded}&name=${encodeURIComponent(draft.name)}&company=${encodeURIComponent(draft.company)}`;
    } catch (error) {
      setSubmitState("error");
      setSubmitError(error instanceof Error ? error.message : "Brief submission failed");
    }
  }

  /* ─── Status dots ─── */
  const StatusDots = () => (
    <span className={s.statusDots}>
      <span className={s.dot} />
      <span className={s.dot} />
      <span className={s.dot} />
    </span>
  );

  if (submitState === "success" && result) {
    return (
      <main className={s.page}>
        <section className={s.surface}>
          <div className={s.successIcon}>✓</div>
          <p className={s.kicker}>Brief submitted</p>
          <h1 className={s.title}>
            Brief <em>received.</em>
          </h1>
          <p className={s.subtitle}>
            We have what we need to review it. Expect a response within 24 hours.
          </p>
          <div className={s.successGrid}>
            <div>
              <span>Brief ID</span>
              <strong>{result.briefId}</strong>
            </div>
            <div>
              <span>Next step</span>
              <strong>Discovery call</strong>
            </div>
            <div>
              <span>Response time</span>
              <strong>Within 24 hours</strong>
            </div>
            <div>
              <span>Deposit</span>
              <strong>50% to lock scope</strong>
            </div>
          </div>
          <div className={s.actions}>
            <Link className={s.submitBtn} href={`/brief/proposal/${result.briefId}`}>
              View your proposal
            </Link>
            <Link className={s.ghost} href={result.bookingUrl}>
              Book a 20 min discovery call
            </Link>
          </div>
          <div className={s.nav} style={{ justifyContent: "center" }}>
            <Link className={s.ghost} href="/">
              Back to home
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={s.page}>
      <section className={s.surface} aria-live="polite">
        <p className={s.kicker}>Creative Brief Intake</p>
        <h1 className={s.title}>
          Tell us your <em>Story.</em>
        </h1>
        <p className={s.subtitle}>
          Contact fields are required so we can follow up. Project details can stay thin — if you
          don&rsquo;t know an answer later, leave it blank.
        </p>

        {/* Gradient progress bar */}
        <div className={s.progressWrap}>
          <div className={s.progressFill} style={{ width: progress }} />
        </div>

        <form className={s.form} onSubmit={handleSubmit} noValidate>
          {step === 0 ? (
            <section className={s.step}>
              <p className={s.stepTitle}>Step 1 of 4</p>
              <h2 className={s.sectionTitle}>Contact</h2>
              <div className={s.row}>
                <label className={s.field} htmlFor="brief-name">
                  <span>Name</span>
                  <input
                    id="brief-name"
                    name="name"
                    value={draft.name}
                    onChange={(e) => update("name", e.target.value)}
                    onBlur={() => touch("name")}
                    autoComplete="name"
                    placeholder="Jane Smith"
                    required
                    aria-required="true"
                    aria-invalid={!!fieldErrors.name}
                  />
                  {touched.name && fieldErrors.name ? <span className={s.fieldError}>{fieldErrors.name}</span> : null}
                </label>
                <label className={s.field} htmlFor="brief-email">
                  <span>Email</span>
                  <input
                    id="brief-email"
                    name="email"
                    value={draft.email}
                    onChange={(e) => update("email", e.target.value)}
                    onBlur={() => touch("email")}
                    autoComplete="email"
                    type="email"
                    placeholder="jane@company.com"
                    required
                    aria-required="true"
                    aria-invalid={!!fieldErrors.email}
                  />
                  {touched.email && fieldErrors.email ? <span className={s.fieldError}>{fieldErrors.email}</span> : null}
                </label>
              </div>
              <div className={s.row}>
                <label className={s.field} htmlFor="brief-phone">
                  <span>Phone</span>
                  <input
                    id="brief-phone"
                    name="phone"
                    value={draft.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    onBlur={() => touch("phone")}
                    autoComplete="tel"
                    type="tel"
                    placeholder="(713) 555-0199"
                    required
                    aria-required="true"
                    aria-invalid={!!fieldErrors.phone}
                  />
                  {touched.phone && fieldErrors.phone ? <span className={s.fieldError}>{fieldErrors.phone}</span> : null}
                </label>
                <label className={s.field} htmlFor="brief-company">
                  <span>Company</span>
                  <input
                    id="brief-company"
                    name="company"
                    value={draft.company}
                    onChange={(e) => update("company", e.target.value)}
                    onBlur={() => touch("company")}
                    autoComplete="organization"
                    placeholder="Acme, Inc."
                    required
                    aria-required="true"
                    aria-invalid={!!fieldErrors.company}
                  />
                  {touched.company && fieldErrors.company ? <span className={s.fieldError}>{fieldErrors.company}</span> : null}
                </label>
              </div>
              <div className={s.row}>
                <label className={s.field} htmlFor="brief-address">
                  <span>Address / location</span>
                  <input
                    id="brief-address"
                    name="address"
                    value={draft.address}
                    onChange={(e) => update("address", e.target.value)}
                    onBlur={() => touch("address")}
                    autoComplete="street-address"
                    placeholder="Houston, TX"
                    required
                    aria-required="true"
                    aria-invalid={!!fieldErrors.address}
                  />
                  {touched.address && fieldErrors.address ? <span className={s.fieldError}>{fieldErrors.address}</span> : null}
                </label>
                <label className={s.field} htmlFor="brief-role">
                  <span>Role</span>
                  <input
                    id="brief-role"
                    name="role"
                    value={draft.role}
                    onChange={(e) => update("role", e.target.value)}
                    placeholder="Marketing Director, Founder, Ops lead"
                  />
                </label>
              </div>
              <div className={s.row}>
                <label className={s.field} htmlFor="brief-website">
                  <span>Website</span>
                  <input
                    id="brief-website"
                    name="website"
                    value={draft.website}
                    onChange={(e) => update("website", e.target.value)}
                    inputMode="url"
                    placeholder="https://company.com"
                  />
                </label>
                <label className={s.field} htmlFor="brief-company-scale">
                  <span>Company scale</span>
                  <select
                    id="brief-company-scale"
                    name="companyScale"
                    value={draft.companyScale}
                    onChange={(e) => update("companyScale", e.target.value)}
                  >
                    {COMPANY_SCALES.map((scale) => <option key={scale}>{scale}</option>)}
                  </select>
                </label>
              </div>
              <div className={s.nav}>
                <button
                  className={s.submitBtn}
                  type="button"
                  onClick={() => void moveTo(1)}
                  /* Gate on isBusy only. Disabling on !leadReady made moveTo's own
                     guard structurally unreachable (no click → no error). Contact
                     fields are required and marked; the guard lists only what's
                     still missing. Let the click through and let the alert speak. */
                  disabled={isBusy}
                >
                  {submitState === "saving_lead" ? (
                    <>
                      Saving lead <StatusDots />
                    </>
                  ) : (
                    "Save and continue"
                  )}
                </button>
              </div>
            </section>
          ) : null}

          {step === 1 ? (
            <section className={s.step}>
              <p className={s.stepTitle}>Step 2 of 4</p>
              <h2 className={s.sectionTitle}>Project</h2>

              {/* Industry selector */}
              <div className={s.optionGroup}>
                <span>Industry</span>
                <div className={s.grid}>
                  {INDUSTRIES.map((ind) => (
                    <button
                      className={`${s.chip} ${draft.industry === ind.id ? s.chipActive : ""}`}
                      key={ind.id}
                      type="button"
                      onClick={() => update("industry", draft.industry === ind.id ? "" : ind.id)}
                    >
                      {ind.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Project type cards */}
              <div className={s.optionGroup}>
                <span>Project type</span>
                <div className={s.cardGrid}>
                  {PROJECT_TYPES.map((type) => (
                    <button
                      className={`${s.card} ${draft.projectTypes.includes(type.id) ? s.cardActive : ""}`}
                      key={type.id}
                      type="button"
                      onClick={() => update("projectTypes", toggleValue(draft.projectTypes, type.id))}
                      aria-pressed={draft.projectTypes.includes(type.id)}
                    >
                      <strong>{type.label}</strong>
                      <span>{type.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <label className={s.field}>
                <span>Project name</span>
                <input
                  value={draft.projectName}
                  onChange={(e) => update("projectName", e.target.value)}
                  placeholder="Industrial launch story, founder message, recruiting series"
                />
              </label>
              <label className={s.field}>
                <span>Project context</span>
                <textarea
                  value={draft.projectContext}
                  onChange={(e) => update("projectContext", e.target.value)}
                  onBlur={() => touch("projectContext")}
                  placeholder="What are we making, who is it for, and what should it accomplish?"
                  aria-invalid={!!fieldErrors.projectContext}
                />
                {touched.projectContext && fieldErrors.projectContext ? <span className={s.fieldError}>{fieldErrors.projectContext}</span> : null}
              </label>
              <div className={s.nav}>
                <button className={s.ghost} type="button" onClick={() => moveTo(0)}>
                  Back
                </button>
                <button
                  className={s.submitBtn}
                  type="button"
                  onClick={() => void moveTo(2)}
                  /* Gate on isBusy only — same unreachable-guard defect as step 1:
                     hard-disabling on !projectReady kept moveTo's "Choose a project
                     type and add a short summary." from ever firing and dropped the
                     button from the tab order. Let the guard speak. */
                  disabled={isBusy}
                >
                  Continue
                </button>
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className={s.step}>
              <p className={s.stepTitle}>Step 3 of 4</p>
              <h2 className={s.sectionTitle}>Scope</h2>

              <div className={s.optionGroup}>
                <span>Placements</span>
                <div className={s.grid}>
                  {PLACEMENTS.map((placement) => (
                    <button
                      className={`${s.chip} ${draft.placements.includes(placement) ? s.chipActive : ""}`}
                      type="button"
                      key={placement}
                      onClick={() => update("placements", toggleValue(draft.placements, placement))}
                    >
                      {placement}
                    </button>
                  ))}
                </div>
              </div>

              <div className={s.row}>
                <label className={s.field}>
                  <span>Target runtime</span>
                  <select value={draft.targetRuntime} onChange={(e) => update("targetRuntime", e.target.value)}>
                    {RUNTIMES.map((runtime) => <option key={runtime}>{runtime}</option>)}
                  </select>
                </label>
                <label className={s.field}>
                  <span>Post-production finish</span>
                  <select value={draft.styleLevel} onChange={(e) => update("styleLevel", e.target.value)}>
                    {STYLE_LEVELS.map((style) => <option key={style}>{style}</option>)}
                  </select>
                </label>
              </div>

              <div className={s.row}>
                <label className={s.field}>
                  <span>Shoot days</span>
                  <select value={draft.shootDayCount} onChange={(e) => update("shootDayCount", e.target.value)}>
                    {SHOOT_DAYS.map((days) => (
                      <option key={days} value={days}>{formatShootDayLabel(days)}</option>
                    ))}
                  </select>
                </label>
                <label className={s.field}>
                  <span>Filming locations</span>
                  <select value={draft.filmingLocations} onChange={(e) => update("filmingLocations", e.target.value)}>
                    {LOCATION_COUNTS.map((count) => <option key={count}>{count}</option>)}
                  </select>
                </label>
              </div>

              <div className={s.row}>
                <label className={s.field}>
                  <span>Travel scope</span>
                  <select value={draft.travelScope} onChange={(e) => update("travelScope", e.target.value)}>
                    {TRAVEL_SCOPES.map((scope) => <option key={scope}>{scope}</option>)}
                  </select>
                </label>
                <label className={s.field}>
                  <span>Revision expectation</span>
                  <select value={draft.revisionExpectation} onChange={(e) => update("revisionExpectation", e.target.value)}>
                    {REVISION_EXPECTATIONS.map((revision) => <option key={revision}>{revision}</option>)}
                  </select>
                </label>
              </div>

              <div className={s.optionGroup}>
                <span>Production needs</span>
                <div className={s.grid}>
                  {PRODUCTION_NEEDS.map((need) => (
                    <button
                      className={`${s.chip} ${draft.productionNeeds.includes(need) ? s.chipActive : ""}`}
                      type="button"
                      key={need}
                      onClick={() => update("productionNeeds", toggleValue(draft.productionNeeds, need))}
                    >
                      {need}
                    </button>
                  ))}
                </div>
              </div>

              <div className={s.optionGroup}>
                <span>Post & delivery add-ons</span>
                <div className={s.cardGrid}>
                  {ENHANCEMENTS.map((enh) => (
                    <button
                      className={`${s.card} ${draft.enhancements.includes(enh.id) ? s.cardActive : ""}`}
                      type="button"
                      key={enh.id}
                      onClick={() => update("enhancements", toggleValue(draft.enhancements, enh.id))}
                    >
                      <strong>{enh.label}</strong>
                      <span>{enh.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className={s.optionGroup}>
                <span>Deliverables</span>
                <div className={s.grid}>
                  {DELIVERABLES.map((deliverable) => (
                    <button
                      className={`${s.chip} ${draft.deliverables.includes(deliverable) ? s.chipActive : ""}`}
                      type="button"
                      key={deliverable}
                      onClick={() => update("deliverables", toggleValue(draft.deliverables, deliverable))}
                    >
                      {deliverable}
                    </button>
                  ))}
                </div>
              </div>

              <div className={s.row}>
                <label className={s.field}>
                  <span>Timeline</span>
                  <select value={draft.timeline} onChange={(e) => update("timeline", e.target.value)}>
                    <option>ASAP</option>
                    <option>2-4 weeks</option>
                    <option>1-2 months</option>
                    <option>Flexible</option>
                  </select>
                </label>
                <label className={s.field}>
                  <span>Budget comfort</span>
                  <select value={draft.budgetRange} onChange={(e) => update("budgetRange", e.target.value)}>
                    <option>Figuring it out</option>
                    <option>Under $5,000</option>
                    <option>$5,000-$10,000</option>
                    <option>$10,000-$20,000</option>
                    <option>$20,000+ / best approach</option>
                  </select>
                </label>
              </div>

              <label className={s.field}>
                <span>Definition of success</span>
                <textarea
                  value={draft.successDefinition}
                  onChange={(e) => update("successDefinition", e.target.value)}
                  placeholder="How will we know this worked?"
                />
              </label>

              <div className={s.nav}>
                <button className={s.ghost} type="button" onClick={() => moveTo(1)}>
                  Back
                </button>
                <button
                  className={s.submitBtn}
                  type="button"
                  onClick={() => void moveTo(3)}
                  /* Gate on isBusy only — same unreachable-guard defect as step 1:
                     hard-disabling on !scopeReady kept moveTo's "Choose a placement,
                     deliverable, and timeline." from ever firing and dropped the
                     button from the tab order. Let the guard speak. */
                  disabled={isBusy}
                >
                  Review
                </button>
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section className={s.step}>
              <p className={s.stepTitle}>Step 4 of 4</p>
              <h2 className={s.sectionTitle}>Review</h2>

              <div className={s.reviewGrid}>
                <div>
                  <span>Lead</span>
                  <strong>{draft.name}</strong>
                  <p>
                    {draft.company} · {draft.email}
                  </p>
                </div>
                <div>
                  <span>Project</span>
                  <strong>{draft.projectName || draft.projectTypes.join(", ")}</strong>
                  <p>{inferGoal(draft.projectTypes)}</p>
                </div>
                <div>
                  <span>Scope</span>
                  <strong>{draft.deliverables.length} deliverable lanes</strong>
                  <p>{draft.placements.join(", ")}</p>
                </div>
                <div>
                  <span>Call</span>
                  <strong>20 min discovery</strong>
                  <p>{draft.timeline}</p>
                </div>
                <div>
                  <span>Production</span>
                  <strong>{quoteDiagnostics.productionComplexity}</strong>
                  <p>{formatShootDayLabel(draft.shootDayCount)} · {draft.filmingLocations} location(s)</p>
                </div>
                <div>
                  <span>Post</span>
                  <strong>{quoteDiagnostics.postComplexity}</strong>
                  <p>{draft.targetRuntime} · {draft.revisionExpectation}</p>
                </div>
              </div>

              {/* Live estimate preview */}
              <div className={s.estimatePreview}>
                <span>{quoteDiagnostics.confidence}</span>
                <strong>
                  {formatCurrency(estimate.low)} – {formatCurrency(estimate.high)}
                </strong>
                <p>
                  {quoteDiagnostics.missing.length > 0
                    ? `Missing for a tighter quote: ${quoteDiagnostics.missing.join(", ")}.`
                    : "Enough scope detail for an initial quote range. Final scheduling is still subject to internal review."}
                </p>
              </div>

              <div className={s.nav}>
                <button className={s.ghost} type="button" onClick={() => moveTo(2)}>
                  Back
                </button>
                <button className={s.submitBtn} type="submit" disabled={isBusy}>
                  {submitState === "submitting" ? (
                    <>
                      Submitting <StatusDots />
                    </>
                  ) : (
                    "Get Your Estimate"
                  )}
                </button>
              </div>
            </section>
          ) : null}
        </form>

        {submitError ? <div className={s.error} role="alert">{submitError}</div> : null}
        {step === 3 ? (
          <div className={s.bookFallback}>
            <span>Rather talk it through?</span>
            <Link className={s.bookFallbackButton} href={discoveryBookingHref}>
              Book a 20 min discovery call
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
