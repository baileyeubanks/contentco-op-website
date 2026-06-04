import { buildSystemMapSnapshot } from "@/lib/system-map";
import { SystemMapClient } from "./system-map-client";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function RootSystemMapPage() {
  const snapshot = await buildSystemMapSnapshot();

  return (
    <main className={styles.page}>
      <SystemMapClient initialSnapshot={snapshot} />
    </main>
  );
}
