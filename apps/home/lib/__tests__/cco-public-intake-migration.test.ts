import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const migrationPath = path.resolve(
  __dirname,
  "../../../../infra/supabase/migrations/20260819000000_cco_public_brief_persistence.sql",
);

describe("CCO public brief persistence migration", () => {
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
