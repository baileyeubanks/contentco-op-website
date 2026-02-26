export default function ProjectsPage() {
  return (
    <main className="shell" style={{ paddingTop: "1rem" }}>
      <section className="panel">
        <div className="kicker">Projects</div>
        <h1 style={{ fontSize: "3rem" }}>Project registry</h1>
        <p className="muted">Every project with linked assets, review status, and approval readiness.</p>
        <div className="table" style={{ marginTop: ".85rem" }}>
          <div className="row"><span>Project</span><span>Owner</span><span>Status</span><span>Action</span></div>
          <div className="row"><span>HLSR Safety Refresh</span><span>Creative</span><span>In review</span><span>Open</span></div>
          <div className="row"><span>Automation Explainer Q2</span><span>Account</span><span>Pre-production</span><span>Open</span></div>
          <div className="row"><span>Executive Site Recap</span><span>Ops</span><span>Ready</span><span>Open</span></div>
        </div>
      </section>
    </main>
  );
}
