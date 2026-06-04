"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import styles from "./system.module.css";

type PhoneActionResult = {
  ok?: boolean;
  error?: string;
  kind?: "preflight" | "outbound";
  action?: {
    action_id?: string;
    status?: string;
    target_host?: string;
    objective?: string;
    approval_required?: boolean;
  };
  ready_for_execution?: boolean;
  phone_call?: Record<string, unknown>;
  response?: Record<string, unknown>;
};

type PhoneTestTarget = {
  label?: string;
  phone_number?: string;
  last4?: string;
};

type PhoneTestGate = {
  enabled?: boolean;
  status?: string;
  blocked_reasons?: string[];
  business_units?: Record<string, {
    allowed_targets?: PhoneTestTarget[];
    default_target?: PhoneTestTarget;
    default_target_source?: string;
  }>;
};

function targetsForBusinessUnit(testGate: PhoneTestGate, businessUnit: "CC" | "ACS") {
  const businessUnits = testGate.business_units || {};
  const unit = businessUnits[businessUnit] || {};
  return Array.isArray(unit.allowed_targets) ? unit.allowed_targets : [];
}

function defaultTargetForBusinessUnit(testGate: PhoneTestGate, businessUnit: "CC" | "ACS") {
  const businessUnits = testGate.business_units || {};
  const unit = businessUnits[businessUnit] || {};
  const explicitDefault = unit.default_target;
  if (explicitDefault && (explicitDefault.phone_number || explicitDefault.label)) {
    return explicitDefault;
  }
  const targets = Array.isArray(unit.allowed_targets) ? unit.allowed_targets : [];
  return targets[0] || null;
}

