import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import {
  createRoutePolicy,
  enforceRoutePolicy,
  recordAuditEvent,
} from "@/lib/platform-access";
import { getFsmScenarioControlRoomSnapshot } from "@/lib/fsm-scenario-control-room";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = "/Users/baileyeubanks/Desktop/Projects";

function buildRunArgs(scenarioId: string) {
  return [
    "/Users/baileyeubanks/Desktop/Projects/tests/fsm_scenario_runner.py",
    "run",
    "--scenario",
    scenarioId,
    "--write-report",
  ];
}

async function requireAccess() {
  return enforceRoutePolicy(
    createRoutePolicy({
      id: "root.lab.fsm.control",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["system_config"],
      tenantBoundary: "internal_workspace",
    }),
  );
}

export async function GET() {
  const access = await requireAccess();
  if (!access.ok) return access.response;
  return NextResponse.json(await getFsmScenarioControlRoomSnapshot());
}

export async function POST(request: Request) {
  const access = await requireAccess();
  if (!access.ok) return access.response;

  const body = await request.json().catch(() => ({}));
  const scenarioId = typeof body?.scenarioId === "string" ? body.scenarioId.trim() : "";
  if (!scenarioId) {
    return NextResponse.json({ error: "scenarioId is required" }, { status: 400 });
  }

  const snapshot = await getFsmScenarioControlRoomSnapshot();
  const scenario = snapshot.scenarios.find((item) => item.id === scenarioId);
  if (!scenario) {
    return NextResponse.json({ error: "Unknown scenario" }, { status: 404 });
  }
  if (scenario.mode !== "implemented") {
    return NextResponse.json(
      { error: "Only implemented scenarios may be run from the control room." },
      { status: 400 },
    );
  }

  try {
    const result = await execFileAsync("python3", buildRunArgs(scenarioId), {
      cwd: PROJECT_ROOT,
      timeout: 15 * 60 * 1000,
      maxBuffer: 1024 * 1024,
    });

    await recordAuditEvent({
      actor: access.actor,
      type: "root_fsm_scenario_run_succeeded",
      targetType: "scenario_run",
      targetId: scenarioId,
      permission: "system_config",
      sourceSurface: "root_lab_fsm",
      riskLevel: "medium",
      summary: `FSM scenario ${scenarioId} executed from control room`,
      metadata: {
        scenario_id: scenarioId,
        stdout_tail: result.stdout.slice(-4000),
      },
    });

    return NextResponse.json({
      ok: true,
      scenarioId,
      stdout: result.stdout.slice(-4000),
      stderr: result.stderr.slice(-4000),
      snapshot: await getFsmScenarioControlRoomSnapshot(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const stdout =
      typeof error === "object" && error && "stdout" in error
        ? String((error as { stdout?: unknown }).stdout || "")
        : "";
    const stderr =
      typeof error === "object" && error && "stderr" in error
        ? String((error as { stderr?: unknown }).stderr || "")
        : "";

    await recordAuditEvent({
      actor: access.actor,
      type: "root_fsm_scenario_run_failed",
      targetType: "scenario_run",
      targetId: scenarioId,
      permission: "system_config",
      sourceSurface: "root_lab_fsm",
      riskLevel: "high",
      summary: `FSM scenario ${scenarioId} failed from control room`,
      metadata: {
        scenario_id: scenarioId,
        error: message,
        stdout_tail: stdout.slice(-4000),
        stderr_tail: stderr.slice(-4000),
      },
    });

    return NextResponse.json(
      {
        error: message,
        scenarioId,
        stdout: stdout.slice(-4000),
        stderr: stderr.slice(-4000),
        snapshot: await getFsmScenarioControlRoomSnapshot(),
      },
      { status: 500 },
    );
  }
}
