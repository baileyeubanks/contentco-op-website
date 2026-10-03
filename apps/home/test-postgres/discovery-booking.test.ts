import { beforeAll, afterAll, describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
let pg: PGlite;
const startsAt = new Date(Date.now() + 2 * 86400_000).toISOString();
const endsAt = new Date(Date.parse(startsAt) + 20 * 60000).toISOString();
const input = { submissionId: "11111111-1111-4111-8111-111111111111", name: "Test Guest", email: "guest@example.test", startsAt, endsAt };
async function claim(request = input, fingerprint = "a".repeat(64)) {
  return (await pg.query<{ result: { record: Record<string, unknown>; fresh: boolean } }>("select public.cco_claim_discovery_booking($1::jsonb,$2,$3,$4,true) result", [JSON.stringify(request), "isolated-calendar", "owner@example.test", fingerprint])).rows[0].result;
}
beforeAll(async () => { pg = await PGlite.create(); await pg.exec(readFileSync(resolve(process.cwd(), "../../docs/architecture/cco-discovery-booking-candidate.sql"), "utf8")); });
afterAll(async () => { await pg.close(); });
describe("unapplied CCO-DB booking contract in isolated Postgres", () => {
  test("claim is durable, replay is identical, and overlap/identity conflicts fail", async () => {
    const first = await claim(); expect(first.fresh).toBe(true); expect(first.record.state).toBe("pending");
    expect((await claim()).fresh).toBe(false);
    await expect(claim(input, "b".repeat(64))).rejects.toThrow("booking_submission_conflict");
    await expect(claim({ ...input, submissionId: "33333333-3333-4333-8333-333333333333" })).rejects.toThrow("slot_already_claimed");
  });
  test("partial receipt cannot confirm; reconcile → matching receipt confirms and cannot be downgraded", async () => {
    const row = (await claim()).record;
    const args = [row.id, "a".repeat(64)];
    await pg.query("select public.cco_settle_discovery_booking($1::uuid,$2,null)", args);
    const receipt = { bookingId: row.id, eventId: `cco${String(row.id).replaceAll("-", "")}`, startsAt, endsAt, organizerEmail: "owner@example.test", attendees: ["guest@example.test", "owner@example.test"], meetUrl: "https://meet.google.com/abc-defg-hij", htmlLink: "https://www.google.com/calendar/event?eid=test" };
    await expect(pg.query("select public.cco_settle_discovery_booking($1::uuid,$2,$3::jsonb)", [...args, JSON.stringify({ ...receipt, meetUrl: "" })])).rejects.toThrow("invalid_calendar_receipt");
    await expect(pg.query("select public.cco_settle_discovery_booking($1::uuid,$2,$3::jsonb)", [...args, JSON.stringify({ ...receipt, attendees: undefined })])).rejects.toThrow("invalid_calendar_receipt");
    const saved = await pg.query<{ result: { state: string } }>("select public.cco_settle_discovery_booking($1::uuid,$2,$3::jsonb) result", [...args, JSON.stringify(receipt)]);
    expect(saved.rows[0].result.state).toBe("confirmed");
    const replay = await pg.query<{ result: { state: string } }>("select public.cco_settle_discovery_booking($1::uuid,$2,null) result", args);
    expect(replay.rows[0].result.state).toBe("confirmed");
  });
});
