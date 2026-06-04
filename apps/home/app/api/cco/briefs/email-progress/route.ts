import { NextResponse } from "next/server";
import { getCcoFirebaseAdminStatus, getCcoFirebaseApp } from "@/lib/cco-firebase-server";
import { getFirestore } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

function progressReminderId(email: string) {
  const safe = email.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 90);
  return `brief_progress_${safe || globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 18)}`;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const action = String(body.action || "schedule").trim().toLowerCase();
  const draft = body.draft as Record<string, unknown> | undefined;

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
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
    const emailId = progressReminderId(email);

    if (action === "cancel") {
      await db.collection("emailOutbox").doc(emailId).set({
        id: emailId,
        template: "brief_progress_reminder",
        to: [email],
        status: "cancelled",
        cancelledAt: now,
        updatedAt: now,
        metadata: { source: "contentco-op.com/brief", reason: "brief_submitted" },
      }, { merge: true });

      return NextResponse.json({ ok: true, emailId, status: "cancelled" });
    }

    const scheduledFor = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await db.collection("emailOutbox").doc(emailId).set({
      id: emailId,
      template: "brief_progress_reminder",
      to: [email],
      status: "scheduled",
      subject: "Want to finish your Content Co-op brief?",
      body: `Hi there,\n\nWe saved your Content Co-op creative brief progress. If the project is still active, you can pick it back up here:\n\nhttps://contentco-op.com/brief\n\nIf you already submitted it, you can ignore this.\n\n— Content Co-op`,
      metadata: { draft, source: "contentco-op.com/brief", reminderDelayMinutes: 60 },
      scheduledFor,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });

    return NextResponse.json({
      ok: true,
      emailId,
      status: "scheduled",
      scheduledFor,
    });
  } catch (err) {
    console.error("[email-progress] Failed:", err);
    return NextResponse.json(
      { error: "email_queue_failed", message: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}
