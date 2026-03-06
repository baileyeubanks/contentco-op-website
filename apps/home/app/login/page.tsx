import { Nav } from "@contentco-op/ui";

export default function LoginPage() {
  return (
    <main className="page">
      <Nav surface="home" />
      <div className="shell" style={{ padding: "2rem 0" }}>
        <section className="card" style={{ maxWidth: 920 }}>
          <h1 style={{ marginTop: 0 }}>Portal Login</h1>
          <p>
            Invite-only access for reviewers, approvers, and script operators. Select the product surface for sign-in.
          </p>
          <div style={{ display: "grid", gap: ".8rem", gridTemplateColumns: "1fr 1fr 1fr", marginTop: ".9rem" }}>
            <a className="card" href="https://coedit.contentco-op.com/login" style={{ display: "block", textDecoration: "none" }}>
              <h2 style={{ marginTop: 0 }}>Co-Edit</h2>
              <p style={{ marginBottom: 0 }}>
                Browser-based video editor with layers, timeline, media bin, and AI assist.
              </p>
            </a>
            <a className="card" href="https://coscript.contentco-op.com/login" style={{ display: "block", textDecoration: "none" }}>
              <h2 style={{ marginTop: 0 }}>Co-Script</h2>
              <p style={{ marginBottom: 0 }}>
                Watchlists, outliers, structured briefs, variant generation, and fix loop history.
              </p>
            </a>
            <a className="card" href="https://codeliver.contentco-op.com" style={{ display: "block", textDecoration: "none" }}>
              <h2 style={{ marginTop: 0 }}>Co-Deliver</h2>
              <p style={{ marginBottom: 0 }}>
                Timecoded review, version control, and stakeholder sign-off for deliverables.
              </p>
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
