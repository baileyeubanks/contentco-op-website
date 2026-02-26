import Image from "next/image";
import Link from "next/link";

const comments = [
  { id: "c1", at: "00:13", text: "Open with logo two frames earlier. Keep safety vest visible.", state: "Open" },
  { id: "c2", at: "00:44", text: "Lower-third naming needs approved product language.", state: "Needs change" },
  { id: "c3", at: "01:02", text: "Narrative pacing reads clean for stakeholder review.", state: "Ready" }
];

export default async function AssetDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <main className="shell" style={{ paddingTop: "1rem" }}>
      <section className="grid">
        <article className="panel">
          <div className="kicker">Asset / {id}</div>
          <h1 style={{ fontSize: "3.2rem" }}>Timecoded review stage</h1>
          <p className="muted">Center-stage playback with timeline-linked comment thread and approval context.</p>
          <figure className="player">
            <Image src="/media/sample-asset.jpg" alt="Asset preview" width={1280} height={720} priority />
          </figure>
          <div style={{ marginTop: ".65rem", display: "flex", gap: ".45rem", flexWrap: "wrap" }}>
            <Link className="button" href={`/asset/${id}/compare`}>
              Compare versions
            </Link>
            <button className="button" type="button">
              Upload new version
            </button>
          </div>
          <div className="thread">
            {comments.map((c) => (
              <article className="thread-item" key={c.id}>
                <span className="badge">{c.at}</span>
                <span>{c.text}</span>
                <span className="badge">{c.state}</span>
              </article>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="kicker">Audit</div>
          <h2 style={{ margin: ".2rem 0 .5rem", fontSize: "2rem" }}>Decision trail</h2>
          <div className="thread">
            <div className="thread-item"><span className="badge">Event</span><span>Version v12 uploaded</span><span className="badge">14:02</span></div>
            <div className="thread-item"><span className="badge">Event</span><span>Safety gate set to open</span><span className="badge">14:04</span></div>
            <div className="thread-item"><span className="badge">Event</span><span>Executive pre-approval added</span><span className="badge">14:12</span></div>
          </div>
          <div style={{ marginTop: ".7rem", display: "grid", gap: ".45rem" }}>
            <button className="button" type="button">Approve (Safety)</button>
            <button className="button" type="button">Needs changes (Brand)</button>
            <button className="button" type="button">Approve (Executive)</button>
          </div>
        </article>
      </section>
    </main>
  );
}
