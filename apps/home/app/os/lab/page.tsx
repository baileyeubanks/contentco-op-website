import { getRootScenarioLabSnapshot } from "@/lib/os-scenario-lab";
import { RootScenarioLab } from "./scenario-lab";

export default async function RootLabPage() {
  const snapshot = await getRootScenarioLabSnapshot();
  return <RootScenarioLab initialSnapshot={snapshot} />;
}
