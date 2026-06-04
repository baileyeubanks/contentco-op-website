import { NextResponse } from "next/server";
import { getCcoFirebaseAdminStatus } from "@/lib/cco-firebase-server";

export const dynamic = "force-dynamic";

function publicConfigStatus() {
  return {
    apiKey: Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    authDomain: Boolean(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || null,
    storageBucket: Boolean(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: Boolean(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
    appId: Boolean(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  };
}

export async function GET() {
  const admin = getCcoFirebaseAdminStatus();

  return NextResponse.json({
    ok: true,
    publicConfig: publicConfigStatus(),
    admin: {
      projectId: admin.projectId,
      configured: admin.configured,
      mode: admin.mode,
      credentialSource: admin.credentialSource,
    },
    writePath: admin.configured ? "firestore_commit" : "local_contract_preview",
  });
}