export function PhoneActionPanel({
  defaultBusinessUnit,
  phoneStatus,
  blockedReasons,
  testGate,
}: {
  defaultBusinessUnit: "CC" | "ACS";
  phoneStatus: string;
  blockedReasons: string[];
  testGate: Record<string, unknown>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [businessUnit, setBusinessUnit] = useState<"CC" | "ACS">(defaultBusinessUnit);
  const parsedTestGate = (testGate || {}) as PhoneTestGate;
  const testGateEnabled = Boolean(parsedTestGate.enabled);
  const initialDefaultTarget = defaultTargetForBusinessUnit(parsedTestGate, defaultBusinessUnit);
  const [callPathPreference, setCallPathPreference] = useState("native_continuity_calling");
  const [contactName, setContactName] = useState(initialDefaultTarget?.label || "");
  const [phoneNumber, setPhoneNumber] = useState(initialDefaultTarget?.phone_number || "");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<PhoneActionResult | null>(null);
  const laneTone = phoneStatus === "ok" || phoneStatus === "preflight_ready" ? "healthy" : "attention";
  const allowedTargets = targetsForBusinessUnit(parsedTestGate, businessUnit);
  const defaultTarget = defaultTargetForBusinessUnit(parsedTestGate, businessUnit);
  const ccTargetLabels = targetsForBusinessUnit(parsedTestGate, "CC").map((item) => item.label || item.phone_number).filter(Boolean);
  const acsTargetLabels = targetsForBusinessUnit(parsedTestGate, "ACS").map((item) => item.label || item.phone_number).filter(Boolean);

  function selectTarget(nextPhoneNumber: string) {
    const matched = allowedTargets.find((item) => item.phone_number === nextPhoneNumber) || null;
    setPhoneNumber(nextPhoneNumber);
    if (matched?.label) {
      setContactName(matched.label);
    }
  }

  function queueAction(kind: "preflight" | "outbound") {
    startTransition(async () => {
      setResult({ kind });
      try {
        const payload = kind === "preflight"
          ? {
            kind,
            business_unit: businessUnit,
            objective: `Run approval-gated phone preflight on the M4 host for ${businessUnit}.`,
            call_path_preference: callPathPreference,
          }
          : {
            kind,
            business_unit: businessUnit,
            contact_name: contactName.trim() || defaultTarget?.label || undefined,
            phone_number: testGateEnabled ? undefined : phoneNumber.trim() || undefined,
            target_label: testGateEnabled ? (contactName.trim() || defaultTarget?.label || undefined) : undefined,
            reason: reason.trim() || undefined,
            call_path_preference: callPathPreference,
            objective: (contactName.trim() || defaultTarget?.label)
              ? `Place approval-gated outbound call to ${contactName.trim() || defaultTarget?.label} for ${businessUnit}.`
              : undefined,
          };

        const response = await fetch("/api/root/system/phone-actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = (await response.json().catch(() => ({}))) as PhoneActionResult;
        setResult(response.ok ? body : { ...body, error: body.error || `http_${response.status}` });
        if (response.ok) {
          router.refresh();
        }
      } catch (error) {
        setResult({
          kind,
          error: error instanceof Error ? error.message : "request_failed",
        });
      }
    });
  }

  return (
    <div className={styles.phoneActionPanel}>
      <div className={styles.actionSurface} data-tone={laneTone}>
        <div className={styles.actionHeader}>
          <strong>Approval-gated phone actions</strong>
          <span className={styles.metaTiny}>lane {phoneStatus}</span>
        </div>
        <div className={styles.microCopy}>
          Queue a preflight or outbound-call proposal directly from ROOT. Nothing executes automatically; Blaze still requires approval.
        </div>
        {blockedReasons.length > 0 ? (
          <div className={styles.metaTiny} style={{ color: "#f0c271" }}>
            blocked by {blockedReasons.join(" · ")}
          </div>
        ) : null}
      </div>

      <div className={styles.fieldGrid}>
        <label className={styles.fieldStack}>
          <span className={styles.fieldLabel}>Business unit</span>
          <select
            className={styles.selectControl}
              value={businessUnit}
              onChange={(event) => {
                const nextBusinessUnit = event.target.value === "ACS" ? "ACS" : "CC";
                setBusinessUnit(nextBusinessUnit);
                if (testGateEnabled) {
                  const nextTarget = defaultTargetForBusinessUnit(parsedTestGate, nextBusinessUnit);
                  setContactName(nextTarget?.label || "");
                  setPhoneNumber(nextTarget?.phone_number || "");
                }
              }}
            >
            <option value="CC">CC</option>
            <option value="ACS">ACS</option>
          </select>
        </label>
        <label className={styles.fieldStack}>
          <span className={styles.fieldLabel}>Call path preference</span>
          <select
            className={styles.selectControl}
            value={callPathPreference}
            onChange={(event) => setCallPathPreference(event.target.value)}
          >
            <option value="native_continuity_calling">Apple continuity</option>
            <option value="iphone_mirroring">iPhone mirroring fallback</option>
          </select>
        </label>
      </div>

      {testGateEnabled ? (
        <div className={styles.actionSurface} data-tone={parsedTestGate.status === "enforced" ? "healthy" : "attention"}>
          <div className={styles.actionHeader}>
            <strong>Live test gate</strong>
            <span className={styles.metaTiny}>status {String(parsedTestGate.status || "off")}</span>
          </div>
          <div className={styles.microCopy}>
            CC routes to {ccTargetLabels.join(" · ") || "no configured targets"}.
            ACS routes to {acsTargetLabels.join(" · ") || "no configured targets"}.
          </div>
          <div className={styles.metaTiny}>
            {businessUnit} default target: {defaultTarget?.label || defaultTarget?.phone_number || "not configured"}
          </div>
          {(parsedTestGate.blocked_reasons || []).length > 0 ? (
            <div className={styles.metaTiny} style={{ color: "#f0c271" }}>
              blocked by {(parsedTestGate.blocked_reasons || []).join(" · ")}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={styles.controlRow}>
        <button
          className={styles.inlineButton}
          type="button"
          onClick={() => queueAction("preflight")}
          disabled={isPending}
        >
          {isPending && result?.kind === "preflight" ? "queueing preflight..." : "queue preflight"}
        </button>
        <span className={styles.metaTiny}>target host M4 · approval required</span>
      </div>

      <div className={styles.fieldStack}>
        <div className={styles.sectionLabel}>Outbound proposal</div>
        <div className={styles.fieldStack}>
          {testGateEnabled ? (
            <label className={styles.fieldStack}>
              <span className={styles.fieldLabel}>Allowed test target</span>
              <select
                className={styles.selectControl}
                value={phoneNumber}
                onChange={(event) => selectTarget(event.target.value)}
              >
                {allowedTargets.length === 0 ? <option value="">No targets configured</option> : null}
                {allowedTargets.map((target) => (
                  <option key={target.phone_number || target.label} value={target.phone_number || ""}>
                    {target.label || target.phone_number} {target.phone_number ? `· ${target.phone_number}` : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <input
                className={styles.textInput}
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
                placeholder="contact name"
              />
              <input
                className={styles.textInput}
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="phone number"
              />
            </>
          )}
          <textarea
            className={styles.textArea}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="reason or handoff note"
            rows={3}
          />
          <button
            className={styles.inlineButtonAlt}
            type="button"
            onClick={() => queueAction("outbound")}
            disabled={isPending || (!phoneNumber.trim() && !testGateEnabled) || (testGateEnabled && allowedTargets.length === 0)}
          >
            {isPending && result?.kind === "outbound" ? "queueing outbound call..." : "queue outbound call"}
          </button>
        </div>
      </div>

      {result ? (
        <div className={styles.resultCard} data-tone={result.error ? "attention" : "healthy"}>
          <strong>
            {result.kind === "outbound" ? "outbound proposal" : "preflight proposal"}
          </strong>
          <div className={styles.microCopy} style={result.error ? { color: "#f0c271" } : undefined}>
            {result.error
              ? result.error
              : `${result.action?.status || "queued"} · ${result.action?.action_id || "action pending"} · approval required ${
                result.action?.approval_required === false ? "no" : "yes"
              }`}
          </div>
          {!result.error && result.ready_for_execution !== undefined ? (
            <div className={styles.metaTiny}>
              ready for execution: {result.ready_for_execution ? "yes" : "no"}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
