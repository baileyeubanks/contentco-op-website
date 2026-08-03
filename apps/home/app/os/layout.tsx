import type { Metadata } from "next";
import { headers } from "next/headers";
import { resolveOsBrand } from "@/lib/os-brand";
import { OsShell } from "@/app/os/components/os-shell";
import "@contentco-op/ui/src/atlantis/tokens.css";
import "@xyflow/react/dist/style.css";

export const metadata: Metadata = {
  title: "CCO OS",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function OsAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerStore = await headers();
  const brand = resolveOsBrand(headerStore.get("host"), headerStore.get("x-os-brand"));
  const lightOs = brand.key === "cc";

  return (
    <div
      data-surface={lightOs ? "os" : "product"}
      data-os-brand={brand.key}
      className={brand.brandClassName}
      style={
        {
          minHeight: "100vh",
          background: "var(--bg)",
          color: "var(--ink)",
          fontFamily: lightOs
            ? 'var(--font-os), Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
            : "var(--font-body)",
          "--os-accent": brand.accent,
          "--os-accent-soft": brand.accentSoft,
        } as React.CSSProperties
      }
    >
      <OsShell brandKey={brand.key}>{children}</OsShell>
    </div>
  );
}
