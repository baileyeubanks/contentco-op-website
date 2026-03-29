import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { isStripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export default async function ShareInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { id } = await params;
  const { paid } = await searchParams;
  const sb = getSupabase();
  const { data: invoice } = await sb
    .from("invoices")
    .select("id, invoice_number, client_name, total, amount, business_unit, stripe_payment_link, payment_status")
    .eq("id", id)
    .maybeSingle();

  if (!invoice) notFound();

  const previewUrl = `/api/root/invoices/${id}/preview`;
  const pdfUrl = `/api/root/invoices/${id}/pdf`;
  const brandColor = invoice.business_unit === "ACS" ? "#1B4F72" : "#1a3a5c";
  const brandName = invoice.business_unit === "ACS" ? "Astro Cleanings" : "Content Co-Op";
  const total = Number(invoice.total || invoice.amount || 0);
  const isPaid = invoice.payment_status === "paid" || paid === "true";
  const hasPayLink = !!invoice.stripe_payment_link;
  const stripeReady = isStripeConfigured();

  return (
    <main style={{ minHeight: "100vh", background: "#f5f5f5", padding: "24px 16px" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        {/* Paid confirmation */}
        {isPaid && (
          <div
            style={{
              marginBottom: 16,
              padding: "14px 20px",
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              borderRadius: 6,
              textAlign: "center",
              fontSize: 14,
              fontWeight: 600,
              color: "#065f46",
            }}
          >
            Payment received — thank you!
          </div>
        )}

        {/* Action Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
            padding: "12px 20px",
            background: "#fff",
            borderRadius: 6,
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: brandColor }}>{brandName}</div>
            <div style={{ fontSize: 12, color: "#888" }}>
              Invoice {invoice.invoice_number} — {invoice.client_name}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener"
              style={{
                padding: "8px 16px",
                background: "#fff",
                color: brandColor,
                border: `1px solid ${brandColor}`,
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Download PDF
            </a>
            {!isPaid && hasPayLink && (
              <a
                href={invoice.stripe_payment_link}
                style={{
                  padding: "8px 20px",
                  background: brandColor,
                  color: "#fff",
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Pay ${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </a>
            )}
            {!isPaid && !hasPayLink && stripeReady && (
              <form action={`/api/root/invoices/${id}/pay-link`} method="POST">
                <button
                  type="submit"
                  style={{
                    padding: "8px 20px",
                    background: brandColor,
                    color: "#fff",
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Pay ${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Preview Embed */}
        <iframe
          src={previewUrl}
          style={{
            width: "100%",
            minHeight: "calc(100vh - 140px)",
            border: "none",
            borderRadius: 4,
            boxShadow: "0 1px 6px rgba(0,0,0,0.1)",
            background: "#fff",
          }}
          title={`Invoice ${invoice.invoice_number}`}
        />
      </div>
    </main>
  );
}
