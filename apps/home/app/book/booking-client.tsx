"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import s from "./page.module.css";

type Duration = "15" | "20" | "30";
type SubmitState = "idle" | "loading" | "submitting" | "success" | "error";

type Slot = {
  id: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: 15 | 20 | 30;
  label: string;
  available: boolean;
  source: "google_freebusy_ready" | "local_preview";
};

type AvailabilityResponse = {
  calendar: {
    configured: boolean;
    mode: string;
  };
  slots: Slot[];
};

function isValidEmail(value: string) {
  return /^\S+@\S+\.\S+$/.test(value.trim());
}

function compactDateRange(slot: Slot | null) {
  if (!slot) return "No slot selected";
  const start = new Date(slot.startsAt);
  const end = new Date(slot.endsAt);
  const date = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Chicago",
  }).format(start);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  }).format(start);
  const endTime = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  }).format(end);
  return `${date}, ${time}-${endTime} CT`;
}

export function BookingClient() {
  const params = useSearchParams();
  const requestedDuration = params.get("duration");
  const duration: Duration = requestedDuration === "15" || requestedDuration === "30" ? requestedDuration : "20";
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("loading");
  const [message, setMessage] = useState("");

  const [name, setName] = useState(params.get("name") || "");
  const [email, setEmail] = useState(params.get("email") || "");
  const [company, setCompany] = useState(params.get("company") || "");
  const [notes, setNotes] = useState("");

  const briefId = params.get("brief") || "";
  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.id === selectedSlotId) || null,
    [selectedSlotId, slots],
  );
  const ready = name.trim().length > 1 && isValidEmail(email) && selectedSlot;

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/cco/bookings/availability?duration=${duration}`)
      .then(async (response) => {
        const payload = (await response.json()) as AvailabilityResponse;
        if (!response.ok) throw new Error("Availability could not be loaded.");
        return payload;
      })
      .then((payload) => {
        if (cancelled) return;
        setSlots(payload.slots);
        setSelectedSlotId(payload.slots[0]?.id || "");
        setSubmitState("idle");
        setMessage("");
      })
      .catch((error) => {
        if (cancelled) return;
        setSubmitState("error");
        setMessage(error instanceof Error ? error.message : "Availability could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [duration]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || !selectedSlot) {
      setSubmitState("error");
      setMessage("Choose a time and provide a valid name and email.");
      return;
    }

    setSubmitState("submitting");
    setMessage("");
    const response = await fetch("/api/cco/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        briefId,
        name,
        email,
        company,
        notes,
        durationMinutes: Number(duration),
        slotId: selectedSlot.id,
        startsAt: selectedSlot.startsAt,
        endsAt: selectedSlot.endsAt,
      }),
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setSubmitState("error");
      setMessage(payload?.error || "Booking could not be created.");
      return;
    }

    setSubmitState("success");
    setMessage(`Discovery call reserved: ${compactDateRange(selectedSlot)}.`);
  }

  return (
    <section className={s.bookingPanel}>
      <div className={s.bookingHeader}>
        <div>
          <p className={s.kicker}>Discovery Call</p>
          <h2>Choose a time</h2>
        </div>
        <span className={s.durationBadge}>20 min discovery</span>
      </div>

      <div className={s.bookingGrid}>
        <div className={s.slotColumn}>
          <div className={s.sectionHeading}>
            <span>Available times</span>
            <strong>{duration} minutes</strong>
          </div>
          <div className={s.slots}>
            {submitState === "loading" ? <p className={s.empty}>Loading availability...</p> : null}
            {slots.map((slot) => (
              <button
                key={slot.id}
                className={`${s.slot} ${selectedSlotId === slot.id ? s.slotActive : ""}`}
                type="button"
                onClick={() => {
                  setSelectedSlotId(slot.id);
                  setSubmitState("idle");
                }}
                disabled={!slot.available || submitState === "loading"}
              >
                <span>{slot.label}</span>
                <small>{slot.available ? "Available" : "Unavailable"}</small>
              </button>
            ))}
          </div>
        </div>

        <form className={s.contactColumn} onSubmit={handleSubmit}>
          <div className={s.sectionHeading}>
            <span>Booking details</span>
            <strong>{compactDateRange(selectedSlot)}</strong>
          </div>
          {briefId ? (
            <div className={s.briefBadge}>
              <span>Brief</span>
              <strong>{briefId}</strong>
            </div>
          ) : null}
          <label className={s.field}>
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
          </label>
          <label className={s.field}>
            <span>Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" type="email" />
          </label>
          <label className={s.field}>
            <span>Company</span>
            <input value={company} onChange={(event) => setCompany(event.target.value)} autoComplete="organization" />
          </label>
          <label className={s.field}>
            <span>Notes</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          <button className={s.submitBtn} type="submit" disabled={!ready || submitState === "submitting"}>
            {submitState === "submitting" ? "Creating booking" : "Reserve discovery call"}
          </button>
          {message ? (
            <p className={submitState === "error" ? s.error : submitState === "success" ? s.success : s.note}>
              {message}
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
}
