import { getRootRuntimeSnapshot } from "@/lib/root-system";

export default async function RootSystemPage() {
  const snapshot = await getRootRuntimeSnapshot();

  return (
    <div style={{ padding: 32, maxWidth: 1240, margin: "0 auto" }}>
      <div style={{ display: "grid", gap: 22 }}>
        <header>
          <div
            style={{
              fontSize: "0.68rem",
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginBottom: 8,
            }}
          >
            System Truth
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-body), sans-serif",
              fontSize: "2.3rem",
              letterSpacing: "-0.05em",
            }}
          >
            Runtime, sync, and coordination.
          </h1>
        </header>

        {snapshot.warnings.length > 0 && (
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              border: "1px solid rgba(228,173,91,0.24)",
              background: "rgba(228,173,91,0.08)",
              color: "#e4ad5b",
              fontSize: "0.88rem",
            }}
          >
            {snapshot.warnings.join(" · ")}
          </div>
        )}

        <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 16 }}>
          {[
            ["Host", snapshot.runtime.host],
            ["Default BU", snapshot.runtime.default_business_unit],
            ["Auth", snapshot.runtime.auth_mode],
            ["App Version", snapshot.runtime.app_version],
          ].map(([label, value]) => (
            <div key={label} style={card}>
              <div style={labelStyle}>{label}</div>
              <div style={valueStyle}>{value}</div>
            </div>
          ))}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 16 }}>
          <div style={card}>
            <div style={sectionTitle}>Runtime Model</div>
            <ul style={listStyle}>
              <li>M2: {snapshot.runtime.machine_roles.m2}</li>
              <li>M4: {snapshot.runtime.machine_roles.m4}</li>
              <li>NAS: {snapshot.runtime.machine_roles.nas}</li>
              <li>Primary: {snapshot.runtime.models.primary}</li>
              <li>Research: {snapshot.runtime.models.research}</li>
              <li>Fallback: {snapshot.runtime.models.fallback}</li>
            </ul>
          </div>
          <div style={card}>
            <div style={sectionTitle}>Core Channels</div>
            <ul style={listStyle}>
              {snapshot.runtime.channels.map((channel) => (
                <li key={channel}>{channel}</li>
              ))}
            </ul>
          </div>
          <div style={card}>
            <div style={sectionTitle}>Disabled Channels</div>
            <ul style={listStyle}>
              {snapshot.runtime.disabled_channels.map((channel) => (
                <li key={channel}>{channel}</li>
              ))}
            </ul>
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={card}>
            <div style={sectionTitle}>Active Work Claims</div>
            <div style={{ display: "grid", gap: 10 }}>
              {snapshot.work_claims.length === 0 ? (
                <div style={emptyStyle}>No active work claims.</div>
              ) : (
                snapshot.work_claims.filter(Boolean).map((claim) => (
                  <div key={String(claim?.id)} style={rowStyle}>
                    <div style={{ fontWeight: 700 }}>{String(claim.title || claim.task_key || "Untitled task")}</div>
                    <div style={metaStyle}>
                      {String(claim.owner || "unassigned")} · {String(claim.machine || "unknown")}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div style={card}>
            <div style={sectionTitle}>Latest Handoffs</div>
            <div style={{ display: "grid", gap: 10 }}>
              {snapshot.handoffs.length === 0 ? (
                <div style={emptyStyle}>No handoffs logged yet.</div>
              ) : (
                snapshot.handoffs.filter(Boolean).map((handoff) => (
                  <div key={String(handoff?.id)} style={rowStyle}>
                    <div style={{ fontWeight: 700 }}>{String(handoff.title || "Handoff")}</div>
                    <div style={metaStyle}>
                      {String(handoff.owner || "unknown")} · {new Date(String(handoff.created_at)).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section style={card}>
          <div style={sectionTitle}>Document Artifacts</div>
          <div style={{ display: "grid", gap: 10 }}>
            {snapshot.document_artifacts.length === 0 ? (
              <div style={emptyStyle}>No document artifacts logged yet.</div>
            ) : (
              snapshot.document_artifacts.filter(Boolean).map((artifact) => (
                <div key={String(artifact?.id)} style={rowStyle}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.2fr 1fr 1fr 1fr",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>
                      {String(artifact.document_type || "document")} · {String(artifact.business_unit || "UNKNOWN")}
                    </div>
                    <div style={metaStyle}>render: {String(artifact.render_status || "unknown")}</div>
                    <div style={metaStyle}>outcome: {String(artifact.outcome_status || "pending")}</div>
                    <div style={metaStyle}>{new Date(String(artifact.created_at)).toLocaleString()}</div>
                  </div>
                  <div style={{ ...metaStyle, marginTop: 6 }}>
                    version: {String(artifact.version_label || "unlabeled")} · source:{" "}
                    {String(artifact.source_document_id || "none")} · path: {String(artifact.storage_path || "none")}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  padding: "18px 20px",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.68rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: "var(--muted)",
  marginBottom: 8,
};

const valueStyle: React.CSSProperties = {
  fontFamily: "var(--font-body), sans-serif",
  fontSize: "1.34rem",
  letterSpacing: "-0.04em",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "0.76rem",
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--muted)",
  marginBottom: 12,
};

const listStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  display: "grid",
  gap: 8,
  color: "var(--ink)",
};

const rowStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.06)",
};

const metaStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: "0.76rem",
  marginTop: 4,
};

const emptyStyle: React.CSSProperties = {
  color: "var(--muted)",
  opacity: 0.8,
  fontSize: "0.88rem",
};
