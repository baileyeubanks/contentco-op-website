import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { beforeAll, afterAll, beforeEach, describe, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";
import { PgFixture } from "./client";
import { handoffEstimateToCoVideoPro } from "../lib/cvp-handoff";
import { handoffBriefToProduction } from "../lib/cco-brief-production-handoff";
import { ccoRecordId } from "../lib/cco-record-id";
import { hashEstimateVersionSnapshot } from "../lib/os-estimate-versions";

const ID = {
  brief: "aaaaaaaa-1111-4111-8111-111111111111", estimate: "bbbbbbbb-2222-4222-8222-222222222222",
  version: "33333333-3333-4333-8333-333333333333", owner: "44444444-4444-4444-8444-444444444444",
  contact: "55555555-5555-4555-8555-555555555555",
};
let pg: PGlite; let fixture: PgFixture;
const deps = () => ({ sb: fixture.client("public") as never, cvpSb: fixture.client("co_production") as never,
  env: { CVP_OWNER_USER_ID: ID.owner } });
const run = (id = ID.brief) => handoffBriefToProduction(id, "CC", deps());
const snapshot = () => ({
  estimate: { id: ID.estimate, brief_id: ID.brief, business_unit: "CC", estimate_number: "CC-EST-2026-0001",
    scope_snapshot: { scope_items: [
      { item_type: "travel", scope_bucket: "travel_logistics", label: "Travel", quantity: 1, metadata: {} },
      { item_type: "main_edits", scope_bucket: "post_production_deliverables", label: "Approved launch film", quantity: 1, metadata: { runtime: "90s" } },
      { item_type: "social_shorts", scope_bucket: "post_production_deliverables", label: "Social cuts", quantity: 3, metadata: { vertical: true } },
    ] } },
  contact: { id: ID.contact, full_name: "Synthetic Client", email: "test@example.invalid", company: "Synthetic Company" },
  line_items: [{ description: "Accepted production scope", quantity: 1, line_total_cents: 500000 }],
  totals: { subtotal_cents: 500000, tax_cents: 0, total_cents: 500000, deposit_percent: 50,
    deposit_due_cents: 250000, balance_remaining_cents: 250000, currency: "USD" },
  frozen_at: "2026-10-03T00:00:00.000Z",
});
async function seedApproved() {
  const snap = snapshot();
  await pg.query(`INSERT INTO public.estimates(id,business_unit,brief_id,contact_id,estimate_number,internal_status,client_status) VALUES ($1,'CC',$2,$3,'CC-EST-2026-0001','approved','approved')`, [ID.estimate, ID.brief, ID.contact]);
  await pg.query(`INSERT INTO public.estimate_versions(id,estimate_id,version,frozen_at,snapshot,sha256) VALUES ($1,$2,1,$3,$4,$5)`, [ID.version, ID.estimate, snap.frozen_at, JSON.stringify(snap), hashEstimateVersionSnapshot(snap)]);
  await pg.query(`UPDATE public.estimates SET active_version_id=$1 WHERE id=$2`, [ID.version, ID.estimate]);
  await pg.query(`INSERT INTO public.estimate_decisions(estimate_id,estimate_version_id,decision_type) VALUES ($1,$2,'approved')`, [ID.estimate, ID.version]);
}
beforeAll(async () => {
  pg = await PGlite.create({ extensions: { pgcrypto, uuid_ossp, vector } });
  await pg.exec(await readFile(fileURLToPath(new URL("./applied-schema.sql", import.meta.url)), "utf8"));
  // Dependency stand-ins retain the catalogued project FK, not the unrelated
  // asset/script payload shape. Production rows are never copied into tests.
  await pg.exec(`CREATE TABLE public.script_jobs(id uuid PRIMARY KEY, project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL, sentinel jsonb);
    CREATE TABLE co_production.assets(id uuid PRIMARY KEY, project_id uuid REFERENCES co_production.projects(id) ON DELETE CASCADE, sentinel jsonb)`);
});
afterAll(async () => pg?.close());
beforeEach(async () => {
  await pg.exec(`TRUNCATE public.creative_briefs, public.contacts, public.projects, public.events, co_production.projects, co_production.inquiries, co_production.contacts, co_production.organizations, auth.users CASCADE`);
  await pg.query(`INSERT INTO auth.users(id) VALUES ($1)`, [ID.owner]);
  await pg.query(`INSERT INTO public.contacts(id) VALUES ($1)`, [ID.contact]);
  await pg.query(`INSERT INTO public.creative_briefs(id,contact_name,contact_email) VALUES ($1,'Synthetic Client','test@example.invalid')`, [ID.brief]);
  fixture = new PgFixture(pg);
});

describe("applied CCO PostgreSQL handoff contract", () => {
  test("completed replay preserves later production states and uses immutable client identity", async () => {
    await seedApproved(); expect((await run()).error).toBeNull();
    await pg.exec(`UPDATE co_production.projects SET name='Staff project name', stage='post', status='completed';
      UPDATE co_production.inquiries SET status='declined';
      UPDATE co_production.deliverables SET name='Staff deliverable name', status='qc';
      UPDATE co_production.organizations SET name='CRM renamed company';
      UPDATE co_production.contacts SET name='CRM renamed contact', email='new@example.invalid'`);
    const tables = ["co_production.projects", "co_production.inquiries", "co_production.deliverables", "co_production.organizations", "co_production.contacts", "public.events", "public.commercial_handoffs"];
    const before = await Promise.all(tables.map((table) => fixture.rows(table)));
    fixture.mutations = [];
    expect(await run()).toMatchObject({ error: null, replayed: true });
    expect(fixture.mutations).toHaveLength(0);
    expect(await Promise.all(tables.map((table) => fixture.rows(table)))).toEqual(before);
  });
  test("completed replay blocks deleted deliverables instead of recreating operator work", async () => {
    await seedApproved(); expect((await run()).error).toBeNull();
    await pg.exec(`DELETE FROM co_production.deliverables`); fixture.mutations = [];
    expect(await run()).toMatchObject({ error: "handoff_receipt_link_conflict", retryable: false });
    expect(fixture.mutations).toHaveLength(0);
    expect(await fixture.rows("co_production.deliverables")).toHaveLength(0);
  });
  test.each([false, true])("existing contact in another organization blocks with zero writes (target exists=%s)", async (targetExists) => {
    await seedApproved();
    await pg.query(`INSERT INTO co_production.organizations(id,owner_id,name) VALUES ($1,$2,'Other company')`, [ID.contact, ID.owner]);
    if (targetExists) await pg.query(`INSERT INTO co_production.organizations(owner_id,name) VALUES ($1,'Synthetic Company')`, [ID.owner]);
    await pg.query(`INSERT INTO co_production.contacts(owner_id,organization_id,name,email) VALUES ($1,$2,'Existing contact','test@example.invalid')`, [ID.owner, ID.contact]);
    expect(await run()).toMatchObject({ error: "production_contact_organization_conflict", retryable: false });
    expect(fixture.mutations).toHaveLength(0);
  });
  test.each(["multiple-estimates", "conflicting-hint"])("ambiguous brief linkage %s blocks before writes", async (kind) => {
    await seedApproved();
    if (kind === "multiple-estimates") await pg.query(`INSERT INTO public.estimates(brief_id,estimate_number,internal_status,client_status,active_version_id) VALUES ($1,'CC-EST-OTHER','approved','approved',$2)`, [ID.brief, ID.version]);
    else await pg.exec(`UPDATE public.creative_briefs SET normalized_scope_metadata='{"estimate_id":"other-estimate"}'`);
    expect((await run()).error).toMatch(/brief_estimate_(ambiguous|link_conflict)/);
    expect(fixture.mutations).toHaveLength(0);
  });
  test("inquiry status write failure stays partial and resumes the same saved records", async () => {
    await seedApproved(); fixture.fail("co_production.inquiries", "update");
    const first = await run(); expect(first).toMatchObject({ partial: true, retryable: true, stage: "inquiry_status" });
    expect(await fixture.rows("public.commercial_handoffs")).toHaveLength(0);
    const second = await run(); expect(second.error).toBeNull(); expect(second.project?.id).toBe(first.project?.id);
    expect(await fixture.rows("co_production.projects")).toHaveLength(1);
  });
  test("preserves all synthetic 6 legacy / 3 production / 47 brief records and their dependencies", async () => {
    const synthetic = (kind: string, n: number) => ccoRecordId(`fixture-${kind}`, String(n));
    for (let n = 0; n < 6; n++) await pg.query(`INSERT INTO public.projects(id,owner_id,name) VALUES ($1,$2,$3)`, [synthetic("legacy", n), ID.owner, `Legacy ${n}`]);
    await pg.query(`INSERT INTO public.script_jobs(id,project_id,sentinel) VALUES ($1,$2,'{"keep":"legacy script"}')`, [synthetic("script", 0), synthetic("legacy", 0)]);
    for (let n = 0; n < 3; n++) {
      await pg.query(`INSERT INTO co_production.projects(id,owner_id,name,stage) VALUES ($1,$2,$3,'post')`, [synthetic("production", n), ID.owner, `Production ${n}`]);
      await pg.query(`INSERT INTO co_production.project_members(id,project_id,user_id) VALUES ($1,$2,$3)`, [synthetic("member", n), synthetic("production", n), ID.owner]);
      for (let asset = 0; asset < 2; asset++) await pg.query(`INSERT INTO co_production.assets(id,project_id,sentinel) VALUES ($1,$2,'{"keep":"production asset"}')`, [synthetic("asset", n * 2 + asset), synthetic("production", n)]);
    }
    for (let n = 1; n < 47; n++) await pg.query(`INSERT INTO public.creative_briefs(id,contact_name,contact_email) VALUES ($1,$2,'preserve@example.invalid')`, [synthetic("brief", n), `Brief ${n}`]);
    const tables = ["public.projects", "co_production.projects", "public.creative_briefs", "public.script_jobs", "co_production.project_members", "co_production.assets"];
    const before = await Promise.all(tables.map((table) => fixture.rows(table)));
    expect(before.map((rows) => rows.length)).toEqual([6, 3, 47, 1, 3, 6]);
    await seedApproved(); const result = await run(); expect(result.error).toBeNull();
    const after = await Promise.all(tables.map((table) => fixture.rows(table)));
    after[1] = after[1].filter((row) => row.id !== result.project?.id);
    expect(after).toEqual(before);
  });
  test("fixture rejects the obsolete public production and converted-status assumptions", async () => {
    await expect(pg.query(`INSERT INTO public.projects(business_unit) VALUES ('CC')`)).rejects.toMatchObject({ code: "42703" });
    await expect(pg.query(`SELECT * FROM public.deliverables`)).rejects.toMatchObject({ code: "42P01" });
    await expect(pg.query(`UPDATE public.creative_briefs SET status='converted'`)).rejects.toMatchObject({ code: "23514" });
    await expect(pg.query(`INSERT INTO public.events(object_type) VALUES ('project')`)).rejects.toMatchObject({ code: "42703" });
  });

  test("missing approved estimate is actionable and writes nothing", async () => {
    expect(await run()).toMatchObject({ error: "approved_estimate_required", retryable: false, partial: false });
    expect(fixture.mutations).toHaveLength(0);
  });
  test("creates production rows in their actual schema without converted brief status or typed-event columns", async () => {
    await seedApproved();
    const result = await run();
    expect(result.error).toBeNull();
    expect(result.project?.schema).toBe("co_production");
    expect(await fixture.rows("public.projects")).toHaveLength(0);
    const projects = await fixture.rows("co_production.projects");
    expect(projects).toHaveLength(1); expect(projects[0]).toMatchObject({ status: "active", stage: "intake", owner_id: ID.owner });
    const deliverables = await fixture.rows("co_production.deliverables");
    expect(deliverables).toHaveLength(2); expect(deliverables.every((d) => d.status === "specced")).toBe(true);
    expect(deliverables.find((d) => d.name === "Social cuts")?.spec.quantity).toBe(3);
    expect((await fixture.rows("public.creative_briefs"))[0].status).toBe("submitted");
    expect(await fixture.rows("public.events")).toHaveLength(1);
    expect(await fixture.rows("public.commercial_handoffs")).toHaveLength(1);
  });
  test("estimate UUID aliases also reuse canonical source IDs", async () => {
    await seedApproved();
    const results = await Promise.all([ID.estimate, `{${ID.estimate.toUpperCase()}}`, ID.estimate.replace(/-/g, "")].map((estimateId) => handoffEstimateToCoVideoPro({ estimateId }, deps())));
    results.forEach((result) => expect(result.receipt).toMatchObject({ estimateId: ID.estimate, estimateVersionId: ID.version }));
    expect(new Set(results.map((result) => result.receipt?.cvpProjectId)).size).toBe(1);
    expect(await fixture.rows("co_production.deliverables")).toHaveLength(2);
    expect(await fixture.rows("public.commercial_handoffs")).toHaveLength(1);
  });
  test("concurrent UUID aliases share every production record and receipt", async () => {
    await seedApproved();
    const results = await Promise.all([ID.brief, `{${ID.brief}}`, ID.brief.toUpperCase(), ID.brief.replace(/-/g, "")].map(run));
    results.forEach((r) => expect(r.error).toBeNull());
    expect(new Set(results.map((r) => r.project?.id)).size).toBe(1);
    for (const table of ["co_production.projects", "co_production.inquiries", "co_production.organizations", "co_production.contacts", "public.events", "public.commercial_handoffs"]) expect(await fixture.rows(table)).toHaveLength(1);
    expect(await fixture.rows("co_production.deliverables")).toHaveLength(2);
  });
  test.each(["co_production.projects", "co_production.deliverables", "public.events", "public.commercial_handoffs"])("resumes after %s fails and preserves edited work", async (table) => {
    await seedApproved(); fixture.fail(table);
    const first = await run(); expect(first.error).toBeTruthy(); expect(first.partial).toBe(true); expect(first.retryable).toBe(true);
    await pg.exec(`UPDATE co_production.deliverables SET name='Operator renamed item', status='qc'`);
    const ids = (await fixture.rows("co_production.projects")).map((r) => r.id);
    const second = await run(); expect(second.error).toBeNull();
    if (ids.length) expect(second.project?.id).toBe(ids[0]);
    expect(await fixture.rows("co_production.projects")).toHaveLength(1);
    expect(await fixture.rows("co_production.deliverables")).toHaveLength(2);
    const edits = (await fixture.rows("co_production.deliverables")).filter((d) => d.status === "qc");
    edits.forEach((d) => expect(d.name).toBe("Operator renamed item"));
  });
  test("resumes when receipt insert committed but its response was lost", async () => {
    await seedApproved(); fixture.fail("public.commercial_handoffs", "insert", true);
    expect((await run()).error).toBeTruthy();
    const result = await run(); expect(result).toMatchObject({ error: null, replayed: true });
    expect(await fixture.rows("public.commercial_handoffs")).toHaveLength(1);
  });
  test.each(["missing-owner", "invalid-owner", "unknown-owner", "missing-approval", "wrong-version", "wrong-hash", "acs"])("blocks %s before any writes", async (kind) => {
    await seedApproved(); const input = deps();
    if (kind === "missing-owner") input.env.CVP_OWNER_USER_ID = "";
    if (kind === "invalid-owner") input.env.CVP_OWNER_USER_ID = "invented-owner";
    if (kind === "unknown-owner") input.env.CVP_OWNER_USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    if (kind === "missing-approval") await pg.exec(`DELETE FROM public.estimate_decisions`);
    if (kind === "wrong-version") {
      await pg.query(`INSERT INTO public.estimates(id,brief_id,estimate_number) VALUES ('66666666-6666-4666-8666-666666666666',$1,'OTHER')`, [ID.brief]);
      await pg.exec(`UPDATE public.estimate_versions SET estimate_id='66666666-6666-4666-8666-666666666666'`);
    }
    if (kind === "wrong-hash") await pg.exec(`UPDATE public.estimate_versions SET sha256=repeat('a',64)`);
    if (kind === "acs") await pg.exec(`UPDATE public.estimates SET business_unit='ACS'`);
    const result = await handoffEstimateToCoVideoPro({ estimateId: ID.estimate }, input);
    expect(result.error).toBeTruthy(); expect(result.retryable).toBe(false); expect(fixture.mutations).toHaveLength(0);
  });
});
