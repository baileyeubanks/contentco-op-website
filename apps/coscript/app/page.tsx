import Image from "next/image";
import Link from "next/link";

const tags = ["Hook: problem first", "Middle: proof", "CTA: specific next step"];
const variants = [
  {
    title: "Variant A / Direct",
    text: "Operator-first script with clear action language and explicit accountability."
  },
  {
    title: "Variant B / Executive",
    text: "Leadership framing aligned to risk, priorities, and decision path."
  },
  {
    title: "Variant C / Human",
    text: "Trust-first plain language with practical next-step direction."
  }
];

export default function CoScriptStudio() {
  return (
    <main className="shell">
      <header className="nav">
        <div className="brand">Content Co-op</div>
        <nav className="nav-links">
          <a href="https://contentco-op.com">Home</a>
          <a href="https://coedit.contentco-op.com">Co-Edit</a>
          <a className="active" href="#">Co-Script</a>
        </nav>
        <div>
          <Link className="button primary" href="/watchlists">Watchlists</Link>
        </div>
      </header>

      <section className="grid">
        <article className="panel">
          <div className="kicker">Source context</div>
          <h1>Signal-driven scripts for real operators.</h1>
          <p className="muted">
            Watchlist and outlier intelligence becomes structured briefs, variants, and fix loops.
          </p>
          <figure style={{ margin: ".8rem 0 0", borderRadius: 12, overflow: "hidden", border: "1px solid #35547f" }}>
            <Image src="/media/source-context.jpg" alt="Selected source outlier" width={960} height={540} />
          </figure>
          <div className="pill-row">
            {tags.map((tag) => (
              <span key={tag} className="pill">
                {tag}
              </span>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="kicker">Structured brief</div>
          <div className="form-grid" style={{ marginTop: ".4rem" }}>
            <input className="field" defaultValue="Script type: Operational" readOnly />
            <input className="field" defaultValue="Audience: Field operators" readOnly />
            <input className="field" defaultValue="Objective: Drive behavior" readOnly />
            <input className="field" defaultValue="Constraints: Legal, compliant" readOnly />
          </div>
          <textarea className="textarea" style={{ marginTop: ".5rem" }} defaultValue="Key points: Situation -> Why it matters -> What changes -> Expected action" readOnly />
          <div style={{ marginTop: ".65rem", display: "flex", gap: ".45rem", flexWrap: "wrap" }}>
            <button className="button primary" type="button">Generate variants</button>
            <button className="button" type="button">Run fix loop</button>
          </div>
          <div className="variant-list">
            {variants.map((variant) => (
              <article className="variant-item" key={variant.title}>
                <strong>{variant.title}</strong>
                <p style={{ margin: ".2rem 0 0", color: "#a7bade" }}>{variant.text}</p>
              </article>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}

