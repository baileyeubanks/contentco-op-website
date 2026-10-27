import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const SUPABASE = path.resolve(__dirname, "../../../../infra/supabase");
const NAME = "20261027023000_revoke_anon_authenticated_os_tables";
const code = (sql: string) => sql.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n");
const forwardFile = readFileSync(path.join(SUPABASE, "migrations", `${NAME}.sql`), "utf8");
const rollbackFile = readFileSync(path.join(SUPABASE, "rollbacks", `${NAME}.rollback.sql`), "utf8");
const forward = code(forwardFile);
const rollback = code(rollbackFile);

const arrayOf = (sql: string) => {
  const body = sql.match(/tables text\[\] := ARRAY\[([\s\S]*?)\];/)?.[1] ?? "";
  return [...body.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
};

describe("grant revoke migration 20261027023000 and its rollback", () => {
  const revoked = arrayOf(forward);
  const restored = arrayOf(rollback);

  test("forward migration only revokes from anon and authenticated, guarded and data-free", () => {
    expect(forward).toMatch(/REVOKE ALL ON TABLE public\.%I FROM anon, authenticated/);
    expect(forward).not.toMatch(/\b(DROP|DELETE|TRUNCATE|ALTER|UPDATE|INSERT)\b/i);
    expect(forward).toContain("to_regclass");
    expect(forward).not.toMatch(/service_role|PUBLIC\b.*REVOKE/);
  });

  test("rollback restores a non-empty subset of exactly the revoked tables, no extras", () => {
    expect(restored.length).toBeGreaterThan(0);
    for (const table of restored) expect(revoked, table).toContain(table);
    expect(new Set(restored).size).toBe(restored.length);
  });

  test("rollback grants ALL to anon and authenticated only, never with grant option or to other roles", () => {
    expect(rollback).toMatch(/GRANT ALL ON TABLE public\.%I TO anon, authenticated/);
    expect(rollback).not.toMatch(/WITH GRANT OPTION|service_role|TO PUBLIC/i);
    expect(rollback).toContain("to_regclass");
  });

  test("the four tables that existed with empty ACLs are not granted by the rollback", () => {
    for (const table of ["mobile_sync_actions", "scenario_run_artifacts", "scenario_runs", "work_proof_manifests"]) {
      expect(restored).not.toContain(table);
    }
  });

  test("the rollback is not in migrations/, so a db push can never apply it forward", () => {
    const migrations = readdirSync(path.join(SUPABASE, "migrations"));
    expect(migrations.filter((f) => f.includes("rollback") || f.includes("verify"))).toEqual([]);
  });
});
