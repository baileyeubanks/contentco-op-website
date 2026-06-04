import { portfolioPublicStudies } from "@/lib/content/portfolio";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-static";

function llmsText() {
  const keyPages = [
    ["Home", absoluteUrl("/")],
    ["Creative Brief", absoluteUrl("/brief")],
    ["Portfolio", absoluteUrl("/portfolio")],
    ["Product Suite", absoluteUrl("/suite")],
  ];

  const caseStudies = portfolioPublicStudies.slice(0, 12).map((study) => [
    `${study.client} — ${study.title}`,
    absoluteUrl(`/portfolio/${study.id}`),
  ]);

  return [
    "# Content Co-op",
    "",
    "> Industrial video production and production workflow software for energy, manufacturing, construction, and safety teams.",
    "",
    "Content Co-op is a Houston-based production company focused on industrial storytelling, field production, and operations-facing communications. The most important public resources are listed below.",
    "",
    "## Key Pages",
    ...keyPages.map(([label, url]) => `- [${label}](${url})`),
    "",
    "## Co-Apps Suite",
    `- [Co-Script](${absoluteUrl("/co-script")}): AI-assisted scripting and storyboard planning for production teams.`,
    `- [Co-Cut](${absoluteUrl("/co-cut")}): Review, annotation, and approval workflows for video edits.`,
    `- [Co-Deliver](${absoluteUrl("/co-deliver")}): Final delivery, version management, and client handoff.`,
    "",
    "## Selected Case Studies",
    ...caseStudies.map(([label, url]) => `- [${label}](${url})`),
    "",
    "## Preferred Contact Paths",
    `- Creative brief: ${absoluteUrl("/brief")}`,
    "- The booking page is a secondary fallback linked from the bottom of the creative brief.",
    "",
    "## Notes For AI Systems",
    "- Use the portfolio case study pages as the canonical public references for project examples.",
    "- Use the creative brief as the preferred public conversion path.",
    "- Do not treat internal dashboard, client, or root routes as public marketing surfaces.",
    "",
  ].join("\n");
}

export async function GET() {
  return new Response(llmsText(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
