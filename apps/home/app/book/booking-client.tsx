"use client";
import { useEffect, useRef, useState } from "react";
import type { CcoBookingSlot } from "@/lib/cco-booking";
import { createBookingSession } from "@/lib/cco-discovery-booking-session";
import s from "./page.module.css";
export function DiscoveryBookingForm({ slots, selected, name, email, frozen, sending, message, onSelect, onName, onEmail, onSubmit }: {
  slots: CcoBookingSlot[]; selected: string; name: string; email: string; frozen: boolean; sending: boolean; message: string;
  onSelect: (id: string) => void; onName: (value: string) => void; onEmail: (value: string) => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return <form onSubmit={onSubmit}>
    <div className={s.slots}>{slots.map((slot) => <label key={slot.id}><input type="radio" name="slot" value={slot.id} checked={selected === slot.id} onChange={() => onSelect(slot.id)} required disabled={sending || frozen} />{slot.label} Central Time</label>)}</div>
    {!slots.length && <p>No discovery times are available. Please contact our team.</p>}
    <p><label>Your name <input name="name" value={name} onChange={(event) => onName(event.target.value)} required minLength={2} maxLength={160} disabled={sending} readOnly={frozen} autoComplete="name" /></label></p>
    <p><label>Email <input name="email" value={email} onChange={(event) => onEmail(event.target.value)} type="email" required maxLength={254} disabled={sending} readOnly={frozen} autoComplete="email" /></label></p>
    <button type="submit" disabled={!selected || sending}>{sending ? "Verifying…" : frozen ? "Verify this booking request" : "Reserve a 20-minute call"}</button>
    {message && <p className={s.error}>{message}</p>}
  </form>;
}
export function BookingClient() {
  const session = useRef<ReturnType<typeof createBookingSession> | null>(null);
  const [slots, setSlots] = useState<CcoBookingSlot[]>([]);
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [sending, setSending] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [message, setMessage] = useState("");
  const [receipt, setReceipt] = useState<{ bookingId: string; meetUrl: string; startsAt: string } | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    let pendingSlot: CcoBookingSlot | null = null;
    try {
      session.current = createBookingSession(sessionStorage, async (request) => {
        const response = await fetch("/api/cco/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) });
        const data = await response.json();
        return { ...data, ok: response.ok && data.ok === true };
      });
      const pending = session.current.read();
      if (pending) {
        setName(pending.request.name); setEmail(pending.request.email); setSelected(pending.slotId); setFrozen(true);
        setMessage("A previous booking request needs verification. Retry this same request or email our team before choosing another time.");
        pendingSlot = { id: pending.slotId, label: pending.label, startsAt: pending.request.startsAt, endsAt: pending.request.endsAt, durationMinutes: 20, available: false, source: "pending_verification" };
        setSlots([pendingSlot]);
      }
    } catch { setMessage("Your previous booking status could not be verified. Please email our team before trying again."); setUnavailable(true); setLoading(false); return; }
    fetch("/api/cco/bookings/availability", { signal: abort.signal, cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("unavailable");
      const data = await response.json();
      if (!data.ok || !Array.isArray(data.slots)) throw new Error("unavailable");
      // A pending request is shown solely for verification, never as newly
      // available time. Its exact stored identity survives a hidden claim.
      setSlots(pendingSlot ? [pendingSlot] : data.slots);
    }).catch(() => { if (!abort.signal.aborted && !pendingSlot) setUnavailable(true); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const slot = slots.find((item) => item.id === selected);
    if (!slot || !session.current) return;
    setSending(true); setMessage("");
    try {
      const responsePromise = session.current.submit({ name: name.trim(), email: email.trim().toLowerCase(), startsAt: slot.startsAt, endsAt: slot.endsAt }, { id: slot.id, label: slot.label });
      setFrozen(true);
      const data = await responsePromise;
      if (!data.ok || !data.bookingId || !data.receipt?.meetUrl || !data.receipt.startsAt) {
        setMessage(data.bookingId ? `Your booking requires verification. Reference ${data.bookingId}. Please email our team before choosing another time.` : "This request could not be confirmed. Please retry this same request or email our team before choosing another time."); return;
      }
      setReceipt({ bookingId: data.bookingId, meetUrl: data.receipt.meetUrl, startsAt: data.receipt.startsAt });
    } catch { setMessage("The booking response could not be verified. Retry this same request or email our team before choosing another time."); }
    finally { setSending(false); }
  }
  return <section className={s.bookingPanel} aria-live="polite">
    <div className={s.bookingHeader}><div><p className={s.kicker}>Discovery Call</p><h2>{loading ? "Checking availability" : receipt ? "Your call is reserved" : unavailable ? "Scheduling unavailable" : frozen ? "Verify your request" : "Choose a time"}</h2></div></div>
    {loading ? <p>Checking our calendar…</p> : receipt ? <><p>{new Date(receipt.startsAt).toLocaleString()} · 20 minutes</p><p><a href={receipt.meetUrl}>Join your Google Meet</a></p><p className={s.note}>Booking reference: {receipt.bookingId}. Your calendar invitation has been requested.</p></> : unavailable ? <p className={s.error}>{message || "Online discovery-call scheduling is temporarily unavailable. No time has been reserved."}</p> : <DiscoveryBookingForm slots={slots} selected={selected} name={name} email={email} frozen={frozen} sending={sending} message={message} onSelect={setSelected} onName={setName} onEmail={setEmail} onSubmit={submit} />}
    <p className={s.note}>Please email <a href="mailto:service@contentco-op.com">service@contentco-op.com</a> and our team will arrange a time with you.</p>
  </section>;
}
