export default async function ScriptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <main className="shell" style={{ paddingTop: "1rem" }}>
      <section className="panel">
        <div className="kicker">Script / {id}</div>
        <h1 style={{ fontSize: "3rem" }}>Revision history</h1>
        <p className="muted">Full A/B/C variants and fix-loop revisions. No overwrite behavior.</p>
        <div className="variant-list">
          <article className="variant-item">
            <strong>Revision 3</strong>
            <p style={{ margin: ".2rem 0 0", color: "#a7bade" }}>
              Added explicit safety checkpoint after process proof segment.
            </p>
          </article>
          <article className="variant-item">
            <strong>Revision 2</strong>
            <p style={{ margin: ".2rem 0 0", color: "#a7bade" }}>
              Tightened hook and improved audience-action clarity.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}

