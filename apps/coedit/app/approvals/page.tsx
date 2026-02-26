export default function ApprovalsPage() {
  return (
    <main className="shell" style={{ paddingTop: "1rem" }}>
      <section className="panel">
        <div className="kicker">Approvals</div>
        <h1 style={{ fontSize: "3rem" }}>Role-gated decisions</h1>
        <p className="muted">Immutable approval log for Safety, Brand, Legal, and Executive roles.</p>
        <div className="table" style={{ marginTop: ".85rem" }}>
          <div className="row"><span>Gate</span><span>Role</span><span>Status</span><span>Updated</span></div>
          <div className="row"><span>BPMS150 v12</span><span>Safety</span><span>Open</span><span>14:04</span></div>
          <div className="row"><span>BPMS150 v12</span><span>Brand</span><span>Needs change</span><span>14:09</span></div>
          <div className="row"><span>BPMS150 v12</span><span>Executive</span><span>Approved</span><span>14:12</span></div>
        </div>
      </section>
    </main>
  );
}
