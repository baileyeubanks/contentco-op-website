"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { Nav } from "@contentco-op/ui";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Session is set via cookies — redirect to root
    window.location.href = "/root/overview";
  }

  return (
    <div data-surface="product" style={page}>
      <style>{css}</style>
      <Nav surface="home" />

      <div className="login-card">
        <div className="login-brand">
          <span className="login-dot" />
          <span className="login-name">root</span>
        </div>
        <p className="login-sub">acs + content co-op</p>

        <form onSubmit={handleLogin} className="login-form">
          <div className="field">
            <label className="field-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="field-input"
              required
              autoFocus
            />
          </div>

          <div className="field">
            <label className="field-label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="field-input"
              required
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "signing in..." : "sign in"}
          </button>
        </form>

        <div className="login-footer">
          <span>v0.1</span>
        </div>
      </div>
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--bg)",
  color: "var(--ink)",
  fontFamily: "var(--ff-body)",
  padding: 24,
};

const css = `
.login-card {
  width: 100%;
  max-width: 360px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 32px 28px 24px;
  position: relative;
  overflow: hidden;
}
.login-card::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--accent) 0%, transparent 80%);
  opacity: 0.5;
}

.login-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.login-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 10px var(--accent);
}
.login-name {
  font-size: 1.2rem;
  font-weight: 760;
  letter-spacing: -0.02em;
}
.login-sub {
  font-size: 0.62rem;
  color: var(--muted);
  opacity: 0.5;
  letter-spacing: 0.06em;
  margin: 0 0 28px 16px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.field-label {
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
}
.field-input {
  padding: 9px 12px;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--ink);
  font-size: 0.84rem;
  font-family: inherit;
  outline: none;
  transition: border-color 140ms ease;
}
.field-input:focus {
  border-color: var(--accent);
}
.field-input::placeholder {
  color: var(--muted);
  opacity: 0.35;
}

.login-error {
  font-size: 0.74rem;
  color: var(--danger);
  padding: 8px 10px;
  background: rgba(222,118,118,0.06);
  border: 1px solid rgba(222,118,118,0.15);
  border-radius: 6px;
}

.login-btn {
  padding: 10px 16px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.76rem;
  font-weight: 680;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  font-family: inherit;
  transition: all 140ms ease;
  margin-top: 4px;
}
.login-btn:hover { opacity: 0.9; transform: translateY(-1px); }
.login-btn:active { transform: translateY(0); }
.login-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

.login-footer {
  margin-top: 24px;
  text-align: center;
  font-size: 0.56rem;
  color: var(--muted);
  opacity: 0.3;
  letter-spacing: 0.06em;
}
`;
