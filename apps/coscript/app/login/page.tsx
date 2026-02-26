export default function LoginPage() {
  return (
    <main className="shell" style={{ padding: "2rem 0" }}>
      <section className="panel" style={{ maxWidth: 520 }}>
        <h1 style={{ marginTop: 0 }}>Co-Script Login</h1>
        <p className="muted">Invite-only access for script operators and approvers.</p>
        <form method="post" action="/api/auth/login" style={{ display: "grid", gap: ".7rem", marginTop: ".8rem" }}>
          <input className="field" name="email" type="email" required placeholder="Work email" />
          <input className="field" name="password" type="password" required placeholder="Password" />
          <input className="field" name="invite_code" type="password" required placeholder="Invite code" />
          <button className="button primary" type="submit" style={{ width: "fit-content" }}>
            Log in
          </button>
        </form>
      </section>
    </main>
  );
}

