import { headers } from "next/headers";
import { buildRootWorkspaceSnapshot } from "@/lib/root-workspace";
import { RootWorkspaceConsoleClient } from "./workspace-console-client";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function RootWorkspacePage() {
  const headerStore = await headers();
  const snapshot = await buildRootWorkspaceSnapshot({
    host: headerStore.get("host"),
    brandHint: headerStore.get("x-root-brand"),
  });

  return (
    <main className={styles.page}>
      <RootWorkspaceConsoleClient initialSnapshot={snapshot} />
    </main>
  );
}
