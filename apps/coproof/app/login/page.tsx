export default function LoginPage() {
  return (
    <main className="shell" style={{ padding: "2rem 0" }}>
      <section className="panel" style={{ maxWidth: 520 }}>
        <h1 style={{ marginTop: 0 }}>Co-Proof Login</h1>
        <p className="muted">Stakeholder review access. Sign in to proof deliverables and submit approvals.</p>
        <form method="post" action="/api/auth/login" style={{ display: "grid", gap: ".7rem", marginTop: ".8rem" }}>
          <input className="input" name="email" type="email" required placeholder="Work email" />
          <input className="input" name="password" type="password" required placeholder="Password" />
          <input className="input" name="invite_code" type="password" required placeholder="Invite code" />
          <button className="button primary" type="submit" style={{ width: "fit-content" }}>Sign in</button>
        </form>
      </section>
    </main>
  );
}
