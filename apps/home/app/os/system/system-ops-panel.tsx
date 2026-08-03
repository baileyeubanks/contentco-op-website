"use client";

import { useState, useTransition } from "react";

type SystemAction = "env" | "status" | "health" | "audit" | "ensure-running" | "restart" | "logs";
type SystemScope = "home" | "acs" | "root";

type ActionResult = {
  ok?: boolean;
  error?: string;
  action?: string;
  scope?: string;
  stdout?: string;
  stderr?: string;
  report_path?: string | null;
};

const ACTION_LABELS: Record<SystemAction, string> = {
  env: "env verify",
  status: "runtime status",
  health: "health",
  audit: "audit",
  "ensure-running": "ensure runtime",
  restart: "restart runtime",
  logs: "tail logs",
};

export function SystemOpsPanel({
  workspace,
}: {
  workspace: "cc" | "acs";
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [selectedScope, setSelectedScope] = useState<SystemScope>(workspace === "acs" ? "acs" : "home");
  const [isPending, startTransition] = useTransition();

  const scopeOptions: { value: SystemScope; label: string }[] = workspace === "acs"
    ? [
      { value: "acs", label: "acs runtime" },
      { value: "root", label: "root contracts" },
    ]
    : [
      { value: "home", label: "cco home" },
      { value: "root", label: "root contracts" },
    ];

  function runAction(action: SystemAction) {
    startTransition(async () => {
      setResult({
        action,
        scope: selectedScope,
        stdout: "",
        stderr: "",
      });
      try {
        const response = await fetch("/api/root/system/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, scope: selectedScope }),
        });
        const payload = await response.json().catch(() => ({}));
        setResult(payload);
      } catch (error) {
        setResult({
          error: error instanceof Error ? error.message : "request_failed",
          action,
          scope: selectedScope,
        });
      }
    });
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ color: "var(--root-muted, var(--muted))", fontSize: "0.8rem" }}>
          Run platform checks and supervised runtime actions from inside ROOT. These actions are advanced-admin only and leave an audit trail.
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.78rem", color: "var(--root-muted, var(--muted))" }}>
          scope
          <select
            value={selectedScope}
            onChange={(event) => setSelectedScope(event.target.value as SystemScope)}
            style={{
              background: "rgba(14,23,20,0.8)",
              color: "var(--root-text, var(--foreground))",
              border: "1px solid rgba(62,201,131,0.18)",
              borderRadius: 10,
              padding: "8px 10px",
            }}
          >
            {scopeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {(Object.keys(ACTION_LABELS) as SystemAction[]).map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => runAction(action)}
            disabled={isPending}
            style={{
              borderRadius: 999,
              border: "1px solid rgba(62,201,131,0.2)",
              background: action === "restart" ? "rgba(228,173,91,0.12)" : "rgba(62,201,131,0.08)",
              color: action === "restart" ? "#e4ad5b" : "var(--root-text, var(--foreground))",
              padding: "10px 14px",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: isPending ? "progress" : "pointer",
            }}
          >
            {isPending && result?.action === action ? `running ${ACTION_LABELS[action]}...` : ACTION_LABELS[action]}
          </button>
        ))}
      </div>

      {result && (
        <div
          style={{
            borderRadius: 12,
            border: `1px solid ${result.error ? "rgba(228,173,91,0.24)" : "rgba(62,201,131,0.18)"}`,
            background: result.error ? "rgba(228,173,91,0.08)" : "rgba(62,201,131,0.06)",
            padding: "14px 16px",
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 700 }}>
              {result.action ? ACTION_LABELS[result.action as SystemAction] : "system action"}
            </div>
            <div style={{ fontSize: "0.76rem", color: "var(--root-muted, var(--muted))" }}>
              scope {result.scope || selectedScope}
            </div>
          </div>
          <div style={{ fontSize: "0.8rem", color: result.error ? "#e4ad5b" : "var(--root-muted, var(--muted))" }}>
            {result.error ? result.error : "completed"}
          </div>
          {result.report_path && (
            <div style={{ fontSize: "0.74rem", color: "var(--root-muted, var(--muted))" }}>
              wrote {result.report_path}
            </div>
          )}
          {(result.stdout || result.stderr) && (
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontSize: "0.72rem",
                lineHeight: 1.45,
                color: "var(--root-text, var(--foreground))",
                background: "rgba(5,12,10,0.72)",
                borderRadius: 10,
                padding: "12px 14px",
                overflowX: "auto",
              }}
            >
              {result.stdout || result.stderr}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
