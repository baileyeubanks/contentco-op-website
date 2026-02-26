import Link from "next/link";

const rows = [
  { id: "bpms150-cutdown-v12", asset: "BPMS150_Cutdown_v12", owner: "Creative", state: "In review", updated: "14m ago" },
  { id: "accuratemeter-v4", asset: "AccurateMeter_v4", owner: "Client", state: "Needs changes", updated: "47m ago" },
  { id: "titlepromo-v3", asset: "TitlePromo_v3", owner: "Executive", state: "Ready", updated: "2h ago" }
];

export default function CoEditHome() {
  return (
    <main className="shell">
      <header className="nav">
        <div className="brand">Content Co-op</div>
        <nav className="nav-links">
          <a href="https://contentco-op.com">Home</a>
          <a className="active" href="#">Co-Edit</a>
          <a href="https://coscript.contentco-op.com">Co-Script</a>
        </nav>
        <div>
          <Link className="button" href="/approvals">Approvals</Link>
        </div>
      </header>

      <section className="grid">
        <article className="panel">
          <div className="kicker">Queue Overview</div>
          <h1>Review and approval, designed for pressure.</h1>
          <p className="muted">Version compare, timecoded comments, and role-based approval gates in one lane.</p>
          <div className="table">
            <div className="row"><span>Asset</span><span>Owner</span><span>Status</span><span>Action</span></div>
            {rows.map((r) => (
              <div className="row" key={r.asset}>
                <span>
                  <strong>{r.asset}</strong>
                  <br />
                  <small style={{ color: "#91a8ca" }}>{r.updated}</small>
                </span>
                <span>{r.owner}</span>
                <span>{r.state}</span>
                <span>
                  <Link className="badge-link" href={`/asset/${r.id}`}>
                    Open
                  </Link>
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="kicker">Approvals</div>
          <h2 style={{ margin: ".2rem 0 .5rem", fontSize: "2rem" }}>Current gates</h2>
          <div className="thread">
            <div className="thread-item"><span className="badge">Safety</span><span>Awaiting sign-off</span><span className="badge">Open</span></div>
            <div className="thread-item"><span className="badge">Brand</span><span>Needs lower-third update</span><span className="badge">Open</span></div>
            <div className="thread-item"><span className="badge">Exec</span><span>Approved</span><span className="badge">Done</span></div>
          </div>
          <div style={{ marginTop: ".8rem", display: "flex", gap: ".45rem", flexWrap: "wrap" }}>
            <Link className="button" href="/projects">Open projects</Link>
            <Link className="button" href="/asset/bpms150-cutdown-v12/compare">Compare versions</Link>
          </div>
        </article>
      </section>
    </main>
  );
}
