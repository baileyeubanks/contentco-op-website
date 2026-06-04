import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";

function cleanString(value: string | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export function getCcoFirebaseClientConfig(): FirebaseOptions | null {
  const apiKey = cleanString(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
  const authDomain = cleanString(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);
  const projectId = cleanString(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  const storageBucket = cleanString(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
  const messagingSenderId = cleanString(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID);
  const appId = cleanString(process.env.NEXT_PUBLIC_FIREBASE_APP_ID);

  if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
  };
}

export function isCcoFirebaseClientConfigured() {
  return Boolean(getCcoFirebaseClientConfig());
}

export function getCcoFirebaseApp(): FirebaseApp | null {
  const config = getCcoFirebaseClientConfig();
  if (!config) return null;

  return getApps().length > 0 ? getApp() : initializeApp(config);
}
