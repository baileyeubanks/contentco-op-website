import { getFsmScenarioControlRoomSnapshot } from "@/lib/fsm-scenario-control-room";
import { FsmControlRoom } from "./room";

export const dynamic = "force-dynamic";

export default async function RootFsmLabPage() {
  const snapshot = await getFsmScenarioControlRoomSnapshot();
  return <FsmControlRoom initialSnapshot={snapshot} />;
}
