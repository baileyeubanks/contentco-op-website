import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import type { CcoAdminRole, CcoFirestoreCollection } from "./cco-admin-model";

type FirestoreWrite = {
  collection: CcoFirestoreCollection;
  documentId: string;
  path: string;
  data: Record<string, unknown>;
};

type SeedAdmin = {
  email: string;
  role: CcoAdminRole;
  claim: string;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseServiceAccountJson() {
  const raw = cleanString(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    try {
      return JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as Record<string, string>;
    } catch {
      return null;
    }
  }
}

export function getCcoFirebaseAdminStatus() {
  const projectId = cleanString(
    process.env.CCO_FIREBASE_PROJECT_ID ||
      process.env.FIREBASE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  );
  const serviceAccount = parseServiceAccountJson();
  const hasCredential = Boolean(
    serviceAccount ||
      cleanString(process.env.GOOGLE_APPLICATION_CREDENTIALS) ||
      cleanString(process.env.FIREBASE_CONFIG),
  );

  return {
    projectId: projectId || null,
    configured: Boolean(projectId && hasCredential),
    mode: projectId && hasCredential ? "firestore_ready" as const : "local_contract" as const,
    credentialSource: serviceAccount
      ? "service_account_json"
      : cleanString(process.env.GOOGLE_APPLICATION_CREDENTIALS)
        ? "application_default_file"
        : cleanString(process.env.FIREBASE_CONFIG)
          ? "firebase_config"
          : "none",
  };
}

export function getCcoFirebaseApp() {
  const status = getCcoFirebaseAdminStatus();
  if (!status.configured || !status.projectId) return null;
  const existing = getApps().find((app) => app.name === "cco-admin");
  if (existing) return existing;

  const serviceAccount = parseServiceAccountJson();
  return initializeApp(
    {
      credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
      projectId: status.projectId,
    },
    "cco-admin",
  );
}

export async function commitCcoFirestoreWrites(writes: FirestoreWrite[]) {
  const status = getCcoFirebaseAdminStatus();
  const app = getCcoFirebaseApp();
  if (!status.configured || !app) {
    return {
      ok: true,
      mode: status.mode,
      committed: false,
      writeCount: 0,
      paths: writes.map((write) => write.path),
      note: "Firebase Admin is not configured, so this request returned the pristine Firestore write contract without mutating production.",
    };
  }

  const db = getFirestore(app);
  const batch = db.batch();
  for (const write of writes) {
    batch.set(db.collection(write.collection).doc(write.documentId), write.data, { merge: false });
  }
  await batch.commit();

  return {
    ok: true,
    mode: status.mode,
    committed: true,
    writeCount: writes.length,
    paths: writes.map((write) => write.path),
    note: "Firestore write batch committed with Firebase Admin credentials.",
  };
}

export async function previewCcoAdminClaimSeeds(admins: SeedAdmin[]) {
  const status = getCcoFirebaseAdminStatus();
  return admins.map((admin) => ({
    email: admin.email,
    role: admin.role,
    claim: admin.claim,
    ready: status.configured,
    mutationRequired: "manual_approval",
  }));
}

export async function setCcoAdminClaims(admins: SeedAdmin[]) {
  const app = getCcoFirebaseApp();
  if (!app) {
    return {
      ok: false,
      error: "firebase_admin_not_configured",
      seeded: [],
    };
  }

  const auth = getAuth(app);
  const seeded = [];
  for (const admin of admins) {
    const user = await auth.getUserByEmail(admin.email);
    await auth.setCustomUserClaims(user.uid, {
      ccoRole: admin.role,
      [admin.claim]: true,
    });
    seeded.push({ email: admin.email, uid: user.uid, role: admin.role, claim: admin.claim });
  }

  return { ok: true, seeded };
}
