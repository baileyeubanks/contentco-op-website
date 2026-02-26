export default function LoginPage() {
  return (
    <main className="shell" style={{ padding: "2rem 0" }}>
      <section className="panel" style={{ maxWidth: 520 }}>
        <h1 style={{ marginTop: 0 }}>Co-Edit Login</h1>
        <p className="muted">Invite-only access. Reviewers and approvers must authenticate.</p>
        <form method="post" action="/api/auth/login" style={{ display: "grid", gap: ".7rem", marginTop: ".8rem" }}>
          <input name="email" type="email" required placeholder="Work email" style={{ padding: ".7rem", borderRadius: 10, border: "1px solid #3b5678", background: "#0f1c31", color: "#e9f1ff" }} />
          <input name="password" type="password" required placeholder="Password" style={{ padding: ".7rem", borderRadius: 10, border: "1px solid #3b5678", background: "#0f1c31", color: "#e9f1ff" }} />
          <input name="invite_code" type="password" required placeholder="Invite code" style={{ padding: ".7rem", borderRadius: 10, border: "1px solid #3b5678", background: "#0f1c31", color: "#e9f1ff" }} />
          <button className="button" type="submit" style={{ width: "fit-content" }}>Log in</button>
        </form>
      </section>
    </main>
  );
}
