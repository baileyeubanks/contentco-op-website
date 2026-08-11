#!/usr/bin/env tsx
/**
 * One-time backfill: freeze v1 estimate_versions for estimates that were sent
 * BEFORE freeze-on-send (task 2.5) deployed. Those rows have no frozen
 * version, so their pay route and convert path 409 `estimate_not_frozen`.
 *
 * DRY-RUN BY DEFAULT — prints what it would freeze and writes nothing.
 * Pass --apply to write. Safe to re-run: already-frozen estimates are skipped.
 *
 * Run: npx tsx scripts/backfill-estimate-versions.ts [--apply]
 *
 * frozen_at honesty: a backfilled v1 is stamped with the estimate's original
 * sent_at (when the content was truly frozen for the client), never the
 * backfill run time. Rows edited after send (updated_at > sent_at) are still
 * frozen from their CURRENT rows but flagged as drifted in the summary —
 * Bailey decides whether those need a re-send instead.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "../lib/supabase";
import { freezeEstimateVersion } from "../lib/os-estimate-versions";

type ClientLike = Pick<SupabaseClient, "from">;

/** Internal statuses that mean the estimate was sent to the client. */
export const BACKFILL_SENT_STATUSES = [
  "sent",
  "viewed",
  "approved",
  "rejected",
  "changes_requested",
  "superseded",
] as const;

export type EstimateVersionBackfillSummary = {
  scanned: number;
  frozen: Array<{ estimateId: string; estimateNumber: string; versionId: string; drift: boolean }>;
  wouldFreeze: number;
  alreadyFrozen: number;
  missingSentAt: number;
  drifted: string[];
  errors: Array<{ estimateId: string; error: string }>;
};

function emptySummary(): EstimateVersionBackfillSummary {
  return {
    scanned: 0,
    frozen: [],
    wouldFreeze: 0,
    alreadyFrozen: 0,
    missingSentAt: 0,
    drifted: [],
    errors: [],
  };
}

export async function runEstimateVersionBackfill(
  input: { apply: boolean },
  deps: { sb: ClientLike },
): Promise<EstimateVersionBackfillSummary> {
  const sb = deps.sb;
  const summary = emptySummary();

  const { data: candidates, error } = await sb
    .from("estimates")
    .select("*")
    .in("internal_status", [...BACKFILL_SENT_STATUSES]);
  if (error) {
    summary.errors.push({ estimateId: "(query)", error: error.message });
    return summary;
  }

  for (const estimate of (candidates || []) as Array<Record<string, unknown>>) {
    summary.scanned += 1;
    const estimateId = String(estimate.id);
    const estimateNumber = String(estimate.estimate_number || estimateId);

    const { data: existingVersion } = await sb
      .from("estimate_versions")
      .select("id")
      .eq("estimate_id", estimateId)
      .limit(1)
      .maybeSingle();
    if (existingVersion) {
      summary.alreadyFrozen += 1;
      continue;
    }

    if (!estimate.sent_at) {
      // Fail closed: never fabricate a freeze date.
      summary.missingSentAt += 1;
      continue;
    }
    const sentAt = String(estimate.sent_at);
    const drift = Boolean(estimate.updated_at) && String(estimate.updated_at) > sentAt;
    if (drift) summary.drifted.push(estimateId);

    if (!input.apply) {
      summary.wouldFreeze += 1;
      continue;
    }

    const { data: lineItems } = await sb
      .from("estimate_line_items")
      .select("*")
      .eq("estimate_id", estimateId)
      .order("sort_order", { ascending: true });

    // Same contact join sendEstimate performs — the frozen PDF's Bill To
    // block renders unconditionally, so a contactless snapshot shows an
    // empty Bill To forever.
    const contact = estimate.contact_id
      ? ((await sb.from("contacts").select("id, full_name, email, company, phone").eq("id", estimate.contact_id).maybeSingle())
          .data as Record<string, unknown> | null)
      : null;

    const freeze = await freezeEstimateVersion(sb, {
      estimateId,
      estimate,
      lineItems: (lineItems || []) as Array<Record<string, unknown>>,
      contact,
      frozenAt: sentAt,
    });
    if (freeze.error || !freeze.version) {
      summary.errors.push({ estimateId, error: freeze.error || "estimate_freeze_failed" });
      continue;
    }
    summary.frozen.push({ estimateId, estimateNumber, versionId: String(freeze.version.id), drift });
  }

  return summary;
}

/* ── CLI wrapper (not exercised by tests) ── */

function readEnvFile(filePath: string) {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    return;
  }
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!key || process.env[key]?.trim()) continue;
    process.env[key] = value;
  }
}

function printSummary(summary: EstimateVersionBackfillSummary, apply: boolean) {
  const lines = [
    `mode: ${apply ? "APPLY" : "DRY-RUN (nothing written)"}`,
    `scanned (sent-status estimates): ${summary.scanned}`,
    apply ? `frozen: ${summary.frozen.length}` : `would freeze: ${summary.wouldFreeze}`,
    `skipped (already frozen): ${summary.alreadyFrozen}`,
    `skipped (no sent_at — not fabricated): ${summary.missingSentAt}`,
    `drift-flagged (updated_at > sent_at, frozen from current rows): ${summary.drifted.length}`,
  ];
  for (const id of summary.drifted) lines.push(`  drift: ${id}`);
  for (const row of summary.frozen) {
    lines.push(`  froze ${row.estimateNumber} (${row.estimateId}) -> version ${row.versionId}${row.drift ? " [DRIFT]" : ""}`);
  }
  if (summary.errors.length) {
    lines.push(`errors: ${summary.errors.length}`);
    for (const err of summary.errors) lines.push(`  ${err.estimateId}: ${err.error}`);
  }
  process.stdout.write(`${lines.join("\n")}\n`);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  for (const candidate of [".env.local", ".env"]) {
    readEnvFile(path.join(appRoot, candidate));
  }

  const summary = await runEstimateVersionBackfill({ apply }, { sb: getSupabase() });
  printSummary(summary, apply);
  if (summary.errors.length) process.exitCode = 1;
}

const isCli =
  Boolean(process.argv[1]) &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isCli) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
