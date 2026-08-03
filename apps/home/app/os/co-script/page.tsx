import { headers } from "next/headers";
import { CreativeWorkspacePage } from "@/app/root/components/creative-workspace-page";
import { getRootMarketingBriefQueue, getRootMarketingWorkflowSnapshot } from "@/lib/root-marketing";
import { resolveRootBrand } from "@/lib/root-brand";

export default async function RootCoScriptPage() {
  const headerStore = await headers();
  const brand = resolveRootBrand(headerStore.get("host"), headerStore.get("x-root-brand"));
  const briefs = await getRootMarketingBriefQueue(brand.key);
  const workflow = await getRootMarketingWorkflowSnapshot(brand.key);

  return (
    <CreativeWorkspacePage
      kicker="creative engine"
      title="co-script"
      description="Pre-production workspace for turning brief intake into structured scope, script direction, and quote-ready commercial handoff."
      meta={[
        { label: "workspace", value: brand.key.toUpperCase(), tone: "accent" },
        { label: "product", value: "co-script", tone: "accent" },
        { label: "authority", value: "ROOT-native bridge" },
        { label: "canonical app", value: "script.contentco-op.com", tone: "accent" },
        { label: "legacy alias", value: "co-script.contentco-op.com", tone: "warn" },
      ]}
      actions={[
        { label: "brief queue", href: "/root/marketing/briefs", tone: "secondary" },
        { label: "marketing workflow", href: "/root/marketing/workflow", tone: "secondary" },
        { label: "open co-script", href: "https://script.contentco-op.com", tone: "primary" },
      ]}
      metrics={[
        { label: "briefs", value: String(briefs.length), note: "creative intakes currently visible to operators" },
        { label: "quote ready", value: String(briefs.filter((brief) => brief.quoteReady).length), note: "briefs ready to become commercial scope" },
        { label: "needs cleanup", value: String(briefs.filter((brief) => !brief.quoteReady).length), note: "briefs still missing critical scope detail" },
        { label: "workflow lanes", value: String(workflow.lanes.length), note: "creative funnel stages linked into ROOT" },
      ]}
      sections={[
        {
          id: "briefs",
          label: "active brief queue",
          description: "The next script-ready briefs, with blockers and deliverables still visible before they turn into quotes.",
          items: briefs.slice(0, 8).map((brief) => ({
            id: brief.id,
            title: brief.title,
            subtitle: brief.company || brief.contentType,
            status: brief.status,
            note: brief.deliverables.length > 0 ? `deliverables: ${brief.deliverables.join(", ")}` : "no deliverables scoped yet",
            href: brief.href,
          })),
        },
        ...workflow.lanes.slice(0, 2).map((lane) => ({
          id: lane.id,
          label: lane.label,
          description: lane.description,
          items: lane.items.slice(0, 6).map((item) => ({
            id: item.id,
            title: item.title,
            subtitle: item.subtitle,
            status: item.status,
            note: item.note,
            href: item.href,
          })),
        })),
      ]}
    />
  );
}
