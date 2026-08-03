import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Content Co-op",
    short_name: "Content Co-op",
    description:
      "Minimal disruption, maximum signal. Houston-based industrial video production for energy, manufacturing, construction, safety, and field operations teams.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    background_color: "#f3ede2",
    theme_color: "#0b1928",
    icons: [
      {
        src: "/pwa/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
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
        purpose: "any",
      },
      {
        src: "/pwa/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/pwa/icon-1204.png",
        sizes: "1204x1204",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-1204.png",
        sizes: "1204x1204",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Portfolio",
        short_name: "Work",
        description: "Open selected Content Co-op video production work.",
        url: "/portfolio",
        icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Creative Brief",
        short_name: "Brief",
        description: "Start a Content Co-op production brief.",
        url: "/brief",
        icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Book a Call",
        short_name: "Book",
        description: "Book a Content Co-op discovery call.",
        url: "/book",
        icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }],
      },
    ],
    screenshots: [
      {
        src: "/cc/photos/social-industrial-video-production-v2.jpg",
        sizes: "1200x630",
        type: "image/jpeg",
        label: "Content Co-op field production crew",
        form_factor: "wide",
      },
      {
        src: "/pwa/screenshot-field-production.jpg",
        sizes: "1200x1440",
        type: "image/jpeg",
        label: "Content Co-op field crew filming on location",
        form_factor: "narrow",
      },
    ],
    categories: ["business", "productivity", "photo", "video"],
  };
}
