import { NextResponse } from "next/server";
import { getCcoFirebaseApp, getCcoFirebaseAdminStatus } from "@/lib/cco-firebase-server";
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
    const briefSnap = await db.collection("briefs").doc(id).get();
    if (!briefSnap.exists) {
      return NextResponse.json({ error: "brief_not_found" }, { status: 404 });
    }

    const brief = briefSnap.data() as Record<string, unknown>;

    // Fetch related records
    const personId = brief.personId as string;
    const organizationId = brief.organizationId as string | null;

    const [personSnap, orgSnap, estimatesSnap, proposalsSnap] = await Promise.all([
      personId ? db.collection("people").doc(personId).get() : Promise.resolve(null),
      organizationId ? db.collection("organizations").doc(organizationId).get() : Promise.resolve(null),
      db.collection("estimates").where("briefId", "==", id).orderBy("createdAt", "desc").limit(1).get(),
      db.collection("proposalVersions").where("briefId", "==", id).orderBy("createdAt", "desc").limit(1).get(),
    ]);

    const person = personSnap?.exists ? (personSnap.data() as Record<string, unknown>) : null;
    const organization = orgSnap?.exists ? (orgSnap.data() as Record<string, unknown>) : null;
    const estimate = estimatesSnap.docs[0]?.exists ? (estimatesSnap.docs[0].data() as Record<string, unknown>) : null;
    const proposalVersion = proposalsSnap.docs[0]?.exists ? (proposalsSnap.docs[0].data() as Record<string, unknown>) : null;

    return NextResponse.json({
      ok: true,
      brief,
      person,
      organization,
      estimate,
      proposalVersion,
    });
  } catch (err) {
    console.error("[briefs/[id]] Fetch failed:", err);
    return NextResponse.json(
      { error: "fetch_failed", message: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}
