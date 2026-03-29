/**
 * Transactional Email Sender
 *
 * Wraps Resend API for sending transactional emails (invoices, reminders, notifications).
 * Falls back to console logging if RESEND_API_KEY is not set.
 *
 * BU-specific from addresses:
 *   ACS → hello@astrocleanings.com
 *   CC  → hello@contentco-op.com
 */

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  businessUnit?: string;
}

interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

function getFromAddress(businessUnit?: string): string {
  const bu = String(businessUnit || "ACS").toUpperCase();
  if (bu === "CC") return "Content Co-Op <hello@contentco-op.com>";
  return "Astro Cleanings <hello@astrocleanings.com>";
}

export async function sendTransactionalEmail(options: SendEmailOptions): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = options.from || getFromAddress(options.businessUnit);

  if (!apiKey) {
    console.log(`[email-sender] RESEND_API_KEY not set. Would send:
  To: ${options.to}
  From: ${from}
  Subject: ${options.subject}
  Body: ${options.html.slice(0, 200)}...`);
    return { ok: true, id: "dry-run" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [options.to],
        subject: options.subject,
        html: options.html,
        reply_to: options.replyTo || undefined,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[email-sender] Resend API error:", err);
      return { ok: false, error: err.message || `HTTP ${res.status}` };
    }

    const data = await res.json();
    return { ok: true, id: data.id };
  } catch (err) {
    console.error("[email-sender] Failed to send:", err);
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

/**
 * Send an invoice payment reminder email.
 */
export async function sendInvoiceReminder(invoice: {
  id: string;
  invoice_number: string;
  client_name: string;
  client_email: string;
  total: number;
  balance_due: number;
  due_date: string;
  business_unit: string;
}, stage: "pre_due" | "due" | "overdue_7" | "overdue_14" | "overdue_30" | "overdue_60"): Promise<SendResult> {
  const bu = String(invoice.business_unit || "ACS").toUpperCase();
  const brandName = bu === "ACS" ? "Astro Cleanings" : "Content Co-Op";
  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:4100"}/share/invoice/${invoice.id}`;
  const amount = invoice.balance_due.toLocaleString("en-US", { style: "currency", currency: "USD" });
  const dueDate = new Date(invoice.due_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const subjectMap: Record<string, string> = {
    pre_due: `Invoice ${invoice.invoice_number} — Payment Due Soon`,
    due: `Invoice ${invoice.invoice_number} — Payment Due Today`,
    overdue_7: `Invoice ${invoice.invoice_number} — Payment Overdue`,
    overdue_14: `Invoice ${invoice.invoice_number} — Second Reminder`,
    overdue_30: `Invoice ${invoice.invoice_number} — Payment Required`,
    overdue_60: `Invoice ${invoice.invoice_number} — Final Notice`,
  };

  const toneMap: Record<string, string> = {
    pre_due: `This is a friendly reminder that your invoice is due on ${dueDate}.`,
    due: `Your invoice is due today (${dueDate}).`,
    overdue_7: `Your invoice was due on ${dueDate} and is now past due.`,
    overdue_14: `This is a second reminder that your invoice from ${dueDate} remains unpaid.`,
    overdue_30: `Your invoice has been outstanding for 30 days. Please arrange payment at your earliest convenience.`,
    overdue_60: `This is a final notice regarding your overdue invoice. Please contact us immediately to arrange payment.`,
  };

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; color: #333;">
      <div style="padding: 24px 0; border-bottom: 2px solid #e5e7eb;">
        <div style="font-size: 18px; font-weight: 700; color: #111;">${brandName}</div>
      </div>
      <div style="padding: 24px 0;">
        <p>Hi ${invoice.client_name || "there"},</p>
        <p>${toneMap[stage] || toneMap.due}</p>
        <div style="margin: 20px 0; padding: 16px 20px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
          <div style="font-size: 13px; color: #666;">Invoice ${invoice.invoice_number}</div>
          <div style="font-size: 22px; font-weight: 700; color: #111; margin-top: 4px;">${amount}</div>
          <div style="font-size: 12px; color: #888; margin-top: 4px;">Due: ${dueDate}</div>
        </div>
        <a href="${shareUrl}" style="display: inline-block; padding: 12px 28px; background: ${bu === "ACS" ? "#1B4F72" : "#1a3a5c"}; color: #fff; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 14px;">
          View & Pay Invoice
        </a>
        <p style="margin-top: 20px; font-size: 13px; color: #888;">
          If you've already made this payment, please disregard this notice.
        </p>
      </div>
      <div style="padding: 16px 0; border-top: 1px solid #e5e7eb; font-size: 11px; color: #aaa;">
        ${brandName} · Sent automatically
      </div>
    </div>
  `;

  return sendTransactionalEmail({
    to: invoice.client_email,
    subject: subjectMap[stage] || subjectMap.due,
    html,
    businessUnit: invoice.business_unit,
  });
}
