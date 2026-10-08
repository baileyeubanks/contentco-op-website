"use client";
import { useState } from "react";
import { requestOperatorClientLink } from "@/lib/operator-client-link";
export function InvoiceShareActions({ invoiceId, clientEmail, clientName, invoiceNumber }: {
 invoiceId: string; clientEmail: string | null; clientName: string | null; invoiceNumber: string | null;
}) {
 const [error, setError] = useState("");
 async function act(action: "copy" | "open" | "send") {
  try {
   setError(""); const url = await requestOperatorClientLink("invoice", invoiceId);
   if (action === "copy") await navigator.clipboard.writeText(url);
   else if (action === "open") window.open(url, "_blank", "noopener,noreferrer");
   else if (clientEmail) window.location.href = `mailto:${encodeURIComponent(clientEmail)}?subject=${encodeURIComponent(`${invoiceNumber || "Invoice"} from Content Co-op`)}&body=${encodeURIComponent(`Hi ${clientName || "there"},\n\nYour invoice is ready: ${url}\n\nContact service@contentco-op.com with questions.`)}`;
  } catch { setError("Share link unavailable. Please try again."); }
 }
 return <><button className="os-atlas-button os-atlas-button-secondary" onClick={() => void act("copy")}>copy share link</button><button className="os-atlas-button os-atlas-button-secondary" onClick={() => void act("open")}>open share page</button>{clientEmail && <button className="os-atlas-button os-atlas-button-secondary" onClick={() => void act("send")}>send / resend</button>}{error && <p role="alert">{error}</p>}</>;
}
