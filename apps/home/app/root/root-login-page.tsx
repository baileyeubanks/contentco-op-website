"use client";

import Link from "next/link";
import { useState } from "react";

export default function RootLoginPage() {
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

    const res = await fetch("/api/root/login", {
      method: "POST",
      body: form,
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
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="root-login-card">
        <div className="root-login-brand">
          <span className="root-login-dot" />
          <span className="root-login-name">root</span>
        </div>
        <p className="root-login-sub">admin access only · email + password</p>

        <form onSubmit={handleLogin} className="root-login-form">
          <label className="root-login-field">
            <span className="root-login-label">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="root-login-input"
              required
              autoFocus
            />
          </label>
          <label className="root-login-field">
            <span className="root-login-label">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="root-login-input"
              required
            />
          </label>
          {error && <div className="root-login-error">{error}</div>}
          <button type="submit" className="root-login-btn" disabled={loading}>
            {loading ? "signing in..." : "sign in to root"}
          </button>
        </form>
        <p className="root-login-sub" style={{ marginTop: 16 }}>
          Looping or stuck? <Link href="/root/logout" prefetch={false}>reset session</Link>
        </p>
      </div>
    </main>
  );
}
