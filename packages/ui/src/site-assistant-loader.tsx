"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __CCO_CHATBOT_CONFIG__?: {
      apiUrl?: string;
      assistantName?: string;
      domain?: string;
      siteKey?: string;
      surface?: string;
    };
  }
}

type SiteAssistantLoaderProps = {
  apiUrl?: string;
  assistantName?: string;
  domain?: string;
  scriptUrl?: string;
  siteKey?: string;
  surface?: string;
};

export function SiteAssistantLoader({
  apiUrl,
  assistantName,
  domain,
  scriptUrl,
  siteKey,
  surface,
}: SiteAssistantLoaderProps) {
  useEffect(() => {
    if (!scriptUrl || typeof window === "undefined") {
      return;
    }

    window.__CCO_CHATBOT_CONFIG__ = {
      ...window.__CCO_CHATBOT_CONFIG__,
      apiUrl,
      assistantName,
      domain,
      siteKey,
      surface,
    };

    const existing = document.querySelector<HTMLScriptElement>('script[data-cco-chatbot="true"]');
    if (existing) {
      return;
    }

    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    script.defer = true;
    script.dataset.ccoChatbot = "true";

    const load = () => {
      document.body.appendChild(script);
    };

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(load);
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = setTimeout(load, 600);
    return () => clearTimeout(timeoutId);
  }, [apiUrl, assistantName, domain, scriptUrl, siteKey, surface]);

  return null;
}
