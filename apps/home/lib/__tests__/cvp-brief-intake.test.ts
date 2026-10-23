import { beforeEach, describe, expect, test } from "vitest";
import { createFakeSupabase, type FakeRow, type FakeSupabase } from "./helpers/fake-supabase";
import {
  CVP_BRIEF_INQUIRY_SOURCE,
  CVP_BRIEF_START_EVENT_TYPE,
  briefInquiryId,
  buildBriefInquirySummary,
  startBriefInCoVideoPro,
} from "../cvp-brief-intake";

const BRIEF_ID = "77777777-7777-4777-8777-777777777777";
const OTHER_BRIEF_ID = "88888888-8888-4888-8888-888888888888";
const CVP_OWNER = "66666666-6666-4666-8666-666666666666";
const OTHER_OWNER = "99999999-9999-4999-8999-999999999999";

let publicFake: FakeSupabase;
let cvpFake: FakeSupabase;

function seedBrief(overrides: FakeRow = {}, id = BRIEF_ID) {
  const rows = publicFake.store.get("creative_briefs") || [];
  rows.push({
    id,
    company_account_id: "content-co-op",
    brief_number: "CC-BRF-2026-0042",
    contact_name: "Jordan Client",
    contact_email: "Jordan@Example.com",
    company: "Client Co",
    objective: "Explain the new water-treatment line to plant managers",
    content_type: "Explainer",
    ...overrides,
  });
  publicFake.store.set("creative_briefs", rows);
}

function run(briefId = BRIEF_ID, env: Record<string, string | undefined> = { CVP_OWNER_USER_ID: CVP_OWNER }) {
  return startBriefInCoVideoPro({ briefId }, { sb: publicFake.client as never, cvpSb: cvpFake.client as never, env });
}

beforeEach(() => {
  publicFake = createFakeSupabase();
  // Mirror the live natural keys so ensure()'s 23505 → re-find branch is real.
  cvpFake = createFakeSupabase(undefined, {
    uniques: { organizations: ["owner_id", "name"], contacts: ["owner_id", "email"] },
  });
});

/** Wrap a fake client so the FIRST insert into `table` fails with a transient DB error. */
function failFirstInsert(fake: FakeSupabase, table: string) {
  let failed = false;
  return {
    from(name: string) {
      const real = fake.client.from(name);
      if (name !== table || failed) return real;
      return {
        ...real,
        select: real.select.bind(real),
        eq: real.eq.bind(real),
        insert() {
          failed = true;
          const result = { data: null, error: { message: "terminating connection", code: "57P01" } };
          return { select: () => ({ single: async () => result, maybeSingle: async () => result }) };
        },
      };
    },
  };
}

