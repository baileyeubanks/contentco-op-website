import { getRootGoals, getRootAgents } from "@/lib/root-goals";
import { GoalsClient } from "./goals-client";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function RootGoalsPage() {
  const [goals, agents] = await Promise.all([getRootGoals({ limit: 100 }), getRootAgents({ limit: 24 })]);

  return (
    <main className={styles.page}>
      <GoalsClient initialGoals={goals} initialAgents={agents} />
    </main>
  );
}
