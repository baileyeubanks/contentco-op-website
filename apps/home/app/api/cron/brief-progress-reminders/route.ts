import { NextResponse } from "next/server";
import { getCcoFirebaseAdminStatus, getCcoFirebaseApp } from "@/lib/cco-firebase-server";
import { getFirestore } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

function isAuthorized(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret && process.env.NODE_ENV === "production") return false;
  if (!cronSecret) return true;

  const authHeader = req.headers.get("authorization");
  const { searchParams } = new URL(req.url);
  const token = authHeader?.replace("Bearer ", "") || searchParams.get("secret");
  return token === cronSecret;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const status = getCcoFirebaseAdminStatus();
  const app = getCcoFirebaseApp();

  if (!status.configured || !app) {
    return NextResponse.json(
      { error: "firebase_not_configured", mode: status.mode },
      { status: 503 },
    );
  }

  const db = getFirestore(app);
  const now = new Date().toISOString();
  const snapshot = await db
    .collection("emailOutbox")
    .where("status", "==", "scheduled")
    .limit(100)
    .get();

  let promoted = 0;
  let skipped = 0;

  await Promise.all(snapshot.docs.map(async (doc) => {
    const data = doc.data();
    if (data.template !== "brief_progress_reminder") {
      skipped += 1;
      return;
    }
    if (data.cancelledAt || String(data.scheduledFor || "") > now) {
      skipped += 1;
      return;
    }

    promoted += 1;
    await doc.ref.set({
      status: "queued",
      queuedAt: now,
      updatedAt: now,
    }, { merge: true });
  }));

  return NextResponse.json({
    ok: true,
    evaluated: snapshot.size,
    promoted,
    skipped,
    timestamp: now,
  });
}
