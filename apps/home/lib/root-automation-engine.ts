/**
 * ROOT Automation Engine — Declarative event-driven automation rules.
 * When an event fires, matching rules are evaluated and actions executed.
 */

import { getSupabase } from "@/lib/supabase";
import { emitTypedEvent } from "@/lib/root-event-log";

type AutomationCondition = {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "gt" | "lt" | "in" | "exists";
  value: unknown;
};

type AutomationAction = {
  type: "send_email" | "create_task" | "update_field" | "notify_slack" | "invoke_blaze" | "create_event" | "webhook";
  config: Record<string, unknown>;
};

// ─── Rule CRUD ───

export async function getAutomationRules(scope?: string | null, activeOnly = true) {
  const sb = getSupabase();
  let query = sb.from("automation_rules").select("*").order("created_at", { ascending: false });

  if (scope) query = query.or(`business_unit.eq.${scope},business_unit.eq.ALL`);
  if (activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query;
  return { rules: data || [], error: error?.message || null };
}

export async function getAutomationRuleById(id: string) {
  const sb = getSupabase();

  const [{ data: rule, error }, { data: runs }] = await Promise.all([
    sb.from("automation_rules").select("*").eq("id", id).maybeSingle(),
    sb.from("automation_runs").select("*").eq("rule_id", id).order("started_at", { ascending: false }).limit(20),
  ]);

  return { rule, runs: runs || [], error: error?.message || null };
}

export async function createAutomationRule(data: {
  business_unit?: string;
  name: string;
  description?: string;
  trigger_event: string;
  conditions?: AutomationCondition[];
  actions: AutomationAction[];
}) {
  const sb = getSupabase();
  const { data: rule, error } = await sb
    .from("automation_rules")
    .insert({
      business_unit: data.business_unit || "ALL",
      name: data.name,
      description: data.description || null,
      trigger_event: data.trigger_event,
      conditions: data.conditions || [],
      actions: data.actions,
      is_active: true,
    })
    .select()
    .single();

  if (rule) {
    await emitTypedEvent({
      type: "automation.rule_created",
      objectType: "automation",
      objectId: rule.id,
      text: `Automation rule "${data.name}" created`,
      payload: { trigger_event: data.trigger_event },
    });
  }

  return { rule, error: error?.message || null };
}

export async function updateAutomationRule(id: string, updates: Record<string, unknown>) {
  const sb = getSupabase();
  const { data: rule, error } = await sb
    .from("automation_rules")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (rule) {
    await emitTypedEvent({
      type: "automation.rule_updated",
      objectType: "automation",
      objectId: id,
      text: `Automation rule "${rule.name}" updated`,
    });
  }

  return { rule, error: error?.message || null };
}

// ─── Rule Evaluation ───

function evaluateCondition(condition: AutomationCondition, payload: Record<string, unknown>): boolean {
  const fieldValue = payload[condition.field];

  switch (condition.operator) {
    case "equals":
      return fieldValue === condition.value;
    case "not_equals":
      return fieldValue !== condition.value;
    case "contains":
      return typeof fieldValue === "string" && fieldValue.includes(String(condition.value));
    case "gt":
      return Number(fieldValue) > Number(condition.value);
    case "lt":
      return Number(fieldValue) < Number(condition.value);
    case "in":
      return Array.isArray(condition.value) && condition.value.includes(fieldValue);
    case "exists":
      return fieldValue !== undefined && fieldValue !== null;
    default:
      return false;
  }
}

function evaluateConditions(conditions: AutomationCondition[], payload: Record<string, unknown>): boolean {
  if (!conditions.length) return true;
  return conditions.every((c) => evaluateCondition(c, payload));
}

// ─── Action Execution ───

async function executeAction(action: AutomationAction, context: {
  eventType: string;
  payload: Record<string, unknown>;
  businessUnit: string;
}): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const sb = getSupabase();

  switch (action.type) {
    case "create_event": {
      const { data: event } = await sb.from("events").insert({
        type: String(action.config.event_type || "automation.action"),
        business_unit: context.businessUnit,
        text: String(action.config.text || "Automated event"),
        payload: { ...(action.config.payload as Record<string, unknown> || {}), triggered_by: context.eventType },
        channel: "root",
        direction: "internal",
        event_category: "system",
      }).select("id").single();
      return { ok: true, result: event };
    }

    case "update_field": {
      const table = String(action.config.table || "");
      const id = String(action.config.id || context.payload.object_id || "");
      const field = String(action.config.field || "");
      const value = action.config.value;

      if (!table || !id || !field) return { ok: false, error: "Missing table, id, or field" };

      const { error } = await sb.from(table).update({ [field]: value }).eq("id", id);
      return error ? { ok: false, error: error.message } : { ok: true };
    }

    case "create_task": {
      // Create a work_claim as a task
      const { error } = await sb.from("work_claims").insert({
        task_key: `auto-${Date.now()}`,
        title: String(action.config.title || "Automated task"),
        repo: "root",
        machine: "automation",
        owner: String(action.config.owner || "system"),
        notes: String(action.config.notes || `Triggered by ${context.eventType}`),
      });
      return error ? { ok: false, error: error.message } : { ok: true };
    }

    case "invoke_blaze": {
      // Fire-and-forget to BLAZE API
      const blazeUrl = process.env.BLAZE_API_URL || "http://10.0.0.45:8899";
      try {
        const res = await fetch(`${blazeUrl}/api/v1/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_name: action.config.task_name || "automation_action",
            payload: { ...context.payload, action_config: action.config },
          }),
        });
        return { ok: res.ok, result: await res.json().catch(() => null) };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "BLAZE call failed" };
      }
    }

    case "webhook": {
      const url = String(action.config.url || "");
      if (!url) return { ok: false, error: "Missing webhook URL" };

      try {
        const res = await fetch(url, {
          method: String(action.config.method || "POST"),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event_type: context.eventType, payload: context.payload }),
        });
        return { ok: res.ok };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Webhook failed" };
      }
    }

    default:
      return { ok: false, error: `Unknown action type: ${action.type}` };
  }
}

// ─── Main Evaluator (called after event emission) ───

export async function evaluateAutomationRules(event: {
  id?: string;
  type: string;
  business_unit?: string;
  payload?: Record<string, unknown>;
}) {
  const sb = getSupabase();

  // Find matching active rules
  const { data: rules } = await sb
    .from("automation_rules")
    .select("*")
    .eq("trigger_event", event.type)
    .eq("is_active", true)
    .or(`business_unit.eq.${event.business_unit || "CC"},business_unit.eq.ALL`);

  if (!rules?.length) return { triggered: 0 };

  let triggered = 0;
  const eventPayload = event.payload || {};

  for (const rule of rules) {
    const conditions = (rule.conditions as AutomationCondition[]) || [];
    if (!evaluateConditions(conditions, eventPayload)) continue;

    // Create automation run
    const { data: run } = await sb.from("automation_runs").insert({
      rule_id: rule.id,
      trigger_event_id: event.id || null,
      status: "running",
      input_payload: eventPayload,
    }).select("id").single();

    const actions = (rule.actions as AutomationAction[]) || [];
    const results: Array<{ ok: boolean; error?: string }> = [];

    for (const action of actions) {
      const result = await executeAction(action, {
        eventType: event.type,
        payload: eventPayload,
        businessUnit: event.business_unit || "CC",
      });
      results.push(result);
    }

    const allOk = results.every((r) => r.ok);
    const errors = results.filter((r) => !r.ok).map((r) => r.error);

    // Update run status
    if (run) {
      await sb.from("automation_runs").update({
        status: allOk ? "completed" : "failed",
        result: { actions: results },
        error: errors.length ? errors.join("; ") : null,
        completed_at: new Date().toISOString(),
      }).eq("id", run.id);
    }

    // Update rule stats
    await sb.from("automation_rules").update({
      last_triggered_at: new Date().toISOString(),
      run_count: (rule.run_count || 0) + 1,
    }).eq("id", rule.id);

    await emitTypedEvent({
      type: allOk ? "automation.completed" : "automation.failed",
      objectType: "automation",
      objectId: rule.id,
      text: allOk ? `Automation "${rule.name}" completed` : `Automation "${rule.name}" failed`,
      payload: { run_id: run?.id, action_count: actions.length, errors },
    });

    triggered++;
  }

  return { triggered };
}

// ─── Dry Run ───

export async function testAutomationRule(ruleId: string, testPayload: Record<string, unknown>) {
  const sb = getSupabase();
  const { data: rule } = await sb.from("automation_rules").select("*").eq("id", ruleId).maybeSingle();

  if (!rule) return { matched: false, error: "Rule not found" };

  const conditions = (rule.conditions as AutomationCondition[]) || [];
  const matched = evaluateConditions(conditions, testPayload);

  return {
    matched,
    rule_name: rule.name,
    trigger_event: rule.trigger_event,
    conditions_count: conditions.length,
    actions_count: ((rule.actions as AutomationAction[]) || []).length,
    actions: matched ? (rule.actions as AutomationAction[]).map((a) => a.type) : [],
  };
}
