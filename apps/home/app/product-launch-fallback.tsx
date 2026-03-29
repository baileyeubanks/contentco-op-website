import Link from "next/link";
import { CCO_URLS, Nav } from "@contentco-op/ui";
import type { ProductLaunchDefinition, ProductLaunchProbe } from "@/lib/product-launch";

import styles from "./product-launch.module.css";

type ProductLaunchFallbackProps = {
  product: ProductLaunchDefinition;
  probe: ProductLaunchProbe;
};

export function ProductLaunchFallback({ product, probe }: ProductLaunchFallbackProps) {
  return (
    <main className={styles.page}>
      <Nav surface={product.surface} />

      <div className={styles.shell}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>Platform launch route</p>
          <div className={styles.heroGrid}>
            <div>
              <h1 className={styles.headline}>{product.headline}</h1>
              <p className={styles.label}>{product.name} · {product.label}</p>
              <p className={styles.copy}>{product.description}</p>

              <div className={styles.actions}>
                <a className={styles.primaryAction} href={product.externalUrl}>
                  Try app host
                </a>
                <Link className={styles.secondaryAction} href={CCO_URLS.brief}>
                  Send creative brief
                </Link>
                <a
                  className={styles.secondaryAction}
                  href={CCO_URLS.booking}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Book strategy call
                </a>
              </div>
            </div>

            <aside className={styles.statusCard} aria-label={`${product.name} launch status`}>
              <span className={styles.statusPill}>{product.statusLabel}</span>
              <p className={styles.statusDetail}>
                {probe.statusDetail}. The platform shell is holding the entry point here until the dedicated workspace responds normally again.
              </p>

              <div className={styles.metaList}>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Canonical host</span>
                  <span className={styles.metaValue}>{product.externalUrl}</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Status</span>
                  <span className={styles.metaValue}>{probe.statusCode ? `HTTP ${probe.statusCode}` : "No response"}</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Stable entry path</span>
                  <span className={styles.metaValue}>{product.slug}</span>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className={styles.section}>
          <article className={styles.card}>
            <h2 className={styles.cardTitle}>What this workspace is for</h2>
            <ul className={styles.list}>
              {product.highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          <article className={styles.card}>
            <h2 className={styles.cardTitle}>Best next move</h2>
            <p className={styles.support}>{product.supportCopy}</p>
          </article>
        </section>
      </div>
    </main>
  );
}
