import { NextResponse } from "next/server";
import { getCcoFirebaseAdminStatus, getCcoFirebaseApp } from "@/lib/cco-firebase-server";
import { getFirestore } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
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
    return NextResponse.json({ ok: true, proposal });
  } catch (err) {
    console.error("[admin/proposal] Fetch failed:", err);
    return NextResponse.json(
      { error: "fetch_failed", message: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    const proposalsSnap = await db
      .collection("proposalVersions")
      .where("briefId", "==", id)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (proposalsSnap.empty) {
      return NextResponse.json({ error: "proposal_not_found" }, { status: 404 });
    }

    const docRef = proposalsSnap.docs[0].ref;
    const now = new Date().toISOString();

    const updates: Record<string, unknown> = {
      updatedAt: now,
    };

    if (body.status) updates.status = body.status;
    if (body.approvedBy) updates.approvedBy = body.approvedBy;
    if (body.approvedAt) updates.approvedAt = body.approvedAt;
    if (body.sentAt) updates.sentAt = body.sentAt;
    if (body.sentTo) updates.sentTo = body.sentTo;
    if (body.notes) updates.notes = body.notes;

    await docRef.update(updates);

    return NextResponse.json({ ok: true, updated: true });
  } catch (err) {
    console.error("[admin/proposal] Update failed:", err);
    return NextResponse.json(
      { error: "update_failed", message: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}
