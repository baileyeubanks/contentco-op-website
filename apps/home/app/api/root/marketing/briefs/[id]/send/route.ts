import { NextResponse } from "next/server";
import { getCcoFirebaseAdminStatus, getCcoFirebaseApp } from "@/lib/cco-firebase-server";
import { getFirestore } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const toEmail = String(body.to || "").trim().toLowerCase();
  if (!toEmail || !/^\S+@\S+\.\S+$/.test(toEmail)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const status = getCcoFirebaseAdminStatus();
  const app = getCcoFirebaseApp();
  if (!status.configured || !app) {
    return NextResponse.json(
      { error: "firebase_not_configured", mode: status.mode },
      { status: 503 }
    );
  }

  try {
    const db = getFirestore(app);
    const now = new Date().toISOString();

    // Fetch the proposal
    const proposalsSnap = await db
      .collection("proposalVersions")
      .where("briefId", "==", id)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (proposalsSnap.empty) {
      return NextResponse.json({ error: "proposal_not_found" }, { status: 404 });
    }

    const proposal = proposalsSnap.docs[0].data();
    const proposalId = proposalsSnap.docs[0].id;
    const aiProposal = (proposal.snapshot?.aiProposal || {}) as Record<string, unknown>;
    const estimate = (proposal.snapshot?.estimate || {}) as Record<string, unknown>;

    const proposalUrl = `https://contentco-op.com/brief/proposal/${id}`;
    const subject = `Creative Proposal — ${String(aiProposal.title || "Your Video Project")}`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;line-height:1.6;color:#1a1a1a;max-width:600px;margin:0 auto;padding:2rem;">
  <div style="text-align:center;margin-bottom:2rem;">
    <strong style="font-size:1.2rem;color:#0c1322;">Content Co-op</strong>
  </div>
  <h1 style="font-size:1.4rem;color:#0c1322;margin-bottom:0.5rem;">Your proposal is ready</h1>
  <p style="color:#666;">We've prepared a creative proposal based on your brief. Here's a summary:</p>
  <div style="background:#f8f9fa;border-radius:12px;padding:1.25rem;margin:1.5rem 0;">
    <h2 style="font-size:1.1rem;color:#0c1322;margin:0 0 0.5rem;">${String(aiProposal.title || "Creative Proposal")}</h2>
    <p style="color:#444;font-size:0.95rem;margin:0 0 1rem;">${String((aiProposal.executiveSummary as string) || "").slice(0, 200)}...</p>
    <div style="display:flex;gap:1rem;flex-wrap:wrap;font-size:0.9rem;color:#666;">
      <span>Estimate: <strong style="color:#0c1322;">$${Number(estimate.low || 0).toLocaleString()} – $${Number(estimate.high || 0).toLocaleString()}</strong></span>
      <span>Deposit: <strong style="color:#0c1322;">$${Number(estimate.deposit || 0).toLocaleString()}</strong></span>
    </div>
  </div>
  <div style="text-align:center;margin:2rem 0;">
    <a href="${proposalUrl}" style="display:inline-block;background:#4c8ef5;color:#fff;padding:0.9rem 2rem;border-radius:999px;text-decoration:none;font-weight:600;font-size:0.95rem;">View Full Proposal</a>
  </div>
  <p style="color:#888;font-size:0.85rem;text-align:center;">Questions? Reply to this email or call us at 501-351-5927.</p>
  <hr style="border:none;border-top:1px solid rgba(0,0,0,0.08);margin:2rem 0;" />
  <p style="color:#aaa;font-size:0.75rem;text-align:center;">Content Co-op · Houston, TX · <a href="https://contentco-op.com" style="color:#4c8ef5;">contentco-op.com</a></p>
</body>
</html>
`;

    // Store in emailOutbox for processing
    const emailId = `email_${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 18)}`;
    await db.collection("emailOutbox").doc(emailId).set({
      id: emailId,
      template: "proposal_sent",
      to: [toEmail],
      status: "queued",
      subject,
      html: htmlBody,
      metadata: {
        briefId: id,
        proposalId,
        proposalUrl,
        source: "admin.proposal.send",
      },
      createdAt: now,
    });

    // Update proposal status
    await db.collection("proposalVersions").doc(proposalId).update({
      status: "sent",
      sentAt: now,
      sentTo: toEmail,
      updatedAt: now,
    });

    return NextResponse.json({
      ok: true,
      emailId,
      message: `Proposal queued for sending to ${toEmail}.`,
    });
  } catch (err) {
    console.error("[admin/send] Failed:", err);
    return NextResponse.json(
      { error: "send_failed", message: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}
