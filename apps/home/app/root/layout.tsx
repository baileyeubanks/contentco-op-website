import { headers } from "next/headers";
import { resolveRootBrand } from "@/lib/root-brand";

export default async function RootAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerStore = await headers();
  const brand = resolveRootBrand(headerStore.get("host"), headerStore.get("x-root-brand"));

  return (
    <div
      data-surface="product"
      data-root-brand={brand.key}
      className={brand.brandClassName}
      style={
        {
          minHeight: "100vh",
          background: "var(--bg)",
          color: "var(--ink)",
          fontFamily: "var(--font-body)",
          "--root-accent": brand.accent,
          "--root-accent-soft": brand.accentSoft,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
