export default function BriefPage() {
  return (
    <main className="page">
      <div className="shell" style={{ padding: "2rem 0" }}>
        <section className="card" style={{ maxWidth: 920 }}>
          <h1 style={{ marginTop: 0 }}>Energy Brief Wizard</h1>
          <p>Capture strategic intent before script generation. This feeds Co-Script briefs and Co-Edit project setup.</p>
          <form style={{ display: "grid", gap: ".8rem", marginTop: ".8rem" }}>
            <label>
              Script type
              <select style={{ width: "100%", marginTop: ".35rem", padding: ".62rem", borderRadius: 10, border: "1px solid #c9d5ca" }}>
                <option>Executive Thought Piece</option>
                <option>Safety Update</option>
                <option>Operational Change</option>
                <option>Culture Reinforcement</option>
              </select>
            </label>
            <label>
              Audience
              <select style={{ width: "100%", marginTop: ".35rem", padding: ".62rem", borderRadius: 10, border: "1px solid #c9d5ca" }}>
                <option>Field Operators</option>
                <option>Plant Leadership</option>
                <option>Corporate</option>
                <option>Public</option>
              </select>
            </label>
            <label>
              Primary objective
              <select style={{ width: "100%", marginTop: ".35rem", padding: ".62rem", borderRadius: 10, border: "1px solid #c9d5ca" }}>
                <option>Drive behavior change</option>
                <option>Inform</option>
                <option>Align</option>
                <option>Reassure</option>
              </select>
            </label>
            <label>
              Key points
              <textarea
                rows={6}
                placeholder="- Situation&#10;- Why it matters&#10;- What changes&#10;- Expected action"
                style={{ width: "100%", marginTop: ".35rem", padding: ".62rem", borderRadius: 10, border: "1px solid #c9d5ca" }}
              />
            </label>
            <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap" }}>
              <a className="button" href="https://coscript.contentco-op.com">Open Co-Script</a>
              <a className="button light" href="https://coedit.contentco-op.com">Open Co-Edit</a>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
