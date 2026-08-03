"use client";

import { useEffect, useState, type FormEvent } from "react";
import { PublicPageLayout } from "@/app/components/public-page-layout";
import { ProductLoginShell } from "@contentco-op/ui";

function isAdminHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host === "admin.contentco-op.com" || host.startsWith("admin.");
}

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [adminSurface, setAdminSurface] = useState(false);

  useEffect(() => {
    setAdminSurface(isAdminHost(window.location.hostname));
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const payload = new FormData();
    payload.set("email", String(form.get("email") || "").trim().toLowerCase());
    payload.set("password", String(form.get("password") || ""));

    const res = await fetch("/api/os/login", {
      method: "POST",
      body: payload,
    });

    const data = await res.json().catch(() => ({ error: "Login failed" }));
    if (!res.ok) {
      setError(data.error || "Login failed");
      setLoading(false);
      return;
    }

    window.location.href = data.redirectTo || "/os/overview";
  }

  return (
    <PublicPageLayout surface="login" theme="dark" showFooter={false}>
      <ProductLoginShell
        productLabel={adminSurface ? "CCO OS" : "Co-VideoPro"}
        description={
          adminSurface
            ? "Operator access to CCO OS. Quotes, delivery, finance, and system health."
            : "Client access to your video production pipeline with Content Co-op."
        }
        error={error}
        loading={loading}
        onSubmit={handleLogin}
        submitLabel="Sign in"
        loadingLabel="Signing in..."
        signupHref={adminSurface ? "/os/login" : "/brief"}
        signupLabel={adminSurface ? "Open CCO OS login" : "Start a project"}
        homeHref="/"
      />
    </PublicPageLayout>
  );
}
