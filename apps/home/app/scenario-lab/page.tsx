import { getFsmScenarioControlRoomSnapshot } from "@/lib/fsm-scenario-control-room";
import { FsmControlRoom } from "@/app/root/lab/fsm/room";

export const dynamic = "force-dynamic";

export default async function ScenarioLabPreviewPage() {
  const snapshot = await getFsmScenarioControlRoomSnapshot();
  return <FsmControlRoom initialSnapshot={snapshot} readOnly />;
}
