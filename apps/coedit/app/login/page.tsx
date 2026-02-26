export default function LoginPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#0c1322", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" }}>
      <section style={{ maxWidth: 440, width: "100%", border: "1px solid #2b4263", borderRadius: 18, background: "linear-gradient(160deg, #101b2e, #0d1828)", padding: "2rem 1.6rem" }}>
        <div style={{ fontSize: ".72rem", letterSpacing: ".18em", textTransform: "uppercase", color: "#6b9fd4", fontWeight: 700 }}>Co-Edit</div>
        <h1 style={{ margin: ".3rem 0 .4rem", fontSize: "1.8rem", color: "#edf3ff", letterSpacing: "-.02em" }}>Sign in</h1>
        <p style={{ margin: "0 0 1.2rem", color: "#7a9bc4", fontSize: ".88rem", lineHeight: 1.5 }}>
          AI-enhanced editing. Analyze raw interview clips and extract sound bites.
        </p>
        <form method="post" action="/api/auth/login" style={{ display: "grid", gap: ".65rem" }}>
          <input name="email" type="email" required placeholder="Work email" style={{ border: "1px solid #325276", borderRadius: 10, background: "#0d1a2e", color: "#e9f0ff", padding: ".65rem .75rem", fontSize: ".88rem", fontFamily: "inherit", outline: "none" }} />
          <input name="password" type="password" required placeholder="Password" style={{ border: "1px solid #325276", borderRadius: 10, background: "#0d1a2e", color: "#e9f0ff", padding: ".65rem .75rem", fontSize: ".88rem", fontFamily: "inherit", outline: "none" }} />
          <input name="invite_code" type="password" required placeholder="Invite code" style={{ border: "1px solid #325276", borderRadius: 10, background: "#0d1a2e", color: "#e9f0ff", padding: ".65rem .75rem", fontSize: ".88rem", fontFamily: "inherit", outline: "none" }} />
          <button type="submit" style={{ marginTop: ".3rem", width: "fit-content", background: "#6b9fd4", color: "#0c1322", border: "none", borderRadius: 999, padding: ".65rem 1.6rem", fontSize: ".78rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit" }}>
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