describe("cvp brief intake — website half of brief → Co-VideoPro", () => {
  test("creates org, contact, and a money-free inquiry from the brief; no project, no estimate link", async () => {
    seedBrief();
    const result = await run();

    expect(result.error).toBeNull();
    const receipt = result.receipt!;
    expect(receipt.replayed).toBe(false);
    expect(receipt.source).toBe(CVP_BRIEF_INQUIRY_SOURCE);
    expect(receipt.cvpInquiryId).toBe(briefInquiryId(BRIEF_ID));

    const orgs = cvpFake.store.get("organizations") || [];
    const contacts = cvpFake.store.get("contacts") || [];
    const inquiries = cvpFake.store.get("inquiries") || [];
    expect(orgs).toHaveLength(1);
    expect(orgs[0]).toMatchObject({ name: "Client Co", owner_id: CVP_OWNER });
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({ email: "jordan@example.com", name: "Jordan Client", organization_id: orgs[0].id, owner_id: CVP_OWNER });
    expect(inquiries).toHaveLength(1);
    expect(inquiries[0]).toMatchObject({
      id: briefInquiryId(BRIEF_ID), owner_id: CVP_OWNER, source: "cco_website_brief", status: "new",
      organization_id: orgs[0].id, contact_id: contacts[0].id,
    });
    expect(String(inquiries[0].summary)).toContain("CC-BRF-2026-0042");
    expect(String(inquiries[0].summary)).toContain("water-treatment");

    // The invariant this module exists to protect: no commercial authority here.
    expect(inquiries[0].commercial_total_cents).toBeNull();
    expect(inquiries[0].cco_estimate_id).toBeNull();
    expect(inquiries[0].cco_estimate_version_id).toBeNull();
    expect((inquiries[0].commercial_ref as FakeRow).brief_id).toBe(BRIEF_ID);
    expect((inquiries[0].commercial_ref as FakeRow)).not.toHaveProperty("totals");
    expect(inquiries[0].project_id).toBeUndefined();
    expect(cvpFake.store.get("projects") || []).toHaveLength(0);
    expect(cvpFake.store.get("deliverables") || []).toHaveLength(0);
    expect(publicFake.store.get("estimates") || []).toHaveLength(0);
    expect(publicFake.store.get("commercial_handoffs") || []).toHaveLength(0);

    const events = publicFake.store.get("events") || [];
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: CVP_BRIEF_START_EVENT_TYPE, business_unit: "CC", channel: "cco_os" });
    expect((events[0].payload as FakeRow).inquiry_id).toBe(inquiries[0].id);
  });

  test("is idempotent on brief id: a replay returns the same inquiry and writes nothing new", async () => {
    seedBrief();
    const first = await run();
    const second = await run();

    expect(second.error).toBeNull();
    expect(second.receipt?.replayed).toBe(true);
    expect(second.receipt?.cvpInquiryId).toBe(first.receipt?.cvpInquiryId);
    expect(second.receipt?.payloadHash).toBe(first.receipt?.payloadHash);
    expect(cvpFake.store.get("inquiries")).toHaveLength(1);
    expect(cvpFake.store.get("organizations")).toHaveLength(1);
    expect(cvpFake.store.get("contacts")).toHaveLength(1);
    expect(publicFake.store.get("events")).toHaveLength(1);
  });

  test("a retry after an events-stage failure finishes: the CCO OS start event is written on replay (review P2-1)", async () => {
    seedBrief();
    const flaky = failFirstInsert(publicFake, "events");
    const first = await startBriefInCoVideoPro({ briefId: BRIEF_ID },
      { sb: flaky as never, cvpSb: cvpFake.client as never, env: { CVP_OWNER_USER_ID: CVP_OWNER } });
    expect(first).toMatchObject({ error: "terminating connection", retryable: true, partial: true, stage: "event" });
    expect(cvpFake.store.get("inquiries")).toHaveLength(1);
    expect(publicFake.store.get("events") || []).toHaveLength(0);

    const retry = await startBriefInCoVideoPro({ briefId: BRIEF_ID },
      { sb: flaky as never, cvpSb: cvpFake.client as never, env: { CVP_OWNER_USER_ID: CVP_OWNER } });
    expect(retry.error).toBeNull();
    expect(retry.receipt?.replayed).toBe(true);
    expect(cvpFake.store.get("inquiries")).toHaveLength(1);
    const events = publicFake.store.get("events") || [];
    expect(events).toHaveLength(1);
    expect((events[0].payload as FakeRow).inquiry_id).toBe(retry.receipt?.cvpInquiryId);

    // A third call writes nothing further.
    await startBriefInCoVideoPro({ briefId: BRIEF_ID },
      { sb: publicFake.client as never, cvpSb: cvpFake.client as never, env: { CVP_OWNER_USER_ID: CVP_OWNER } });
    expect(publicFake.store.get("events")).toHaveLength(1);
  });

  test("a replayed inquiry without a payload hash is a link conflict, never an undefined receipt (review P3-1)", async () => {
    seedBrief();
    cvpFake.store.set("inquiries", [{
      id: briefInquiryId(BRIEF_ID), owner_id: CVP_OWNER, source: CVP_BRIEF_INQUIRY_SOURCE,
      commercial_ref: { brief_id: BRIEF_ID }, status: "new",
    }]);
    const result = await run();
    expect(result).toMatchObject({ error: "brief_inquiry_link_conflict", retryable: false });
    expect(publicFake.store.get("events") || []).toHaveLength(0);
  });

  test("repair records the saved inquiry payload when the brief changes before retry", async () => {
    seedBrief();
    const first = await startBriefInCoVideoPro({ briefId: BRIEF_ID }, {
      sb: failFirstInsert(publicFake, "events") as never,
      cvpSb: cvpFake.client as never,
      env: { CVP_OWNER_USER_ID: CVP_OWNER },
    });
    expect(first).toMatchObject({ retryable: true, partial: true, stage: "event" });
    const savedInquiry = structuredClone(cvpFake.store.get("inquiries")![0]);
    const savedHash = (savedInquiry.commercial_ref as FakeRow).payload_hash;
    publicFake.store.get("creative_briefs")![0].objective = "A changed objective after inquiry creation";

    const retry = await run();
    expect(retry).toMatchObject({ error: null, stage: "complete", receipt: { replayed: true, payloadHash: savedHash } });
    const events = publicFake.store.get("events")!;
    expect(events).toHaveLength(1);
    expect(events[0].payload).toMatchObject({ inquiry_id: savedInquiry.id, payload_hash: savedHash });
    expect(cvpFake.store.get("inquiries")).toEqual([savedInquiry]);

    const savedEvent = structuredClone(events[0]);
    expect((await run()).error).toBeNull();
    expect(publicFake.store.get("events")).toEqual([savedEvent]);
    expect(cvpFake.store.get("organizations")).toHaveLength(1);
    expect(cvpFake.store.get("contacts")).toHaveLength(1);
  });

  test("over-long company or contact name is blocked, matching the money path (review P3-5)", async () => {
    seedBrief({ company: "x".repeat(241) });
    expect(await run()).toMatchObject({ error: "brief_contact_invalid", retryable: false });
    expect(cvpFake.store.get("organizations") || []).toHaveLength(0);
  });

  test("two briefs from the same client share org and contact but get distinct inquiries", async () => {
    seedBrief();
    seedBrief({ brief_number: "CC-BRF-2026-0043", objective: "Recruiting film" }, OTHER_BRIEF_ID);
    const a = await run(BRIEF_ID);
    const b = await run(OTHER_BRIEF_ID);

    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    expect(a.receipt?.cvpInquiryId).not.toBe(b.receipt?.cvpInquiryId);
    expect(cvpFake.store.get("inquiries")).toHaveLength(2);
    expect(cvpFake.store.get("organizations")).toHaveLength(1);
    expect(cvpFake.store.get("contacts")).toHaveLength(1);
  });

  test("refuses to replay an inquiry that a commercial handoff has since bound to an estimate", async () => {
    seedBrief();
    await run();
    const inquiry = cvpFake.store.get("inquiries")![0];
    inquiry.commercial_total_cents = 500000;
    inquiry.cco_estimate_version_id = "44444444-4444-4444-8444-444444444444";

    const result = await run();
    expect(result).toMatchObject({ error: "brief_inquiry_commercially_bound", retryable: false });
    // Untouched: the money the estimate handoff wrote stays exactly as written.
    expect(cvpFake.store.get("inquiries")![0].commercial_total_cents).toBe(500000);
    expect(cvpFake.store.get("inquiries")).toHaveLength(1);
  });

  test("refuses when the deterministic inquiry id is held by a different owner", async () => {
    seedBrief();
    cvpFake.store.set("inquiries", [{
      id: briefInquiryId(BRIEF_ID), owner_id: OTHER_OWNER, source: CVP_BRIEF_INQUIRY_SOURCE,
      commercial_ref: { brief_id: BRIEF_ID, payload_hash: `sha256:${"0".repeat(64)}` }, status: "new",
    }]);
    const result = await run();
    expect(result).toMatchObject({ error: "brief_inquiry_link_conflict", retryable: false, partial: false });
    expect(cvpFake.store.get("organizations") || []).toHaveLength(0);
  });

  test("fails closed on a brief outside the Content Co-op company scope", async () => {
    seedBrief({ company_account_id: "astro-cleanings" });
    const result = await run();
    expect(result).toMatchObject({ error: "brief_scope_mismatch", retryable: false });
    expect(cvpFake.store.get("inquiries") || []).toHaveLength(0);
    expect(publicFake.store.get("events") || []).toHaveLength(0);
  });

  test("fails closed when the brief has no usable contact", async () => {
    seedBrief({ contact_email: "" });
    const result = await run();
    expect(result).toMatchObject({ error: "brief_contact_missing", retryable: false });
    expect(cvpFake.store.get("organizations") || []).toHaveLength(0);
  });

  test("fails closed without a configured CVP owner — never invents one", async () => {
    seedBrief();
    expect(await run(BRIEF_ID, {})).toMatchObject({ error: "cvp_owner_user_id_missing", retryable: false });
    expect(await run(BRIEF_ID, { CVP_OWNER_USER_ID: "not-a-uuid" })).toMatchObject({ error: "cvp_owner_user_id_invalid" });
    expect(cvpFake.store.get("organizations") || []).toHaveLength(0);
  });

  test("unknown or malformed brief ids are client errors, not retries", async () => {
    expect(await run(OTHER_BRIEF_ID)).toMatchObject({ error: "brief_not_found", retryable: false });
    expect(await run("nope")).toMatchObject({ error: "brief_id_invalid", retryable: false });
  });

  test("will not move an existing production contact into another organization", async () => {
    seedBrief();
    const otherOrg = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", owner_id: CVP_OWNER, name: "Somebody Else LLC" };
    cvpFake.store.set("organizations", [otherOrg]);
    cvpFake.store.set("contacts", [{ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", owner_id: CVP_OWNER, email: "jordan@example.com", name: "Jordan", organization_id: otherOrg.id }]);

    const result = await run();
    expect(result).toMatchObject({ error: "production_contact_organization_conflict", retryable: false });
    expect(cvpFake.store.get("organizations")).toHaveLength(1);
    expect(cvpFake.store.get("inquiries") || []).toHaveLength(0);
  });

  test("summary is human and money-free", () => {
    expect(buildBriefInquirySummary({ id: BRIEF_ID, brief_number: "CC-BRF-1", objective: "Explain X" })).toBe("Website CC-BRF-1: Explain X");
    expect(buildBriefInquirySummary({ id: BRIEF_ID, content_type: "Sizzle" })).toBe(`Website brief ${BRIEF_ID.slice(0, 8)}: Sizzle`);
    expect(buildBriefInquirySummary({ id: BRIEF_ID }).length).toBeLessThanOrEqual(240);
  });
});
