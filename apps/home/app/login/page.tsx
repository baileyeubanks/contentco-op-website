"use client";

import { useState, type FormEvent } from "react";
import { PublicPageLayout } from "@/app/components/public-page-layout";
import { ProductLoginShell } from "@contentco-op/ui";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const payload = new FormData();
    payload.set("email", String(form.get("email") || "").trim().toLowerCase());
    payload.set("password", String(form.get("password") || ""));

    const res = await fetch("/api/root/login", {
      method: "POST",
      body: payload,
    });

    const data = await res.json().catch(() => ({ error: "Login failed" }));
    if (!res.ok) {
      setError(data.error || "Login failed");
      setLoading(false);
      return;
    }

    window.location.href = data.redirectTo || "/root/overview";
  }

  return (
    <PublicPageLayout surface="login" theme="dark" showFooter={false}>
      <ProductLoginShell
        productLabel="Root"
        description="Internal access for the shared ACS and Content Co-op operating system."
        error={error}
        loading={loading}
        onSubmit={handleLogin}
        submitLabel="Enter root"
        loadingLabel="Entering root..."
        signupHref="/"
        signupLabel="Return home"
        homeHref="/"
      />
    </PublicPageLayout>
  );
}
