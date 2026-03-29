"use client";

import { useState, FormEvent } from "react";
import { ProductLoginShell } from "@contentco-op/ui";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: fd.get("email"),
          password: fd.get("password"),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Invalid credentials");
        setLoading(false);
        return;
      }
      window.location.href = "/";
    } catch {
      setError("Connection error. Try again.");
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <ProductLoginShell
      productLabel="Co-Script"
      description="Script generation from watchlists, outlier detection, and AI-powered writing."
      error={error}
      loading={loading}
      onSubmit={handleSubmit}
      onGoogleLogin={handleGoogleLogin}
      signupHref="/signup"
      signupLabel="Create one"
    />
  );
}
