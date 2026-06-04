import { NextResponse } from "next/server";
import { buildCcoAdminReadModel } from "@/lib/cco-admin-model";
import { renderCreativeBriefProposalPdf } from "@/lib/creative-brief-proposal-pdf";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const model = buildCcoAdminReadModel();
  const estimate = model.queues.estimates.find((item) => item.id === id) || model.queues.estimates[0];
  const brief = model.queues.briefs.find((item) => item.id === estimate.briefId) || model.queues.briefs[0];
  const person = model.queues.leads.find((item) => item.id === brief.personId) || model.queues.leads[0];

  const pdf = await renderCreativeBriefProposalPdf({
    brief: {
      contact_name: person.fullName,
      contact_email: person.email,
      phone: person.phone,
      company: "Content Co-op lead",
      role: brief.projectName,
      content_type: brief.projectTypes.join(", "),
      audience: brief.audience,
      tone: brief.goal,
      deadline: brief.timeline,
      objective: brief.goal,
      key_messages: brief.projectContext,
      references: brief.successDefinition,
      constraints: `${brief.deliverables.join(", ")} | ${brief.placements.join(", ")}`,
    },
    quote: {
      id: estimate.id,
      quote_number: estimate.estimateNumber,
      estimated_total: estimate.totalCents / 100,
    },
    bookingUrl: "/book",
  });

  return new NextResponse(pdf.buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pdf.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
