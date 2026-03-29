import { headers } from "next/headers";
import { CreativeWorkspacePage } from "@/app/root/components/creative-workspace-page";
import { getRootMarketingExecutionSnapshot, getRootMarketingProofSnapshot } from "@/lib/root-marketing";
import { resolveRootBrand } from "@/lib/root-brand";

export default async function RootCoEditPage() {
  const headerStore = await headers();
  const brand = resolveRootBrand(headerStore.get("host"), headerStore.get("x-root-brand"));
  const execution = await getRootMarketingExecutionSnapshot(brand.key);
  const proof = await getRootMarketingProofSnapshot(brand.key);

  return (
    <CreativeWorkspacePage
      kicker="creative engine"
      title="co-cut"
      description="Editorial control surface for transcript-first post-production: in-flight scope, review state, precedent proof, and backlog cleanup."
      meta={[
        { label: "workspace", value: brand.key.toUpperCase(), tone: "accent" },
        { label: "product", value: "co-cut", tone: "accent" },
        { label: "authority", value: "ROOT-native bridge" },
        { label: "canonical app", value: "cut.contentco-op.com", tone: "accent" },
        { label: "legacy alias", value: "co-cut.contentco-op.com", tone: "warn" },
      ]}
      actions={[
        { label: "delivery board", href: "/root/marketing/execution", tone: "secondary" },
        { label: "proof board", href: "/root/marketing/proof", tone: "secondary" },
        { label: "open co-cut", href: "https://cut.contentco-op.com", tone: "primary" },
      ]}
      metrics={execution.metrics.slice(0, 4).map((metric) => ({
        label: metric.label,
        value: metric.value,
        note: metric.note,
      }))}
      sections={[
        ...execution.sections.slice(0, 3).map((section) => ({
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
          id: "proof",
          label: proof.sections[0]?.label || "proof",
          description: proof.sections[0]?.description || "Reviewed proof that should shape editorial choices and client confidence.",
          items: (proof.sections[0]?.items || []).slice(0, 5).map((item) => ({
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
