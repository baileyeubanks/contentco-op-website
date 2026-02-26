export default function LoginPage() {
  return (
    <main className="page">
      <div className="shell" style={{ padding: "2rem 0" }}>
        <section className="card" style={{ maxWidth: 920 }}>
          <h1 style={{ marginTop: 0 }}>Portal Login</h1>
          <p>
            Invite-only access for reviewers, approvers, and script operators. Select the product surface for sign-in.
          </p>
          <div style={{ display: "grid", gap: ".8rem", gridTemplateColumns: "1fr 1fr", marginTop: ".9rem" }}>
            <a className="card" href="https://coedit.contentco-op.com/login" style={{ display: "block", textDecoration: "none" }}>
              <h2 style={{ marginTop: 0 }}>Co-Edit</h2>
              <p style={{ marginBottom: 0 }}>
                Timecoded review, version compare, approvals, and immutable decision trail.
              </p>
            </a>
            <a className="card" href="https://coscript.contentco-op.com/login" style={{ display: "block", textDecoration: "none" }}>
              <h2 style={{ marginTop: 0 }}>Co-Script</h2>
              <p style={{ marginBottom: 0 }}>
                Watchlists, outliers, structured briefs, variant generation, and fix loop history.
              </p>
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
