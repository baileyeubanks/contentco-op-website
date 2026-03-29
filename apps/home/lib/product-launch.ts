export type ProductLaunchKey = "cocut" | "coscript" | "codeliver";

export type ProductLaunchDefinition = {
  key: ProductLaunchKey;
  surface: "cocut" | "coscript" | "codeliver";
  slug: "/co-cut" | "/co-script" | "/co-deliver";
  name: string;
  label: string;
  externalUrl: string;
  statusLabel: string;
  headline: string;
  description: string;
  supportCopy: string;
  highlights: string[];
};

export type ProductLaunchProbe = {
  availability: "healthy" | "unavailable";
  statusCode: number | null;
  statusDetail: string;
  shouldRedirect: boolean;
};

export const PRODUCT_LAUNCHES: Record<ProductLaunchKey, ProductLaunchDefinition> = {
  cocut: {
    key: "cocut",
    surface: "cocut",
    slug: "/co-cut",
    name: "Co-Cut",
    label: "Editorial workspace",
    externalUrl: "https://cut.contentco-op.com",
    statusLabel: "Public host unavailable",
    headline: "Co-Cut is being reconnected to the platform.",
    description:
      "The browser-native editing workspace is healthy in the repo, but the public host is still returning an upstream error. This launch page keeps the tab trustworthy while the host cutover gets repaired.",
    supportCopy:
      "If you need to kick off a project right now, route the brief first or book the strategy call and we will move the editorial handoff manually.",
    highlights: [
      "Transcript-first post-production flow",
      "Browser-native timeline and media bin",
      "Designed for fast boardroom-ready revisions",
    ],
  },
  coscript: {
    key: "coscript",
    surface: "coscript",
    slug: "/co-script",
    name: "Co-Script",
    label: "Pre-production workspace",
    externalUrl: "https://script.contentco-op.com",
    statusLabel: "Live workspace",
    headline: "Co-Script launch relay",
    description:
      "Route public and internal traffic through a stable platform path, then hand off to the dedicated workspace once the host responds.",
    supportCopy:
      "Use the creative brief when you want the project context captured before landing in the scripting workspace.",
    highlights: [
      "Brief intake to structured script direction",
      "Quote-ready pre-production handoff",
      "Shared access path for operators and clients",
    ],
  },
  codeliver: {
    key: "codeliver",
    surface: "codeliver",
    slug: "/co-deliver",
    name: "Co-Deliver",
    label: "Review and delivery workspace",
    externalUrl: "https://deliver.contentco-op.com",
    statusLabel: "Live workspace",
    headline: "Co-Deliver launch relay",
    description:
      "Route product entry through the platform shell, then hand off to the review and delivery workspace once the host responds.",
    supportCopy:
      "Use the client login if you already have a portal path or review token and need to get straight into delivery context.",
    highlights: [
      "Timecoded review and approvals",
      "Version-aware delivery handoff",
      "Cleaner stakeholder feedback loops",
    ],
  },
};

export async function probeProductLaunch(key: ProductLaunchKey): Promise<ProductLaunchProbe> {
  const product = PRODUCT_LAUNCHES[key];

  try {
    const response = await fetch(product.externalUrl, {
      method: "HEAD",
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(3500),
    });

    if (response.status === 405) {
      return probeWithGet(product.externalUrl);
    }

    return normalizeProbe(response.status);
  } catch {
    return {
      availability: "unavailable",
      statusCode: null,
      statusDetail: "external host unreachable",
      shouldRedirect: false,
    };
  }
}

async function probeWithGet(url: string): Promise<ProductLaunchProbe> {
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(3500),
    });

    return normalizeProbe(response.status);
  } catch {
    return {
      availability: "unavailable",
      statusCode: null,
      statusDetail: "external host unreachable",
      shouldRedirect: false,
    };
  }
}

function normalizeProbe(statusCode: number): ProductLaunchProbe {
  const shouldRedirect = statusCode < 500 && statusCode !== 404;

  return {
    availability: shouldRedirect ? "healthy" : "unavailable",
    statusCode,
    statusDetail: shouldRedirect ? `host responded (${statusCode})` : `host unavailable (${statusCode})`,
    shouldRedirect,
  };
}
