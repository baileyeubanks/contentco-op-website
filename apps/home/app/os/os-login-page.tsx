"use client";

import Link from "next/link";
import { useState } from "react";

export default function OsLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData();
    form.set("email", email.trim().toLowerCase());
    form.set("password", password);

    const res = await fetch("/api/os/login", {
      method: "POST",
      body: form,
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
    <main className="os-login-shell">
      <div className="os-login-card">
        <div className="os-login-brand">
          <span className="os-login-dot" aria-hidden="true" />
          <span className="os-login-name">CCO OS</span>
        </div>
        <p className="os-login-sub">Content Co-op operator · email + password</p>

        <form onSubmit={handleLogin} className="os-login-form">
          <label className="os-login-field">
            <span className="os-login-label">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="os-login-input"
              required
              autoFocus
              autoComplete="username"
            />
          </label>
          <label className="os-login-field">
            <span className="os-login-label">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="os-login-input"
              required
              autoComplete="current-password"
            />
          </label>
          {error ? (
            <div className="os-login-error" role="alert">
              {error}
            </div>
          ) : null}
          <button type="submit" className="os-login-btn" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="os-login-footer">
          Looping or stuck?{" "}
          <Link href="/os/logout" prefetch={false}>
            Reset session
          </Link>
        </p>
      </div>
    </main>
  );
}
