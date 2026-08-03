import { headers } from "next/headers";
import { CreativeWorkspacePage } from "@/app/root/components/creative-workspace-page";
import { getRootMarketingExecutionSnapshot, getRootMarketingProofSnapshot } from "@/lib/root-marketing";
import { resolveRootBrand } from "@/lib/root-brand";

export default async function RootCoDeliverPage() {
  const headerStore = await headers();
  const brand = resolveRootBrand(headerStore.get("host"), headerStore.get("x-root-brand"));
  const execution = await getRootMarketingExecutionSnapshot(brand.key);
  const proof = await getRootMarketingProofSnapshot(brand.key);
  const featuredDelivery = {
    title: "LEAD customer stories",
    subtitle: "Accurate Meter & Supply delivery track",
    status: "handoff_ready",
    note:
      "Brand film proof is already in approval, while supporting banners still need review closure before the package is fully delivery-clean.",
  };
  const wipsterItems = [
    {
      id: "accurate-meter-brand-film",
      title: "AM_SPLICING / FINAL FINAL",
      subtitle: "4:20 brand film for Accurate Meter & Supply",
      status: "in_approval",
      note: "Wipster project shows V6 uploaded 7 months ago with 2 reviewers on the approval pass.",
    },
    {
      id: "accurate-meter-banner-1",
      title: "Banner #1",
      subtitle: "Lead customer story support asset",
      status: "in_review",
      note: "V1 uploaded 9 months ago with 1 reviewer still holding the review state open.",
    },
    {
      id: "accurate-meter-banner-2",
      title: "Banner #2",
      subtitle: "Lead customer story support asset",
      status: "in_review",
      note: "V1 uploaded 9 months ago with 1 reviewer still holding the review state open.",
    },
    {
      id: "accurate-meter-banner-3",
      title: "Banner #3",
      subtitle: "Lead customer story support asset",
      status: "in_review",
      note: "V1 uploaded 9 months ago with 1 reviewer still holding the review state open.",
    },
  ];

  return (
    <CreativeWorkspacePage
      kicker="creative engine"
      title="co-deliver"
      description="Delivery and review workspace for final handoff: reviewed proof, client-ready packaging, approval-state clarity, and distribution context for the LEAD customer-story lane."
      meta={[
        { label: "workspace", value: brand.key.toUpperCase(), tone: "accent" },
        { label: "product", value: "co-deliver", tone: "accent" },
        { label: "authority", value: "ROOT-native bridge" },
        { label: "canonical app", value: "deliver.contentco-op.com", tone: "accent" },
        { label: "legacy alias", value: "co-deliver.contentco-op.com", tone: "warn" },
        { label: "featured handoff", value: "Accurate Meter x LEAD", tone: "accent" },
      ]}
      actions={[
        { label: "proof board", href: "/root/marketing/proof", tone: "secondary" },
        { label: "delivery board", href: "/root/marketing/execution", tone: "secondary" },
        { label: "open co-deliver", href: "https://deliver.contentco-op.com", tone: "primary" },
      ]}
      metrics={[
        { label: "featured client", value: "accurate meter", note: "Precision-measurement brand positioned as premium capability proof." },
        { label: "hero asset", value: "brand film", note: "4:20 flagship story already advanced to approval in Wipster." },
        { label: "support assets", value: "3 banners", note: "Three companion customer-story banners remain in review." },
        { label: "review split", value: "1 approved path / 3 open", note: "One delivery lane is close to handoff while support pieces still need review cleanup." },
        ...(proof.metrics.slice(0, 2).map((metric) => ({ label: metric.label, value: metric.value, note: metric.note }))),
        ...(execution.metrics.slice(0, 2).map((metric) => ({ label: metric.label, value: metric.value, note: metric.note }))),
      ]}
      sections={[
        {
          id: "featured-delivery",
          label: "featured delivery narrative",
          description:
            "A live delivery readout for the LEAD customer-story package, combining the existing portfolio proof with the current Wipster review state.",
          items: [
            {
              id: "lead-customer-story",
              title: featuredDelivery.title,
              subtitle: featuredDelivery.subtitle,
              status: featuredDelivery.status,
              note: featuredDelivery.note,
            },
            {
              id: "accurate-meter-story",
              title: "Accurate Meter & Supply",
              subtitle: "Facilities, field, and leadership coverage shaped into one premium-positioning story.",
              status: "proof_aligned",
              note:
                "Portfolio framing: a precision-measurement business presented like a high-trust commercial capability rather than a commodity vendor.",
            },
          ],
        },
        {
          id: "review-queue",
          label: "review queue",
          description: "Wipster-exported review state for the Accurate Meter customer-story package.",
          items: wipsterItems,
        },
        ...proof.sections.slice(0, 2).map((section) => ({
          id: section.id,
          label: section.label,
          description: section.description,
          items: section.items.slice(0, 6).map((item) => ({
            id: item.id,
            title: item.title,
            subtitle: item.subtitle,
            status: item.status,
            note: item.note,
            href: item.href,
          })),
        })),
        {
          id: "handoff",
          label: execution.sections[0]?.label || "delivery in motion",
          description: execution.sections[0]?.description || "Delivery-ready projects already moving through execution.",
          items: (execution.sections[0]?.items || []).slice(0, 6).map((item) => ({
            id: item.id,
            title: item.title,
            subtitle: item.subtitle,
            status: item.status,
            note: item.note,
            href: item.href,
          })),
        },
      ]}
    />
  );
}
