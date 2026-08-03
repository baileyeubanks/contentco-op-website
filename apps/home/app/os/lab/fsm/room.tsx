"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { FsmScenarioControlRoomSnapshot } from "@/lib/fsm-scenario-control-room";
import styles from "./room.module.css";

type Props = {
  initialSnapshot: FsmScenarioControlRoomSnapshot;
  readOnly?: boolean;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function formatTime(value: string | null | undefined) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toneForClassification(classification: string) {
  if (classification === "fail") return "critical";
  if (classification === "blocked-by-env") return "attention";
  if (classification === "pass") return "healthy";
  return "neutral";
}

function toneForMode(mode: string) {
  if (mode === "implemented") return "healthy";
  if (mode === "blocked") return "attention";
  return "neutral";
}

export function FsmControlRoom({ initialSnapshot, readOnly = false }: Props) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [selectedScenarioId, setSelectedScenarioId] = useState(
    initialSnapshot.scenarios[0]?.id ?? "",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installState, setInstallState] = useState<"checking" | "ready" | "installed" | "unsupported">(
    "checking",
  );
  const [isPending, startTransition] = useTransition();

  const activeScenario = useMemo(
    () =>
      snapshot.scenarios.find((scenario) => scenario.id === selectedScenarioId) ??
      snapshot.scenarios[0] ??
      null,
    [selectedScenarioId, snapshot.scenarios],
  );

  useEffect(() => {
    let mounted = true;

    async function setupPwa() {
      if (typeof window === "undefined") return;

      const standalone =
        window.matchMedia?.("(display-mode: standalone)").matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (standalone) {
        if (mounted) setInstallState("installed");
      }

      if ("serviceWorker" in navigator) {
        try {
          await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        } catch {
          // Keep install state honest but non-fatal; app should still work as a normal page.
        }
      }

      const onBeforeInstallPrompt = (event: Event) => {
        event.preventDefault();
        if (!mounted) return;
        setInstallPrompt(event as BeforeInstallPromptEvent);
        setInstallState("ready");
      };

      const onInstalled = () => {
        if (!mounted) return;
        setInstallPrompt(null);
        setInstallState("installed");
      };

      window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.addEventListener("appinstalled", onInstalled);

      if (!standalone && mounted) {
        setInstallState("unsupported");
      }

      return () => {
        window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
        window.removeEventListener("appinstalled", onInstalled);
      };
    }

    let cleanup: (() => void) | undefined;
    setupPwa().then((fn) => {
      cleanup = fn;
    });

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, []);

  async function refresh() {
    const response = await fetch("/api/root/lab/fsm", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`refresh failed (${response.status})`);
    }
    const payload = (await response.json()) as FsmScenarioControlRoomSnapshot;
    setSnapshot(payload);
  }

  function runScenario(scenarioId: string) {
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/root/lab/fsm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenarioId }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || `run failed (${response.status})`);
        }
        setSnapshot(payload.snapshot as FsmScenarioControlRoomSnapshot);
        setMessage(`Scenario ${scenarioId} finished. Canonical ledger refreshed.`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Scenario run failed.");
      }
    });
  }

  function installApp() {
    if (!installPrompt) {
      setMessage(
        "Install is not ready yet. In Chrome, you can still use the browser menu and choose Install app.",
      );
      return;
    }

    startTransition(async () => {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      setInstallState(choice.outcome === "accepted" ? "installed" : "unsupported");
      setMessage(
        choice.outcome === "accepted"
          ? "FSM Control Room installed. Updates will keep tracking the live lab."
          : "Install dismissed. You can retry from Chrome whenever you want.",
      );
    });
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <div className={styles.eyebrow}>FSM Control Room</div>
            <h1 className={styles.title}>Watch the scenario-certified system move.</h1>
          <p className={styles.copy}>
              This page turns the scenario work into an operator-visible app surface. It shows
              what is implemented, what is still blocked, what the latest runs proved, and lets you
              {readOnly
                ? "inspect the live scenario ledger without needing an operator session."
                : "trigger the safe implemented flows without dropping back to the terminal."}
          </p>
        </div>
          <div className={styles.heroStats}>
            <div className={styles.statCard}>
              <span>Total</span>
              <strong>{snapshot.summary.total}</strong>
            </div>
            <div className={styles.statCard}>
              <span>Implemented</span>
              <strong>{snapshot.summary.implemented}</strong>
            </div>
            <div className={styles.statCard}>
              <span>Recent passes</span>
              <strong>{snapshot.summary.recentPasses}</strong>
            </div>
            <div className={styles.statCard}>
              <span>Recent blocked</span>
              <strong>{snapshot.summary.recentBlocked}</strong>
            </div>
          </div>
          <div className={styles.installRow}>
            <div className={styles.installCard}>
              <div className={styles.installLabel}>Install this as a Chrome app</div>
              <div className={styles.installCopy}>
                Pin the control room like a desktop app so we can update it live while you watch test runs land.
              </div>
            </div>
            <div className={styles.installActions}>
              <button
                type="button"
                className={styles.installButton}
                onClick={installApp}
                disabled={isPending || installState === "installed"}
              >
                {installState === "installed"
                  ? "Installed"
                  : installState === "ready"
                    ? "Install App"
                    : "Install via Chrome"}
              </button>
              <a className={styles.secondaryAction} href="/root/lab/fsm">
                Open operator surface
              </a>
            </div>
          </div>
        </section>

        <section className={styles.metrics}>
          <div className={styles.metricPanel}>
            <div className={styles.metricLabel}>Scenario runs (recent)</div>
            <div className={styles.metricValue}>{snapshot.recentSignals.recentScenarioRuns}</div>
          </div>
          <div className={styles.metricPanel}>
            <div className={styles.metricLabel}>Mobile replay rows (24h)</div>
            <div className={styles.metricValue}>
              {snapshot.recentSignals.recentMobileActions ?? "Unavailable"}
            </div>
          </div>
          <div className={styles.metricPanel}>
            <div className={styles.metricLabel}>Proof rows (24h)</div>
            <div className={styles.metricValue}>{snapshot.recentSignals.recentProofs ?? "Unavailable"}</div>
          </div>
          <div className={styles.metricPanel}>
            <div className={styles.metricLabel}>Last runner report</div>
            <div className={styles.metricValue}>{formatTime(snapshot.summary.lastReportGeneratedAt)}</div>
          </div>
        </section>

        {readOnly ? (
          <div className={styles.banner}>
            Read-only preview. The runnable operator surface lives at <code>/root/lab/fsm</code>.
          </div>
        ) : null}
        {message ? <div className={styles.banner}>{message}</div> : null}

        <section className={styles.grid}>
          <div className={styles.column}>
            <div className={styles.card}>
              <div className={styles.sectionTop}>
                <div>
                  <h2 className={styles.sectionTitle}>Scenario pack</h2>
                  <div className={styles.sectionMeta}>
                    Implemented scenarios can be run from here. Blocked ones stay visible with their honest reason.
                  </div>
                </div>
                {!readOnly ? (
                  <button
                    type="button"
                    className={styles.refreshButton}
                    onClick={() => startTransition(refresh)}
                    disabled={isPending}
                  >
                    Refresh
                  </button>
                ) : null}
              </div>

              <div className={styles.scenarioList}>
                {snapshot.scenarios.map((scenario) => (
                  <button
                    key={scenario.id}
                    type="button"
                    className={styles.scenarioButton}
                    data-active={scenario.id === activeScenario?.id ? "true" : "false"}
                    onClick={() => setSelectedScenarioId(scenario.id)}
                  >
                    <div className={styles.scenarioTop}>
                      <span className={styles.scenarioName}>{scenario.id}</span>
                      <span className={styles.pill} data-tone={toneForMode(scenario.mode)}>
                        {scenario.mode}
                      </span>
                    </div>
                    <div className={styles.scenarioMeta}>
                      {scenario.category.replaceAll("_", " ")} · {scenario.trade} · {scenario.businessUnit ?? "n/a"}
                    </div>
                    <div className={styles.scenarioTrigger}>{scenario.trigger}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.column}>
            <div className={styles.card}>
              {activeScenario ? (
                <>
                  <div className={styles.sectionTop}>
                    <div>
                      <h2 className={styles.sectionTitle}>Live scenario detail</h2>
                      <div className={styles.sectionMeta}>Root scenario {activeScenario.rootScenarioId ?? "unmapped"}</div>
                    </div>
                    {!readOnly ? (
                      <button
                        type="button"
                        className={styles.runButton}
                        onClick={() => runScenario(activeScenario.id)}
                        disabled={isPending || activeScenario.mode !== "implemented"}
                      >
                        {isPending ? "Running..." : "Run live scenario"}
                      </button>
                    ) : null}
                  </div>

                  <div className={styles.detailGrid}>
                    <div>
                      <div className={styles.detailLabel}>Mode</div>
                      <div className={styles.detailValue}>{activeScenario.mode}</div>
                    </div>
                    <div>
                      <div className={styles.detailLabel}>Business unit</div>
                      <div className={styles.detailValue}>{activeScenario.businessUnit ?? "n/a"}</div>
                    </div>
                    <div>
                      <div className={styles.detailLabel}>Artifacts</div>
                      <div className={styles.detailValue}>{activeScenario.requiredArtifacts.length}</div>
                    </div>
                    <div>
                      <div className={styles.detailLabel}>Audit rows</div>
                      <div className={styles.detailValue}>{activeScenario.requiredAuditRows.length}</div>
                    </div>
                  </div>

                  {activeScenario.mode !== "implemented" && activeScenario.blockedReason ? (
                    <div className={styles.blockedReason}>{activeScenario.blockedReason}</div>
                  ) : null}

                  <div className={styles.subsection}>
                    <div className={styles.subsectionTitle}>Latest canonical run</div>
                    {activeScenario.lastRun ? (
                      <div className={styles.runCard}>
                        <div className={styles.runTop}>
                          <span className={styles.pill} data-tone={toneForClassification(activeScenario.lastRun.classification)}>
                            {activeScenario.lastRun.classification}
                          </span>
                          <span className={styles.runTime}>{formatTime(activeScenario.lastRun.startedAt)}</span>
                        </div>
                        <div className={styles.runMeta}>
                          execution {activeScenario.lastRun.executionMode} · completed {formatTime(activeScenario.lastRun.completedAt)}
                        </div>
                        <div className={styles.summaryGrid}>
                          {Object.entries(activeScenario.lastRun.summary).map(([key, value]) => (
                            <div key={key} className={styles.summaryItem}>
                              <span>{key}</span>
                              <strong>{String(value)}</strong>
                            </div>
                          ))}
                        </div>
                        {activeScenario.lastRun.notes.length > 0 ? (
                          <div className={styles.noteList}>
                            {activeScenario.lastRun.notes.map((note) => (
                              <div key={note} className={styles.noteItem}>{note}</div>
                            ))}
                          </div>
                        ) : null}
                        <div className={styles.artifactList}>
                          {activeScenario.lastRun.artifacts.map((artifact) => (
                            <div key={`${artifact.type}-${artifact.key}`} className={styles.artifactRow}>
                              <div>
                                <div className={styles.artifactKey}>{artifact.key}</div>
                                <div className={styles.artifactType}>{artifact.type}</div>
                              </div>
                              <div className={styles.artifactStatus} data-tone={toneForClassification(artifact.status === "materialized" ? "pass" : artifact.status === "blocked" ? "blocked-by-env" : "fail")}>
                                {artifact.status}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className={styles.emptyState}>No canonical run recorded for this scenario yet.</div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            <div className={styles.card}>
              <div className={styles.sectionTop}>
                <div>
                  <h2 className={styles.sectionTitle}>Recent run ledger</h2>
                  <div className={styles.sectionMeta}>Live rows from `public.scenario_runs`.</div>
                </div>
              </div>
              <div className={styles.runLedger}>
                {snapshot.recentRuns.map((run) => (
                  <div key={run.id} className={styles.ledgerRow}>
                    <div>
                      <div className={styles.ledgerTitle}>{run.scenarioId}</div>
                      <div className={styles.ledgerMeta}>{formatTime(run.startedAt)}</div>
                    </div>
                    <div className={styles.ledgerRight}>
                      <span className={styles.pill} data-tone={toneForClassification(run.classification)}>
                        {run.classification}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
