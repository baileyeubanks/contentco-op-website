import { getRootAgents, getRootGoals } from "@/lib/root-goals";
import { AgentsClient } from "./agents-client";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function RootAgentsPage() {
  const [agents, goals] = await Promise.all([getRootAgents({ limit: 48 }), getRootGoals({ limit: 100 })]);

  return (
    <main className={styles.page}>
      <AgentsClient initialAgents={agents} goalSummary={goals.summary} />
    </main>
  );
}
