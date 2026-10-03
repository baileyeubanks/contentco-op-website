import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { BRIEF_SUBMITTED_EVENT_COLUMNS, BRIEF_SUBMITTED_IDEMPOTENCY_PREFIX } from "../cco-public-intake";

const infraMigrations = path.resolve(__dirname, "../../../../infra/supabase/migrations");
const appMigrations = path.resolve(__dirname, "../../supabase/migrations");
const lockdownPath = path.join(infraMigrations, "20261003000000_cco_rls_service_role_lockdown.sql");
const eventsContractPath = path.join(infraMigrations, "20261003000100_events_brief_submitted_contract.sql");

const ACS_FILES = /acs_v1|job_applicants/;

function listCreatedTables(dir: string) {
  const tables = new Set<string>();
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".sql") || ACS_FILES.test(file)) continue;
    const sql = readFileSync(path.join(dir, file), "utf8");
    for (const match of sql.matchAll(/create table if not exists (?:public\.)?([a-z_]+)/gi)) {
      tables.add(match[1].toLowerCase());
    }
  }
  return tables;
}

function stripComments(sql: string) {
  return sql.replace(/--[^\n]*/g, "");
}

function normalize(sql: string) {
  return stripComments(sql).toLowerCase().replace(/\s+/g, " ");
}

describe("CCO RLS lockdown migration (source contract)", () => {
  const lockdown = normalize(readFileSync(lockdownPath, "utf8"));
  const listMatch = lockdown.match(/cco_tables constant text\[\] := array\[(.*?)\];/);
  const lockedTables = new Set(
    (listMatch?.[1] || "")
      .split(",")
      .map((entry) => entry.trim().replace(/^'|'$/g, ""))
      .filter((entry) => /^[a-z_]+$/.test(entry)),
  );

  test("covers every table the CCO migrations create", () => {
    const created = new Set([...listCreatedTables(infraMigrations), ...listCreatedTables(appMigrations)]);
    const missing = [...created].filter((table) => !lockedTables.has(table)).sort();
    expect(missing).toEqual([]);
  });

  test("enables RLS and installs a service_role-scoped policy per table", () => {
    expect(lockdown).toContain("enable row level security");
    expect(lockdown).toContain("for all to service_role using (true) with check (true)");
    // The known-open ontology policies (no `to` clause) are removed explicitly.
    expect(lockdown).toContain("roles = '{public}'::name[]");
    expect(lockdown).toContain("drop policy %i on public.%i");
    // Fails closed if any CCO table is still unprotected after the run.
    expect(lockdown).toContain("raise exception 'cco_rls_lockdown: row level security still disabled on: %'");
  });

  test("never widens access for anon or authenticated", () => {
    expect(lockdown).not.toMatch(/to anon/);
    expect(lockdown).not.toMatch(/to authenticated/);
    expect(lockdown).not.toMatch(/grant /);
  });

  test("never references the ACS namespace", () => {
    expect(lockdown).not.toMatch(/acs_/);
    expect(lockdown).not.toContain("job_applicants");
    expect(lockdown).not.toContain("cviggizfmelffvpfzkmh");
  });
});

describe("events brief_submitted contract migration (source contract)", () => {
  const contract = normalize(readFileSync(eventsContractPath, "utf8"));

  test("declares every column the intake writer uses", () => {
    for (const column of BRIEF_SUBMITTED_EVENT_COLUMNS) {
      expect(contract).toContain(`('${column}')`);
    }
    expect(contract).toContain("add column if not exists idempotency_key text");
    expect(contract).toContain("add column if not exists event_version text");
  });

  test("enforces one brief_submitted event per public brief", () => {
    expect(contract).toContain(
      `create unique index if not exists idx_events_cco_public_brief_submitted_unique on public.events (idempotency_key) where idempotency_key like '${BRIEF_SUBMITTED_IDEMPOTENCY_PREFIX}%'`,
    );
  });

  test("fails closed when the live table drifts", () => {
    expect(contract).toContain("raise exception 'events_brief_submitted_contract: public.events is missing columns: %'");
  });
});

describe("creative_briefs converted status migration", () => {
  test("widens the status check to include converted (prerequisite for brief to project conversion)", () => {
    const sql = normalize(readFileSync(path.join(infraMigrations, "20261002120000_creative_briefs_status_converted.sql"), "utf8"));
    expect(sql).toContain("drop constraint if exists creative_briefs_status_check");
    expect(sql).toContain("'converted'::text");
  });
});
