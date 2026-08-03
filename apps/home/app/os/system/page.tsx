import Link from "next/link";
import { OsEmptyState } from "@/app/os/components/os-empty-state";
import { OsStateCallout } from "@/app/os/components/os-state-callout";
import { OsStatusPill } from "@/app/os/components/os-status-pill";
import { PhoneActionPanel } from "./phone-action-panel";
import { SystemOpsPanel } from "./system-ops-panel";
import { getRootRuntimeSnapshot } from "@/lib/os-system";
import styles from "./system.module.css";

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  return String(value);
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value.map((entry) => asString(entry)).filter(Boolean);
}

function formatDateTime(value: unknown) {
  if (!value) return "not recorded";
  return new Date(asString(value)).toLocaleString();
}

function formatBool(value: unknown) {
  return value === true ? "yes" : value === false ? "no" : "unknown";
}

export default async function RootSystemPage() {
  const snapshot = await getRootRuntimeSnapshot();
  const healthTone = snapshot.health.status === "healthy" ? "healthy" : "attention";
  const publishAuthority = asRecord(snapshot.publish_authority);
  const blazeOperator = snapshot.blaze_operator;
  const phoneCall = asRecord(blazeOperator.phone_call);
  const phoneTestGate = asRecord(phoneCall.test_gate);
  const systemStateHealth = asRecord(blazeOperator.system_state_health);
  const phoneTemplates = asRecord(phoneCall.followup_templates);
  const latestCampaign = asRecord(blazeOperator.latest_phone_test_campaign);
  const recentCampaigns = Array.isArray(blazeOperator.recent_phone_test_campaigns)
    ? blazeOperator.recent_phone_test_campaigns
    : [];
  const latestCampaignEvaluation = asRecord(latestCampaign.evaluation);
  const latestCampaignSummary = asRecord(latestCampaign.summary);
  const latestCampaignMetrics = asRecord(latestCampaignEvaluation.metrics);
  const phoneBusinessUnits = asRecord(phoneTestGate.business_units);
  const ccDefaultTarget = asRecord(asRecord(phoneBusinessUnits.CC).default_target);
  const acsDefaultTarget = asRecord(asRecord(phoneBusinessUnits.ACS).default_target);
  const blockedReasons = asStringArray(phoneCall.blocked_reasons);
  const pendingPhoneActions = Array.isArray(phoneCall.pending_actions)
    ? phoneCall.pending_actions.map(asRecord)
    : [];
  const phoneTemplateKeys = asStringArray(phoneTemplates.template_keys);
  const missingTemplateKeys = asStringArray(phoneTemplates.missing_template_keys);
  const latestCampaignFailures = asStringArray(latestCampaignEvaluation.failures);
  const recentVoiceSessions = Array.isArray(phoneCall.recent_voice_sessions)
    ? phoneCall.recent_voice_sessions.map(asRecord)
    : Array.isArray(blazeOperator.recent_voice_sessions)
      ? blazeOperator.recent_voice_sessions.map(asRecord)
      : [];
  const recentPhoneReceipts = Array.isArray(snapshot.blaze_operator.latest_phone_call_receipts)
    ? snapshot.blaze_operator.latest_phone_call_receipts.map(asRecord)
    : [];
  const phoneTone =
    phoneCall.status === "ok" || phoneCall.status === "preflight_ready"
      ? "healthy"
      : phoneCall.status === "missing"
        ? "attention"
        : "attention";

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroTop}>
          <div>
            <p className={styles.eyebrow}>System truth</p>
            <h1 className={styles.title}>Runtime, sync, and operator coordination.</h1>
            <p className={styles.subtitle}>
              This is the CCO OS machine view: who is holding work, where runtime authority lives,
              and what is still contract-held instead of claimed as truth.
            </p>
          </div>
          <div className={styles.heroActions}>
            <Link href="/os/system/map" className={styles.primaryAction}>
              System map
            </Link>
            <Link href="/os/overview" className={styles.secondaryAction}>
              Overview
            </Link>
            <Link href="/os/work-claims" className={styles.secondaryAction}>
              Work claims
            </Link>
          </div>
        </div>

        <div className={styles.metaRail}>
          <span className={styles.metaPill} data-tone={healthTone}>
            health · {snapshot.health.status}
          </span>
          <span className={styles.metaPill}>host · {snapshot.runtime.host}</span>
          <span className={styles.metaPill}>default BU · {snapshot.runtime.default_business_unit}</span>
          <span className={styles.metaPill}>version · {snapshot.runtime.app_version}</span>
          <span className={styles.metaPill} data-tone={phoneTone}>
            phone lane · {String(phoneCall.status || "missing")}
          </span>
        </div>
      </section>

      {snapshot.warnings.length > 0 ? (
        <OsStateCallout
          tone="attention"
          title={`${snapshot.warnings.length} runtime warning${snapshot.warnings.length === 1 ? "" : "s"}`}
          detail={snapshot.warnings.join(" · ")}
        />
      ) : null}

      <OsStateCallout
        tone={publishAuthority.status === "green" ? "healthy" : "attention"}
        title={`Publish authority · ${String(publishAuthority.status || "red")}`}
        detail={String(
          publishAuthority.recommended_next_action ||
            "Publish alignment must be clean before runtime can be treated as certified.",
        )}
      />

      <section className={styles.metricsGrid}>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Active claims</span>
          <strong className={styles.metricValue}>{snapshot.summary.active_claims}</strong>
        </article>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Recent handoffs</span>
          <strong className={styles.metricValue}>{snapshot.summary.recent_handoffs}</strong>
        </article>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Pending phone actions</span>
          <strong className={styles.metricValue}>{snapshot.summary.pending_phone_actions}</strong>
          <span className={styles.metricHint}>approval-gated preflight and call proposals</span>
        </article>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Recent call receipts</span>
          <strong className={styles.metricValue}>{snapshot.summary.recent_call_receipts}</strong>
          <span className={styles.metricHint}>latest completed or failed phone outcomes</span>
        </article>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Publish authority</span>
          <strong className={styles.metricValue}>{String(snapshot.summary.publish_authority_status || "red")}</strong>
          <span className={styles.metricHint}>
            {String(snapshot.summary.publish_blockers || 0)} blocker{Number(snapshot.summary.publish_blockers || 0) === 1 ? "" : "s"} before runtime cert goes green
          </span>
        </article>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Latest campaign</span>
          <strong className={styles.metricValue}>
            {latestCampaign.run_id ? String(latestCampaignEvaluation.ok ? "pass" : "fail") : "none"}
          </strong>
          <span className={styles.metricHint}>
            {latestCampaign.run_id
              ? `${String(latestCampaignSummary.planned ?? 0)} planned · ${String(latestCampaignSummary.completed ?? 0)} completed`
              : "No campaign artifact has been published yet"}
          </span>
        </article>
      </section>

      <section className={styles.gridTwo}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelKicker}>Publish certification</p>
              <h2 className={styles.panelTitle}>Receipt, route, and alignment proof</h2>
            </div>
          </div>
          <div className={styles.stack}>
            <div className={styles.listCard}>
              <strong>Current authority state</strong>
              <div className={styles.chipRow}>
                <OsStatusPill>{String(publishAuthority.status || "red")}</OsStatusPill>
                {publishAuthority.generated_at ? <OsStatusPill>{formatDateTime(String(publishAuthority.generated_at))}</OsStatusPill> : null}
              </div>
              <span>{String(publishAuthority.summary || "No publish alignment summary available.")}</span>
              <span>{String(publishAuthority.recommended_next_action || "Resolve publish blockers before certifying runtime.")}</span>
            </div>
            {Array.isArray(publishAuthority.checks) && publishAuthority.checks.length > 0 ? (
              publishAuthority.checks
                .filter((check: Record<string, unknown>) => check.status === "fail" || check.status === "warn")
                .slice(0, 6)
                .map((check: Record<string, unknown>) => (
                  <div key={String(check.id || check.label || "publish-check")} className={styles.listCard}>
                    <strong>{String(check.label || "publish check")}</strong>
                    <div className={styles.chipRow}>
                      <OsStatusPill>{String(check.status || "unknown")}</OsStatusPill>
                    </div>
                    <span>{String(check.detail || "No detail recorded.")}</span>
                    {check.recommendedAction ? <span>{String(check.recommendedAction)}</span> : null}
                  </div>
                ))
            ) : (
              <OsEmptyState
                title="No publish blockers"
                detail="Publish alignment did not return any current warnings or failures."
              />
            )}
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelKicker}>Machine topology</p>
              <h2 className={styles.panelTitle}>Roles and deployment edges</h2>
            </div>
          </div>
          <div className={styles.rowList}>
            <div className={styles.row}>
              <strong>Authoring</strong>
              <span>{snapshot.machine.authoring}</span>
            </div>
            <div className={styles.row}>
              <strong>Runtime</strong>
              <span>{snapshot.machine.runtime}</span>
            </div>
            <div className={styles.row}>
              <strong>Public apps</strong>
              <span>{snapshot.machine.public_apps}</span>
            </div>
            <div className={styles.row}>
              <strong>Runtime kind</strong>
              <span>{snapshot.deployment.runtime_kind}</span>
            </div>
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelKicker}>Phone lane</p>
              <h2 className={styles.panelTitle}>Realtime calling readiness</h2>
            </div>
          </div>
          <div className={styles.stack}>
            <div className={styles.chipRow}>
              <OsStatusPill>{String(phoneCall.status || "missing")}</OsStatusPill>
              {phoneCall.lane_state ? <OsStatusPill>{String(phoneCall.lane_state)}</OsStatusPill> : null}
              {phoneCall.preferred_path ? <OsStatusPill>{String(phoneCall.preferred_path)}</OsStatusPill> : null}
              {phoneCall.fallback_path ? <OsStatusPill>{String(phoneCall.fallback_path)}</OsStatusPill> : null}
            </div>
            <div className={styles.rowList}>
              <div className={styles.row}>
                <strong>Desktop ready</strong>
                <span>{formatBool(phoneCall.desktop_ready)}</span>
              </div>
              <div className={styles.row}>
                <strong>Voice ready</strong>
                <span>{formatBool(phoneCall.voice_ready)}</span>
              </div>
              <div className={styles.row}>
                <strong>System state</strong>
                <span>{String(systemStateHealth.status || "missing")}</span>
              </div>
              <div className={styles.row}>
                <strong>Observed</strong>
                <span>{formatDateTime(systemStateHealth.observed_at)}</span>
              </div>
              <div className={styles.row}>
                <strong>Test gate</strong>
                <span>{String(phoneTestGate.status || "off")}</span>
              </div>
              <div className={styles.row}>
                <strong>CC default target</strong>
                <span>
                  {String(
                    ccDefaultTarget.label
                    || ccDefaultTarget.phone_number
                    || "not configured",
                  )}
                </span>
              </div>
              <div className={styles.row}>
                <strong>ACS default target</strong>
                <span>
                  {String(
                    acsDefaultTarget.label
                    || acsDefaultTarget.phone_number
                    || "not configured",
                  )}
                </span>
              </div>
            </div>
            {blockedReasons.length > 0 ? (
              <OsStateCallout
                tone="attention"
                title="Phone lane is still blocked"
                detail={blockedReasons.join(" · ")}
              />
            ) : (
              <OsStateCallout
                tone="healthy"
                title="Phone lane cert is clean"
                detail="Continuity path, fallback path, and current system-state contract are aligned."
              />
            )}
            <PhoneActionPanel
              defaultBusinessUnit={snapshot.runtime.default_business_unit === "ACS" ? "ACS" : "CC"}
              phoneStatus={String(phoneCall.status || "missing")}
              blockedReasons={blockedReasons}
              testGate={(phoneCall.test_gate || {}) as Record<string, unknown>}
            />
          </div>
        </article>
      </section>

      <section className={styles.gridTwo}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelKicker}>Certified lanes</p>
              <h2 className={styles.panelTitle}>Operator runtime contract</h2>
            </div>
          </div>
          <div className={styles.stack}>
            {[
              ["Claude", blazeOperator.claude_runtime],
              ["OpenClaw", blazeOperator.openclaw_runtime],
              ["Workspace", blazeOperator.google_workspace],
              ["Dify", blazeOperator.dify_runtime],
            ].map(([label, lane]) => (
              <div key={String(label)} className={styles.listCard}>
                <strong>{String(label)}</strong>
                <div className={styles.chipRow}>
                  <OsStatusPill>{String((lane as Record<string, unknown>)?.status || "missing")}</OsStatusPill>
                  {label === "Claude" && (lane as Record<string, unknown>)?.critical_mcp_ready === true ? (
                    <OsStatusPill>critical MCP ready</OsStatusPill>
                  ) : null}
                </div>
                {Array.isArray((lane as Record<string, unknown>)?.blocked_reasons) &&
                ((lane as Record<string, unknown>)?.blocked_reasons as unknown[]).length > 0 ? (
                  <span>{String(((lane as Record<string, unknown>)?.blocked_reasons as string[]).join(" · "))}</span>
                ) : (
                  <span>Certified runtime lane is publishing without additional blockers.</span>
                )}
              </div>
            ))}
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelKicker}>Customer service</p>
              <h2 className={styles.panelTitle}>Eval drift and recent phone outcomes</h2>
            </div>
          </div>
          <div className={styles.stack}>
            <div className={styles.listCard}>
              <strong>Website and voice evals</strong>
              <div className={styles.chipRow}>
                <OsStatusPill>{String(blazeOperator.customer_service.evals?.status || "missing")}</OsStatusPill>
                <OsStatusPill>{String(blazeOperator.customer_service.voice_agent_evals?.status || "missing")}</OsStatusPill>
              </div>
              <span>
                text {String(blazeOperator.customer_service.evals?.pass_count ?? 0)}/
                {String(blazeOperator.customer_service.evals?.case_count ?? 0)} · voice{" "}
                {String(blazeOperator.customer_service.voice_agent_evals?.pass_count ?? 0)}/
                {String(blazeOperator.customer_service.voice_agent_evals?.case_count ?? 0)}
              </span>
            </div>
            {pendingPhoneActions.length === 0 ? (
              <OsStateCallout
                tone="healthy"
                title="No pending phone actions"
                detail="There are no approval-gated preflight or outbound call proposals waiting in the queue."
              />
            ) : (
              <div className={styles.stack}>
                {pendingPhoneActions.slice(0, 3).map((action) => (
                  <div key={String(action.action_id || action.id || "action")} className={styles.listCard}>
                    <strong>{String(action.objective || action.action_id || "pending action")}</strong>
                    <div className={styles.listMeta}>
                      <OsStatusPill>{String(action.status || "pending")}</OsStatusPill>
                      <OsStatusPill>{String(action.target_host || "M4")}</OsStatusPill>
                      <OsStatusPill>{String(action.business_unit || "CC")}</OsStatusPill>
                    </div>
                    <span>
                      {String(action.action_type || action.kind || "phone")} ·{" "}
                      {String(action.call_path_preference || phoneCall.preferred_path || "native_continuity_calling")}
                    </span>
                    {action.reason ? <span>{String(action.reason)}</span> : null}
                  </div>
                ))}
              </div>
            )}
            {recentPhoneReceipts.length === 0 ? (
              <OsEmptyState
                title="No recent phone receipts"
                detail="Once Blaze completes or fails a phone action, the latest receipt will surface here."
              />
            ) : (
              recentPhoneReceipts
                .slice(0, 3)
                .filter(Boolean)
                .map((receipt) => (
                <div key={String(receipt.receipt_id || receipt.id || "receipt")} className={styles.listCard}>
                  <strong>{String(receipt.phone_number || receipt.direction || "Phone receipt")}</strong>
                  <div className={styles.listMeta}>
                    <OsStatusPill>{String(receipt.final_outcome || receipt.status || "unknown")}</OsStatusPill>
                    <OsStatusPill>{String(receipt.call_path || "call path missing")}</OsStatusPill>
                    {receipt.business_unit ? <OsStatusPill>{String(receipt.business_unit)}</OsStatusPill> : null}
                  </div>
                  <span>
                    {formatDateTime(String(receipt.started_at || ""))} · approval{" "}
                    {String(receipt.approval_actor || "not recorded")}
                  </span>
                  {receipt.transcript_summary ? <span>{String(receipt.transcript_summary)}</span> : null}
                  {receipt.failure_reason ? <span>{String(receipt.failure_reason)}</span> : null}
                </div>
              ))
            )}
            <div className={styles.sectionLabel}>Recent voice sessions</div>
            {recentVoiceSessions.length === 0 ? (
              <OsEmptyState
                title="No recent voice sessions"
                detail="Voice capture and reasoning sessions will appear here once the realtime lane is exercised."
              />
            ) : (
              recentVoiceSessions.slice(0, 3).map((session) => (
                <div key={String(session.session_id || "voice-session")} className={styles.listCard}>
                  <strong>{String(session.session_id || "Voice session")}</strong>
                  <div className={styles.listMeta}>
                    <OsStatusPill>{String(session.status || "unknown")}</OsStatusPill>
                    {session.mode ? <OsStatusPill>{String(session.mode)}</OsStatusPill> : null}
                    {session.reasoning_provider ? <OsStatusPill>{String(session.reasoning_provider)}</OsStatusPill> : null}
                  </div>
                  <span>
                    STT {String(session.stt_provider || "not recorded")} · TTS{" "}
                    {String(session.tts_provider || "not recorded")} · latency{" "}
                    {session.latency_ms != null ? `${String(session.latency_ms)} ms` : "not recorded"}
                  </span>
                  {session.notes ? <span>{String(session.notes)}</span> : null}
                </div>
              ))
            )}
            <div className={styles.sectionLabel}>Follow-up templates</div>
            <div className={styles.listCard}>
              <strong>Post-call communications</strong>
              <div className={styles.listMeta}>
                <OsStatusPill>{String(phoneTemplates.status || "missing")}</OsStatusPill>
                {phoneTemplates.configured != null ? (
                  <OsStatusPill>{phoneTemplates.configured ? "configured" : "unconfigured"}</OsStatusPill>
                ) : null}
              </div>
              <span>
                {phoneTemplateKeys.length > 0
                  ? phoneTemplateKeys.join(" · ")
                  : "No follow-up templates are published yet."}
              </span>
              {missingTemplateKeys.length > 0 ? (
                <span>missing: {missingTemplateKeys.join(" · ")}</span>
              ) : (
                <span>Missed-call, booked-call, post-call, and escalation follow-up paths are ready.</span>
              )}
              {phoneTemplates.path ? <span>{String(phoneTemplates.path)}</span> : null}
            </div>
            <div className={styles.sectionLabel}>Latest phone test campaign</div>
            {!latestCampaign.run_id ? (
              <OsEmptyState
                title="No phone campaign artifact"
                detail="Run the phone campaign runner and the latest campaign evaluation will publish here."
              />
            ) : (
              <div className={styles.listCard}>
                <strong>{String(latestCampaign.run_id)}</strong>
                <div className={styles.listMeta}>
                  <OsStatusPill>{String(latestCampaignEvaluation.ok ? "pass" : "fail")}</OsStatusPill>
                  {latestCampaign.execute != null ? (
                    <OsStatusPill>{latestCampaign.execute ? "execute" : "plan_only"}</OsStatusPill>
                  ) : null}
                  {latestCampaignEvaluation.mode ? <OsStatusPill>{String(latestCampaignEvaluation.mode)}</OsStatusPill> : null}
                </div>
                <span>
                  planned {String(latestCampaignSummary.planned ?? 0)} · completed {String(latestCampaignSummary.completed ?? 0)} · failed{" "}
                  {String(latestCampaignSummary.failed ?? 0)} · blocked {String(latestCampaignSummary.blocked ?? 0)}
                </span>
                <span>
                  max {String(latestCampaignMetrics.max_duration_ms ?? 0)} ms · avg{" "}
                  {String(latestCampaignMetrics.average_duration_ms ?? 0)} ms
                </span>
                {latestCampaignFailures.length > 0 ? (
                  <div className={styles.failureList}>
                    {latestCampaignFailures.slice(0, 4).map((failure, index: number) => (
                      <span key={`${String(latestCampaign.run_id)}-failure-${index}`}>{String(failure)}</span>
                    ))}
                  </div>
                ) : (
                  <span>Scenario assertions and SLA checks passed.</span>
                )}
                {latestCampaign.generated_at ? <span>{formatDateTime(String(latestCampaign.generated_at))}</span> : null}
              </div>
            )}
            <div className={styles.sectionLabel}>Recent campaign runs</div>
            {recentCampaigns.length === 0 ? (
              <OsEmptyState
                title="No recent campaign history"
                detail="The latest five phone test campaign artifacts will surface here once the runner has been used."
              />
            ) : (
              recentCampaigns.slice(0, 4).map((campaign: Record<string, unknown>) => {
                const evaluation = (campaign.evaluation || {}) as Record<string, unknown>;
                const summary = (campaign.summary || {}) as Record<string, unknown>;
                return (
                  <div key={String(campaign.run_id || "campaign")} className={styles.listCard}>
                    <strong>{String(campaign.run_id || "Campaign")}</strong>
                    <div className={styles.listMeta}>
                      <OsStatusPill>{String(evaluation.ok ? "pass" : "fail")}</OsStatusPill>
                      {campaign.execute != null ? <OsStatusPill>{campaign.execute ? "execute" : "plan_only"}</OsStatusPill> : null}
                    </div>
                    <span>
                      planned {String(summary.planned ?? 0)} · completed {String(summary.completed ?? 0)} · pending{" "}
                      {String(summary.pending_approval ?? 0)}
                    </span>
                    {campaign.generated_at ? <span>{formatDateTime(String(campaign.generated_at))}</span> : null}
                  </div>
                );
              })
            )}
          </div>
        </article>
      </section>

      <section className={styles.gridTwo}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelKicker}>Artifact contract</p>
              <h2 className={styles.panelTitle}>Shared authority status</h2>
            </div>
          </div>
          <OsStateCallout
            tone={snapshot.artifact_advisory.checked_at ? "stale" : "withheld"}
            title={`${snapshot.artifact_advisory.status} · ${snapshot.artifact_advisory.reason}`}
            detail={`${snapshot.artifact_advisory.detail} Checked: ${
              snapshot.artifact_advisory.checked_at
                ? new Date(String(snapshot.artifact_advisory.checked_at)).toLocaleString()
                : "contract-held"
            }`}
          />
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelKicker}>Claims</p>
              <h2 className={styles.panelTitle}>Active work ownership</h2>
            </div>
          </div>
          <div className={styles.stack}>
            {snapshot.work_claims.length === 0 ? (
              <OsEmptyState
                title="No active work claims"
                detail="Nothing is explicitly claimed in the operator ledger right now."
              />
            ) : (
              snapshot.work_claims.filter(Boolean).map((claim) => (
                <div key={String(claim?.id)} className={styles.listCard}>
                  <strong>{String(claim.title || claim.task_key || "Untitled work claim")}</strong>
                  <span>
                    {String(claim.owner || "unassigned")} · {String(claim.machine || "unknown")} ·{" "}
                    {String(claim.repo || "contentco-op/monorepo")}
                  </span>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.panelKicker}>Controlled actions</p>
            <h2 className={styles.panelTitle}>Runtime audit, restart, and evidence tools</h2>
          </div>
        </div>
        <SystemOpsPanel workspace={snapshot.runtime.default_business_unit === "ACS" ? "acs" : "cc"} />
      </section>
    </main>
  );
}
