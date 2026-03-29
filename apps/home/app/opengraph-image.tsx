import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Content Co-op — We make the work visible.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0b1928",
          position: "relative",
        }}
      >
        {/* Accent bar */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: "15%",
            bottom: "15%",
            width: "4px",
            background: "linear-gradient(180deg, #1e4d8c, #b3c8f0, transparent)",
          }}
        />

        {/* Pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
              color: "#1e4d8c",
              background: "rgba(30,77,140,0.15)",
              padding: "8px 20px",
              borderRadius: "999px",
            }}
          >
            Content Co-op
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            fontSize: "64px",
            fontWeight: 700,
            color: "#f0ebe0",
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            marginBottom: "24px",
            maxWidth: "800px",
          }}
        >
          We make the work{" "}
          <span style={{ color: "#b3c8f0", fontStyle: "italic" }}>visible.</span>
        </div>

        {/* Sub */}
        <div
          style={{
            fontSize: "22px",
            color: "#8a8578",
            lineHeight: 1.6,
            maxWidth: "600px",
          }}
        >
          Industrial stories that hold up under scrutiny. Energy, construction, and manufacturing — captured at the source.
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: "absolute",
            bottom: "60px",
            left: "80px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "#485670",
              letterSpacing: "-0.01em",
            }}
          >
            contentco-op.com
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
