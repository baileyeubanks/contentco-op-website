"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";
import type {
  RootScenarioLabSnapshot,
  ScenarioDefinition,
  ScenarioStageStatus,
  WorkflowStageRecord,
} from "@/lib/root-scenario-lab";
import styles from "./lab.module.css";

type RootScenarioLabProps = {
  initialSnapshot: RootScenarioLabSnapshot;
};

function formatAge(minutes: number | null | undefined) {
  if (minutes == null) return "Unknown";
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function toneLabel(status: ScenarioStageStatus | "active") {
  if (status === "blocked") return "critical";
  if (status === "attention") return "attention";
  if (status === "active") return "active";
  return "healthy";
}

function healthTone(status: RootScenarioLabSnapshot["runtime"]["health"]["status"]) {
  if (status === "critical") return "critical";
  if (status === "degraded") return "attention";
  return "healthy";
}

function applyStagePatches(
  workflow: WorkflowStageRecord[],
  scenario: ScenarioDefinition,
  stepIndex: number,
) {
  const map = new Map(workflow.map((stage) => [stage.id, { ...stage }]));

  if (stepIndex < 0) {
    return Array.from(map.values());
  }

  for (const step of scenario.steps.slice(0, stepIndex + 1)) {
    for (const patch of step.patchStages || []) {
      const current = map.get(patch.id);
      if (!current) continue;
      map.set(patch.id, {
        ...current,
        status: patch.status,
        summary: patch.note || current.summary,
      });
    }
  }

  return Array.from(map.values());
}

function scenarioProgressLabel(stepIndex: number, scenario: ScenarioDefinition) {
  if (stepIndex < 0) return "Ready";
  if (stepIndex >= scenario.steps.length - 1) return "Complete";
  return `Step ${stepIndex + 1} / ${scenario.steps.length}`;
}

export function RootScenarioLab({ initialSnapshot }: RootScenarioLabProps) {
  const [selectedScenarioId, setSelectedScenarioId] = useState(
    initialSnapshot.scenarios[0]?.id || "",
  );
  const [running, setRunning] = useState(false);
  const [runAll, setRunAll] = useState(false);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(-1);

  const activeScenario = useMemo(() => {
    if (runAll) {
      return initialSnapshot.scenarios[scenarioIndex] || initialSnapshot.scenarios[0];
    }
    return (
      initialSnapshot.scenarios.find((scenario) => scenario.id === selectedScenarioId) ||
      initialSnapshot.scenarios[0]
    );
  }, [initialSnapshot.scenarios, runAll, scenarioIndex, selectedScenarioId]);

  const stageView = useMemo(
    () => applyStagePatches(initialSnapshot.workflow, activeScenario, stepIndex),
    [activeScenario, initialSnapshot.workflow, stepIndex],
  );

  const currentStep = stepIndex >= 0 ? activeScenario.steps[stepIndex] : null;
  const visitedNodeIds = new Set(
    activeScenario.steps
      .slice(0, Math.max(0, stepIndex + 1))
      .flatMap((step) => step.focusNodeIds),
  );
  const activeNodeIds = new Set(currentStep?.focusNodeIds || []);
  const activeEdgeIds = new Set(currentStep?.focusEdgeIds || []);
  const activeFileIds = new Set(currentStep?.fileIds || []);

  useEffect(() => {
    if (!running) return;

    if (stepIndex >= activeScenario.steps.length - 1) {
      if (runAll && scenarioIndex < initialSnapshot.scenarios.length - 1) {
        const timeout = window.setTimeout(() => {
          setScenarioIndex((value) => value + 1);
          setStepIndex(-1);
        }, 950);
        return () => window.clearTimeout(timeout);
      }

      const timeout = window.setTimeout(() => {
        setRunning(false);
        setRunAll(false);
      }, 950);
      return () => window.clearTimeout(timeout);
    }

    const duration = currentStep?.durationMs || activeScenario.steps[stepIndex + 1]?.durationMs || 1200;
    const timeout = window.setTimeout(() => {
      setStepIndex((value) => value + 1);
    }, duration);
    return () => window.clearTimeout(timeout);
  }, [
    activeScenario,
    currentStep,
    initialSnapshot.scenarios.length,
    runAll,
    running,
    scenarioIndex,
    stepIndex,
  ]);

  function selectScenario(id: string) {
    startTransition(() => {
      setSelectedScenarioId(id);
      setRunAll(false);
      setScenarioIndex(0);
      setRunning(false);
      setStepIndex(-1);
    });
  }

  function runScenario() {
    setRunAll(false);
    setRunning(true);
    setStepIndex(0);
  }

  function pauseScenario() {
    setRunning(false);
  }

  function resetScenario() {
    setRunning(false);
    setRunAll(false);
    setScenarioIndex(0);
    setStepIndex(-1);
  }

  function stepScenario() {
    setRunning(false);
    setStepIndex((value) => Math.min(value + 1, activeScenario.steps.length - 1));
  }

  function runAllScenarios() {
    setRunAll(true);
    setScenarioIndex(0);
    setSelectedScenarioId(initialSnapshot.scenarios[0]?.id || "");
    setStepIndex(0);
    setRunning(true);
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.heroTop}>
            <div className={styles.titleWrap}>
              <div className={styles.eyebrow}>
                <span className={styles.dot} />
                Operator Digital Twin
              </div>
              <h1 className={styles.title}>Scenario lab for the system at home.</h1>
              <p className={styles.subtitle}>
                This is a first-pass digital twin: a visual simulation harness grounded in your actual
                workflow report, runtime snapshot, topology, and project files. It does not replace
                staging or production. It makes the system legible.
              </p>
            </div>

            <div className={styles.heroMeta}>
              <div className={styles.pill} data-tone={healthTone(initialSnapshot.runtime.health.status)}>
                Health {initialSnapshot.runtime.health.status}
              </div>
              <div className={styles.pill} data-tone="neutral">
                {initialSnapshot.coverage.totalScenarios} scenarios
              </div>
              <div className={styles.pill} data-tone="neutral">
                {initialSnapshot.coverage.coveredStages.length}/{initialSnapshot.workflow.length} workflow stages covered
              </div>
              <div className={styles.pill} data-tone="neutral">
                Generated {new Date(initialSnapshot.generatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </div>
            </div>
          </div>

          <div className={styles.gridTwo}>
            <div className={styles.card}>
              <div className={styles.label}>Why this exists</div>
              <div className={styles.detail}>
                You asked for a place where tests feel alive and the architecture can be watched instead
                of inferred. In practice this is called a <strong>digital twin</strong>, and the right
                version here is an operator-facing scenario lab.
              </div>
              <div className={styles.miniList}>
                <div className={styles.miniRow}>
                  <span>Appropriate?</span>
                  <strong>Yes, as a complement to tests and health checks.</strong>
                </div>
                <div className={styles.miniRow}>
                  <span>Exhaustive?</span>
                  <strong>No. It should grow coverage over time.</strong>
                </div>
                <div className={styles.miniRow}>
                  <span>Self-improving?</span>
                  <strong>Heuristic today, learnable later.</strong>
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.label}>System at home</div>
              <div className={styles.machineGrid}>
                <div className={styles.machineCard}>
                  <div className={styles.machineLabel}>M2</div>
                  <div className={styles.machineValue}>{initialSnapshot.runtime.runtime.machine_roles.m2}</div>
                </div>
                <div className={styles.machineCard}>
                  <div className={styles.machineLabel}>M4</div>
                  <div className={styles.machineValue}>{initialSnapshot.runtime.runtime.machine_roles.m4}</div>
                </div>
                <div className={styles.machineCard}>
                  <div className={styles.machineLabel}>NAS</div>
                  <div className={styles.machineValue}>{initialSnapshot.runtime.runtime.machine_roles.nas}</div>
                </div>
              </div>
              <div className={styles.detail}>
                Runtime host: {initialSnapshot.runtime.runtime.host} · Node {initialSnapshot.runtime.machine.node_version} ·
                {` `}deployment {initialSnapshot.runtime.deployment.runtime_kind}
              </div>
            </div>
          </div>
        </section>

        <section className={styles.gridMain}>
          <div className={styles.stack}>
            <div className={styles.card}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2 className={styles.sectionTitle}>Topology</h2>
                  <div className={styles.sectionMeta}>
                    Public funnel, APIs, data plane, control plane, and ops loop.
                  </div>
                </div>
                <div className={styles.flowLegend}>
                  <span className={styles.legendPill} data-tone="active">active</span>
                  <span className={styles.legendPill} data-tone="visited">visited</span>
                  <span className={styles.legendPill} data-tone="idle">idle</span>
                </div>
              </div>

              <div className={styles.topologyGrid}>
                {["public", "api", "data", "control", "ops"].map((lane) => (
                  <div key={lane} className={styles.topologyLane}>
                    <div className={styles.laneLabel}>{lane}</div>
                    <div className={styles.nodeList}>
                      {initialSnapshot.topology.nodes
                        .filter((node) => node.lane === lane)
                        .map((node) => {
                          const state = activeNodeIds.has(node.id)
                            ? "active"
                            : visitedNodeIds.has(node.id)
                              ? "visited"
                              : "idle";
                          return (
                            <div key={node.id} className={styles.nodeCard} data-state={state}>
                              <div className={styles.nodeTitle}>{node.label}</div>
                              <div className={styles.nodeDesc}>{node.description}</div>
                              <div className={styles.nodePath}>{node.repo} · {node.path}</div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.edgeWrap}>
                {initialSnapshot.topology.edges.map((edge) => (
                  <div
                    key={edge.id}
                    className={styles.edgePill}
                    data-active={activeEdgeIds.has(edge.id) ? "true" : "false"}
                  >
                    <span>{initialSnapshot.topology.nodes.find((node) => node.id === edge.from)?.label}</span>
                    <span className={styles.edgeArrow}>→</span>
                    <span>{initialSnapshot.topology.nodes.find((node) => node.id === edge.to)?.label}</span>
                    <span className={styles.edgeTag}>{edge.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2 className={styles.sectionTitle}>Workflow impact</h2>
                  <div className={styles.sectionMeta}>
                    Watch the operator stages mutate as the selected scenario plays.
                  </div>
                </div>
              </div>
              <div className={styles.workflowGrid}>
                {stageView.map((stage) => (
                  <div key={stage.id} className={styles.workflowCard} data-tone={toneLabel(stage.status)}>
                    <div className={styles.workflowTop}>
                      <div>
                        <div className={styles.workflowLabel}>{stage.label}</div>
                        <div className={styles.workflowOwner}>{stage.owner}</div>
                      </div>
                      <span className={styles.workflowStatus}>{stage.status}</span>
                    </div>
                    <div className={styles.workflowSummary}>{stage.summary}</div>
                    <div className={styles.workflowMeta}>
                      <span>{stage.evidenceCount} evidence points</span>
                      <span>{stage.nextAction}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.stack}>
            <div className={styles.card}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2 className={styles.sectionTitle}>Scenario runner</h2>
                  <div className={styles.sectionMeta}>
                    Run one path or cycle the whole mutation set.
                  </div>
                </div>
                <div className={styles.progressPill}>{scenarioProgressLabel(stepIndex, activeScenario)}</div>
              </div>

              <div className={styles.scenarioList}>
                {initialSnapshot.scenarios.map((scenario) => (
                  <button
                    key={scenario.id}
                    type="button"
                    className={styles.scenarioButton}
                    data-active={scenario.id === activeScenario.id && !runAll ? "true" : "false"}
                    onClick={() => selectScenario(scenario.id)}
                  >
                    <span className={styles.scenarioName}>{scenario.label}</span>
                    <span className={styles.scenarioMeta}>
                      {scenario.category.replaceAll("_", " ")} · {scenario.tone}
                    </span>
                  </button>
                ))}
              </div>

              <div className={styles.selectedScenario}>
                <div className={styles.selectedTitle}>{activeScenario.label}</div>
                <div className={styles.detail}>{activeScenario.description}</div>
                <div className={styles.goalBox}>
                  <strong>Goal</strong>
                  <span>{activeScenario.goal}</span>
                </div>
                <div className={styles.controlRow}>
                  <button type="button" className={styles.actionButton} onClick={runScenario}>
                    Run scenario
                  </button>
                  <button type="button" className={styles.actionButtonMuted} onClick={stepScenario}>
                    Step
                  </button>
                  <button type="button" className={styles.actionButtonMuted} onClick={pauseScenario}>
                    Pause
                  </button>
                  <button type="button" className={styles.actionButtonMuted} onClick={resetScenario}>
                    Reset
                  </button>
                  <button type="button" className={styles.actionButtonGhost} onClick={runAllScenarios}>
                    Run all
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2 className={styles.sectionTitle}>Timeline</h2>
                  <div className={styles.sectionMeta}>
                    Each step highlights the architecture, files, and stage changes.
                  </div>
                </div>
              </div>

              <div className={styles.timeline}>
                {activeScenario.steps.map((step, index) => {
                  const state =
                    index === stepIndex ? "active" : index < stepIndex ? "done" : "idle";
                  return (
                    <div key={step.id} className={styles.timelineStep} data-state={state}>
                      <div className={styles.timelineIndex}>{index + 1}</div>
                      <div className={styles.timelineBody}>
                        <div className={styles.timelineTitle}>{step.label}</div>
                        <div className={styles.timelineDetail}>{step.detail}</div>
                        {step.patchStages && step.patchStages.length > 0 && (
                          <div className={styles.timelineTags}>
                            {step.patchStages.map((patch) => (
                              <span key={`${step.id}-${patch.id}`} className={styles.timelineTag} data-tone={toneLabel(patch.status)}>
                                {patch.id} → {patch.status}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2 className={styles.sectionTitle}>Touchpoints</h2>
                  <div className={styles.sectionMeta}>
                    Files and artifacts touched by the current step.
                  </div>
                </div>
              </div>
              <div className={styles.touchpointList}>
                {initialSnapshot.touchpoints.map((touchpoint) => (
                  <div
                    key={touchpoint.id}
                    className={styles.touchpointCard}
                    data-active={activeFileIds.has(touchpoint.id) ? "true" : "false"}
                  >
                    <div className={styles.touchpointTop}>
                      <div className={styles.touchpointTitle}>{touchpoint.label}</div>
                      <div className={styles.touchpointAge}>{formatAge(touchpoint.modifiedAgeMinutes)}</div>
                    </div>
                    <div className={styles.touchpointRole}>{touchpoint.role}</div>
                    <div className={styles.touchpointPath}>{touchpoint.path}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className={styles.gridTwo}>
          <div className={styles.card}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Coverage and growth</h2>
                <div className={styles.sectionMeta}>
                  This twin is not exhaustive yet. It should grow by adding scenario mutations over time.
                </div>
              </div>
            </div>
            <div className={styles.coverageWrap}>
              <div className={styles.coverageBlock}>
                <div className={styles.label}>Covered stages</div>
                <div className={styles.inlineList}>
                  {initialSnapshot.coverage.coveredStages.map((stageId) => (
                    <span key={stageId} className={styles.coverageChip}>
                      {stageId}
                    </span>
                  ))}
                </div>
              </div>
              <div className={styles.coverageBlock}>
                <div className={styles.label}>Uncovered stages</div>
                <div className={styles.inlineList}>
                  {initialSnapshot.coverage.uncoveredStages.length > 0 ? (
                    initialSnapshot.coverage.uncoveredStages.map((stageId) => (
                      <span key={stageId} className={styles.coverageChip} data-tone="attention">
                        {stageId}
                      </span>
                    ))
                  ) : (
                    <span className={styles.coverageChip} data-tone="healthy">
                      none
                    </span>
                  )}
                </div>
              </div>
              <div className={styles.coverageBlock}>
                <div className={styles.label}>Mutation backlog</div>
                <div className={styles.backlogList}>
                  {initialSnapshot.coverage.mutationBacklog.map((item) => (
                    <div key={item} className={styles.backlogItem}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Ground truth links</h2>
                <div className={styles.sectionMeta}>
                  The twin is only useful if it stays tied to real artifacts.
                </div>
              </div>
            </div>
            <div className={styles.linkList}>
              <Link className={styles.linkCard} href="/root/system">
                <span className={styles.linkLabel}>Live system page</span>
                <span className={styles.linkMeta}>Runtime, sync, and coordination</span>
              </Link>
              <Link className={styles.linkCard} href="/root/overview">
                <span className={styles.linkLabel}>ROOT overview</span>
                <span className={styles.linkMeta}>Shared operator workspace</span>
              </Link>
              <Link className={styles.linkCard} href="/root/lab/fsm">
                <span className={styles.linkLabel}>FSM control room</span>
                <span className={styles.linkMeta}>Live certification ledger and runnable scenarios</span>
              </Link>
              <div className={styles.linkCard} data-static="true">
                <span className={styles.linkLabel}>Workflow artifact</span>
                <span className={styles.linkMeta}>
                  {initialSnapshot.workflow[0]?.artifact?.markdownPath || "ops/reports/cco-workflow-latest.md"}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
