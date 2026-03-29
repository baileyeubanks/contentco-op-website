import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/scenario-lab",
    name: "FSM Control Room",
    short_name: "FSM Lab",
    description:
      "Installable control room for watching live scenario-certified FSM runs, mobile replay signals, and operator-ready workflow truth.",
    start_url: "/scenario-lab",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    background_color: "#0b0d12",
    theme_color: "#d9ff72",
    orientation: "portrait",
    icons: [
      {
        src: "/pwa/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/pwa/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Scenario Lab",
        short_name: "Lab",
        description: "Open the public live scenario control room.",
        url: "/scenario-lab",
        icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Operator Lab",
        short_name: "Operator",
        description: "Open the protected operator surface for running live scenarios.",
        url: "/root/lab/fsm",
        icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }],
      },
    ],
    screenshots: [
      {
        src: "/pwa/screenshot-scenario-lab.png",
        sizes: "1274x674",
        type: "image/png",
        label: "Scenario-certified FSM control room",
        form_factor: "wide",
      },
    ],
    categories: ["business", "productivity", "utilities"],
  };
}
