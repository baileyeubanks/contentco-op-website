import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { isAdvancedRootOperatorForHost, resolveRootAuthorityForHost } from "@/lib/root-auth";
import { logRootAuditEvent } from "@/lib/root-event-log";
import { verifyInviteSession } from "@/lib/session";
import { getSessionCookieName } from "@/lib/session-shared";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = "/Users/baileyeubanks/Desktop/Projects";
const REPORT_PATHS: Record<string, string | null> = {
  env: "/Users/baileyeubanks/Desktop/Projects/platform/ENV_REPORT.md",
  status: "/Users/baileyeubanks/Desktop/Projects/platform/STATUS_REPORT.md",
  health: "/Users/baileyeubanks/Desktop/Projects/platform/HEALTH_REPORT.md",
  audit: "/Users/baileyeubanks/Desktop/Projects/platform/AUDIT_REPORT.md",
  "ensure-running": "/Users/baileyeubanks/Desktop/Projects/platform/STATUS_REPORT.md",
  restart: "/Users/baileyeubanks/Desktop/Projects/platform/STATUS_REPORT.md",
  logs: null,
};

type ActionName = "env" | "status" | "health" | "audit" | "ensure-running" | "restart" | "logs";
type ScopeName = "full" | "home" | "acs" | "root";

function isActionName(value: unknown): value is ActionName {
  return value === "env" || value === "status" || value === "health" || value === "audit" || value === "ensure-running" || value === "restart" || value === "logs";
}

function isScopeName(value: unknown): value is ScopeName {
  return value === "full" || value === "home" || value === "acs" || value === "root";
}

function defaultScopeForHost(host: string): ScopeName {
  return resolveRootAuthorityForHost(host) === "acs" ? "acs" : "home";
}

function commandForAction(action: ActionName, scope: ScopeName) {
  if (action === "ensure-running" || action === "restart") {
    return ["scripts/platform_ops.py", action, "--scope", scope];
  }
  if (action === "logs") {
    return ["scripts/platform_ops.py", "logs", "--scope", scope, "--lines", "80"];
  }
  return ["scripts/platform_ops.py", action, "--write"];
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const session = verifyInviteSession(cookieStore.get(getSessionCookieName())?.value);
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || "";

  if (!session || !isAdvancedRootOperatorForHost(session.email, host)) {
    return NextResponse.json({ error: "Advanced root access required" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body?.action;
  const requestedScope = body?.scope;
  const scope = isScopeName(requestedScope) ? requestedScope : defaultScopeForHost(host);

  if (!isActionName(action)) {
    return NextResponse.json({ error: "Unsupported system action" }, { status: 400 });
  }

  const args = commandForAction(action, scope);

  try {
    const result = await execFileAsync("python3", args, {
      cwd: PROJECT_ROOT,
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
    });
    await logRootAuditEvent({
      type: "root_system_action_succeeded",
      host,
      email: session.email,
      text: `ROOT system action ${action} completed`,
      payload: {
        action,
        scope,
        stdout: result.stdout.slice(-4000),
      },
    });
    return NextResponse.json({
      ok: true,
      action,
      scope,
      stdout: result.stdout.slice(-4000),
      stderr: result.stderr.slice(-4000),
      report_path: REPORT_PATHS[action],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const stdout = typeof error === "object" && error && "stdout" in error ? String((error as { stdout?: unknown }).stdout || "") : "";
    const stderr = typeof error === "object" && error && "stderr" in error ? String((error as { stderr?: unknown }).stderr || "") : "";
    await logRootAuditEvent({
      type: "root_system_action_failed",
      host,
      email: session.email,
      text: `ROOT system action ${action} failed`,
      payload: {
        action,
        scope,
        error: message,
        stdout: stdout.slice(-4000),
        stderr: stderr.slice(-4000),
      },
    });
    return NextResponse.json({
      error: message,
      action,
      scope,
      stdout: stdout.slice(-4000),
      stderr: stderr.slice(-4000),
      report_path: REPORT_PATHS[action],
    }, { status: 500 });
  }
}
