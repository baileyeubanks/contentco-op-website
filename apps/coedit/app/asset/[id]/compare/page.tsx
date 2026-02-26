import Image from "next/image";
import Link from "next/link";

export default async function ComparePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <main className="shell" style={{ paddingTop: "1rem" }}>
      <section className="panel">
        <div className="kicker">Version Compare / {id}</div>
        <h1 style={{ fontSize: "3rem" }}>Version diff</h1>
        <p className="muted">Side-by-side review between current and prior cut with synchronized timeline.</p>
        <div style={{ marginTop: ".9rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".7rem" }}>
          <figure className="player" style={{ margin: 0 }}>
            <Image src="/media/sample-asset-prev.jpg" alt="Previous version" width={960} height={540} />
          </figure>
          <figure className="player" style={{ margin: 0 }}>
            <Image src="/media/sample-asset.jpg" alt="Current version" width={960} height={540} />
          </figure>
        </div>
        <div style={{ marginTop: ".75rem", display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
          <Link className="button" href={`/asset/${id}`}>Back to stage</Link>
          <button className="button" type="button">Promote current as approval version</button>
        </div>
      </section>
    </main>
  );
}
