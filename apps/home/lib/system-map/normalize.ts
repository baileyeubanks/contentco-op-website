import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SystemMapConflict, SystemMapSourceRef } from "./contracts";

const FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(FILE_DIR, "../../../../..");

export const AUTHORITY_CHARTER_LOCATION = path.join(
  WORKSPACE_ROOT,
  "root",
  "governance",
  "production-truth",
  "AUTHORITY_CHARTER.md",
);

export const ROOT_SYSTEM_SOURCE_LOCATION = path.join(
  WORKSPACE_ROOT,
  "contentco-op",
  "monorepo",
  "apps",
  "home",
  "lib",
  "root-system.ts",
);

export const LIVE_SYSTEM_NODE_IDS = [
  "bailey",
  "caio",
  "blaze-hermes",
  "root",
  "paperclip",
  "m2",
  "m4",
  "supabase",
  "nas",
  "blaze-phone",
  "cco-home",
  "root-mount",
  "acs",
  "coscript",
  "cocut",
  "codeliver",
  "imessage",
  "gmail",
  "telegram",
] as const;

export type RuntimeClaimSnapshot = {
  machine: {
    public_apps?: string | null;
    runtime?: string | null;
  };
  runtime: {
    machine_roles?: Record<string, string | null | undefined>;
  };
};

export type RuntimeNormalization = {
  machinePublicApps: string;
  machineRoles: Record<string, string>;
  conflicts: SystemMapConflict[];
};

function makeSourceRef(
  label: string,
  location: string,
  status: "canonical" | "healthy" | "attention" | "critical",
  detail?: string,
): SystemMapSourceRef {
  return { label, location, status, detail };
}

export function normalizeLegacyRuntimeClaims(
  runtimeSnapshot: RuntimeClaimSnapshot,
): RuntimeNormalization {
  const machineRoles = {
    ...(runtimeSnapshot.runtime.machine_roles || {}),
  } as Record<string, string>;
  const conflicts: SystemMapConflict[] = [];
  const publicApps = String(runtimeSnapshot.machine.public_apps || "");
  const nasRole = String(machineRoles.nas || "");
  const runtimeMachine = String(runtimeSnapshot.machine.runtime || "");

  if (runtimeMachine && runtimeMachine !== "M4") {
    conflicts.push({
      id: "legacy-runtime-authority",
      title: "Runtime authority drift",
      severity: "critical",
      detail: `Runtime authority reported ${runtimeMachine} instead of M4.`,
      sourceRefs: [
        makeSourceRef("Runtime Snapshot", ROOT_SYSTEM_SOURCE_LOCATION, "critical", `Reported runtime=${runtimeMachine}.`),
        makeSourceRef("Authority Charter", AUTHORITY_CHARTER_LOCATION, "canonical", "M4 is the only live runtime authority."),
      ],
    });
  }

  if (publicApps.toLowerCase().includes("nas")) {
    conflicts.push({
      id: "legacy-nas-public-apps",
      title: "Legacy NAS public-apps claim",
      severity: "critical",
      detail: "NAS appeared as public-app authority in runtime output. The map quarantines that claim and restores M4 as live authority.",
      sourceRefs: [
        makeSourceRef("Runtime Snapshot", ROOT_SYSTEM_SOURCE_LOCATION, "critical", `Reported public_apps=${publicApps}.`),
        makeSourceRef("Authority Charter", AUTHORITY_CHARTER_LOCATION, "canonical", "NAS is storage and archive only."),
      ],
    });
  }

  if (/public apps|public_apps|root/i.test(nasRole)) {
    conflicts.push({
      id: "legacy-nas-machine-role",
      title: "Legacy NAS machine-role leak",
      severity: "attention",
      detail: "NAS machine role attempted to claim runtime or public-surface ownership.",
      sourceRefs: [
        makeSourceRef("Runtime Snapshot", ROOT_SYSTEM_SOURCE_LOCATION, "attention", `Reported nas role=${nasRole}.`),
        makeSourceRef("Authority Charter", AUTHORITY_CHARTER_LOCATION, "canonical", "NAS is never runtime authority."),
      ],
    });
  }

  return {
    machinePublicApps: publicApps.toLowerCase().includes("nas") ? "M4" : publicApps || "M4",
    machineRoles: {
      m2: machineRoles.m2 || "authoring + staging",
      m4: machineRoles.m4 || "live runtime + root + public surfaces",
      nas: /public apps|public_apps|root/i.test(nasRole) ? "storage + archive + media support" : nasRole || "storage + archive + media support",
    },
    conflicts,
  };
}
