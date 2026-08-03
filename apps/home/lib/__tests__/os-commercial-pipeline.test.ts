import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "vitest";
import { buildEstimateDraftFromBrief } from "../os-production-scope";
import {
  canRecordEstimateDecision,
  determineWorkflowStatusFromCommercialState,
  isReadyToSchedule,
} from "../os-estimates";
import { buildDocumentArtifactRows } from "../os-document-artifacts";

const sampleBrief = {
  structured_intake: {
    diagnostic: {
      main_video_count: "2",
      multiple_shoot_days: true,
      shoot_day_count: "2",
      need_cutdowns: true,
      cutdown_volume: "3",
      filming_locations: "2",
      travel_needed: true,
      travel_scope: "Texas regional",
      timeline: "ASAP",
      production_needs: ["Motion graphics", "Vertical versions"],
      target_runtime: "60-90 sec",
      polish_level: "Cinematic and premium",
      editing_style: "Edit with advanced motion design",
    },
    recommendation: {
      recommended_video_type: "Multi-Asset Campaign Package",
      next_step: "Approve estimate and issue deposit invoice.",
      starting_range_low: 12000,
      starting_range_high: 18000,
    },
    quote_signal: {
      starting_range_low: 12000,
      starting_range_high: 18000,
      rush: true,
    },
  },
};

test("brief draft produces structured line items and 50 percent deposit", () => {
  const draft = buildEstimateDraftFromBrief(sampleBrief);
  expect(draft.scopeItems.length).toBeGreaterThanOrEqual(5);
  expect(draft.lineItems.length).toBeGreaterThanOrEqual(5);
  expect(draft.lineItems.every((item) => item.line_total_cents >= 0)).toBe(true);
  expect(draft.totals.depositPercent).toBe(50);
  expect(draft.totals.depositDueCents).toBe(Math.round(draft.totals.totalCents * 0.5));
});

test("estimate approval is forbidden from draft before send", () => {
  const allowed = canRecordEstimateDecision({
    internalStatus: "draft",
    clientStatus: "not_sent",
    approvalStatus: "not_required",
    decision: "approved",
  });
  expect(allowed).toBe(false);
});

test("deposit readiness only turns ready_to_schedule after full payment or waiver", () => {
  expect(
    determineWorkflowStatusFromCommercialState({
      estimateApproved: true,
      invoiceIssued: true,
      paymentAmountCents: 250000,
      amountDueCents: 500000,
      waiverApproved: false,
    }),
  ).toBe("deposit_pending");
  expect(
    determineWorkflowStatusFromCommercialState({
      estimateApproved: true,
      invoiceIssued: true,
      paymentAmountCents: 500000,
      amountDueCents: 500000,
      waiverApproved: false,
    }),
  ).toBe("ready_to_schedule");
  expect(
    isReadyToSchedule({
      invoiceType: "deposit",
      paymentAmountCents: 250000,
      amountDueCents: 500000,
      waiverApproved: false,
    }),
  ).toBe(false);
  expect(
    isReadyToSchedule({
      invoiceType: "deposit",
      paymentAmountCents: 0,
      amountDueCents: 500000,
      waiverApproved: true,
    }),
  ).toBe(true);
});

test("artifact rows cover both pdf and docx outputs", () => {
  const rows = buildDocumentArtifactRows({
    sourceDocumentId: "11111111-1111-1111-1111-111111111111",
    businessUnit: "CC",
    documentType: "estimate",
    versionLabel: "v1",
    pdfPath: "/tmp/estimate.pdf",
    docxPath: "/tmp/estimate.docx",
    payload: {
      documentType: "estimate",
      documentNumber: "CC-EST-2026-0001",
      businessUnit: "CC",
      issueDate: "2026-04-11",
      title: "Content Co-op Estimate",
      customer: { name: "Client" },
      lineItems: [
        {
          description: "Main edit",
          quantity: 1,
          unit: "project",
          unit_price_cents: 250000,
          line_total_cents: 250000,
        },
      ],
      subtotalCents: 250000,
      taxCents: 0,
      totalCents: 250000,
    },
  });
  expect(rows).toHaveLength(2);
  expect(rows.map((row) => row.document_type)).toEqual(["estimate_pdf", "estimate_docx"]);
});

test("legacy quote pay confirm route no longer creates a job record", async () => {
  const filePath = path.join(process.cwd(), "app/api/client/quote/[id]/pay/confirm/route.ts");
  const source = await readFile(filePath, "utf8");
  expect(source.includes('.from("jobs")')).toBe(false);
  expect(source.includes('status: "scheduled"')).toBe(false);
});
