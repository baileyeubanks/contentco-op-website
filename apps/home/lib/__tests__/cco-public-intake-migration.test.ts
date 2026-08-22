import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const migrationPath = path.resolve(
  __dirname,
  "../../../../infra/supabase/migrations/20260822012747_cco_public_brief_persistence_20260819000000.sql",
);

describe("CCO public brief persistence migration", () => {
  test("derives the canonical public email key from normalized contact email", () => {
    const sql = readFileSync(migrationPath, "utf8").toLowerCase();
    const normalized = sql.replace(/\s+/g, " ");

    expect(normalized).toContain(
      "cco_public_email_key text generated always as (nullif(lower(btrim(email)), '')) stored",
    );
    expect(normalized).not.toContain("set cco_public_email_key =");
  });

  test("widens an existing notification status constraint for the delivery state machine", () => {
    const sql = readFileSync(migrationPath, "utf8").toLowerCase();
    const normalized = sql.replace(/\s+/g, " ");

    expect(normalized).toContain(
      "drop constraint if exists notification_log_status_check",
    );

    const constraintBody = normalized.match(
      /add constraint notification_log_status_check check \((.*?)\);/,
    )?.[1];
    expect(constraintBody).toBeTruthy();
    for (const status of ["queued", "sending", "sent", "failed", "unknown"]) {
      expect(constraintBody).toContain(`'${status}'`);
    }
  });
});
