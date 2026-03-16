import fs from "node:fs";
import path from "node:path";
import { resolveRootBrand, type RootBrandKey } from "@/lib/root-brand";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

type RootAuthFileConfig = {
  credentials: Map<string, string>;
  allowedEmails: string[];
  authorities: Record<RootBrandKey, string[]>;
  roles: Map<string, RootOperatorRole>;
};

export type RootOperatorRole =
  | "operator_admin"
  | "business_operator_cc"
  | "business_operator_acs"
  | "advanced_admin";

function getRootAuthConfigPathCandidates() {
  const cwd = process.cwd();
  return [
    process.env.ROOT_AUTH_BRIDGE_CONFIG_PATH?.trim() || "",
    "/Users/baileyeubanks/Desktop/Projects/acs/acs-website/.root-operator-auth.json",
    path.join(cwd, ".root-operator-auth.json"),
    path.resolve(cwd, "../../../../acs/acs-website/.root-operator-auth.json"),
    path.resolve(cwd, "../../../acs/acs-website/.root-operator-auth.json"),
    path.resolve(cwd, "../../acs/acs-website/.root-operator-auth.json"),
  ].filter(Boolean);
}

function readRootAuthFile(): RootAuthFileConfig | null {
  for (const candidate of getRootAuthConfigPathCandidates()) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const raw = fs.readFileSync(candidate, "utf8");
      const parsed = JSON.parse(raw);
      const credentials = new Map(
        Object.entries(parsed?.credentials || {})
          .map(([email, password]) => [normalizeEmail(email), String(password || "").trim()] as const)
          .filter((entry) => entry[0] && entry[1]),
      );
      if (!credentials.size) continue;
      const explicitAuthorities = parsed?.authorities && typeof parsed.authorities === "object"
        ? parsed.authorities as Record<string, unknown>
        : {};
      const authorities: Record<RootBrandKey, string[]> = {
        cc: Array.isArray(explicitAuthorities.cc)
          ? explicitAuthorities.cc.map((email) => normalizeEmail(String(email))).filter(Boolean)
          : [],
        acs: Array.isArray(explicitAuthorities.acs)
          ? explicitAuthorities.acs.map((email) => normalizeEmail(String(email))).filter(Boolean)
          : [],
      };
      const explicitRoles = parsed?.roles && typeof parsed.roles === "object"
        ? parsed.roles as Record<string, unknown>
        : {};
      const roles = new Map(
        Object.entries(explicitRoles)
          .map(([email, role]) => [normalizeEmail(email), String(role || "").trim()] as const)
          .filter((entry): entry is [string, RootOperatorRole] =>
            Boolean(entry[0]) &&
            (
              entry[1] === "operator_admin" ||
              entry[1] === "business_operator_cc" ||
              entry[1] === "business_operator_acs" ||
              entry[1] === "advanced_admin"
            ),
          ),
      );
      return {
        credentials,
        allowedEmails: Array.from(credentials.keys()),
        authorities,
        roles,
      };
    } catch {
      continue;
    }
  }

  return null;
}

export function getRootOperatorPassword() {
  return (
    process.env.CCO_ROOT_OPERATOR_PASSWORD?.trim() ||
    process.env.ROOT_OPERATOR_PASSWORD?.trim() ||
    ""
  );
}

function getConfiguredRootOperatorCredentials() {
  const raw = process.env.CCO_ROOT_OPERATOR_CREDENTIALS?.trim();
  if (!raw) {
    return readRootAuthFile()?.credentials || new Map();
  }
  const pairs = raw
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry): [string, string] | null => {
      const separatorIndex = entry.includes("=") ? entry.indexOf("=") : entry.indexOf(":");
      if (separatorIndex === -1) return null;
      const email = normalizeEmail(entry.slice(0, separatorIndex));
      const password = entry.slice(separatorIndex + 1).trim();
      if (!email || !password) return null;
      return [email, password];
    })
    .filter((entry): entry is [string, string] => Boolean(entry));
  return new Map(pairs);
}

export function getAllowedRootOperatorEmails() {
  const credentialEntries = getConfiguredRootOperatorCredentials();
  if (credentialEntries.size) {
    return Array.from(credentialEntries.keys());
  }
  const raw = process.env.CCO_ROOT_ALLOWED_EMAILS?.trim();
  if (!raw) return readRootAuthFile()?.allowedEmails || [];
  return raw
    .split(",")
    .map((item) => normalizeEmail(item))
    .filter(Boolean);
}

export function isAllowedRootOperatorEmail(email: string) {
  return getAllowedRootOperatorEmails().includes(normalizeEmail(email));
}

function parseAuthorityEmails(raw: string | null | undefined) {
  return String(raw || "")
    .split(",")
    .map((item) => normalizeEmail(item))
    .filter(Boolean);
}

function parseOperatorRole(raw: string | null | undefined): RootOperatorRole | null {
  const value = String(raw || "").trim();
  if (
    value === "operator_admin" ||
    value === "business_operator_cc" ||
    value === "business_operator_acs" ||
    value === "advanced_admin"
  ) {
    return value;
  }
  return null;
}

export function resolveRootAuthorityForHost(hostname?: string | null): RootBrandKey {
  return resolveRootBrand(hostname).key;
}

export function getAllowedRootOperatorEmailsForHost(hostname?: string | null) {
  const authority = resolveRootAuthorityForHost(hostname);
  const fileConfig = readRootAuthFile();
  const envSpecific =
    authority === "acs"
      ? parseAuthorityEmails(process.env.ROOT_ALLOWED_EMAILS_ACS)
      : parseAuthorityEmails(process.env.ROOT_ALLOWED_EMAILS_CC);

  if (envSpecific.length > 0) {
    return envSpecific;
  }

  const fileSpecific = fileConfig?.authorities?.[authority] || [];
  if (fileSpecific.length > 0) {
    return fileSpecific;
  }

  const configured = getAllowedRootOperatorEmails();
  return configured.filter((email) =>
    authority === "acs" ? email.endsWith("@astrocleanings.com") : email.endsWith("@contentco-op.com"),
  );
}

export function isEmailAuthorizedForRootHost(email: string, hostname?: string | null) {
  const normalizedEmail = normalizeEmail(email);
  return getAllowedRootOperatorEmailsForHost(hostname).includes(normalizedEmail);
}

export function getRootOperatorRoleForHost(email: string, hostname?: string | null): RootOperatorRole | null {
  const normalizedEmail = normalizeEmail(email);
  if (!isEmailAuthorizedForRootHost(normalizedEmail, hostname)) {
    return null;
  }

  const authority = resolveRootAuthorityForHost(hostname);
  const envRole = authority === "acs"
    ? parseOperatorRole(process.env.ROOT_OPERATOR_ROLE_ACS)
    : parseOperatorRole(process.env.ROOT_OPERATOR_ROLE_CC);
  if (envRole) {
    return envRole;
  }

  const fileRole = readRootAuthFile()?.roles.get(normalizedEmail);
  if (fileRole) {
    return fileRole;
  }

  return authority === "acs" ? "business_operator_acs" : "business_operator_cc";
}

export function isAdvancedRootOperatorForHost(email: string, hostname?: string | null) {
  const role = getRootOperatorRoleForHost(email, hostname);
  return role === "advanced_admin" || role === "operator_admin";
}

export function verifyRootOperatorCredentials(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);
  const credentialEntries = getConfiguredRootOperatorCredentials();
  if (credentialEntries.size) {
    return credentialEntries.get(normalizedEmail) === password;
  }
  const sharedPassword = getRootOperatorPassword();
  if (!sharedPassword) return false;
  return isAllowedRootOperatorEmail(normalizedEmail) && password === sharedPassword;
}

export function verifyRootOperatorCredentialsForHost(email: string, password: string, hostname?: string | null) {
  const normalizedEmail = normalizeEmail(email);
  if (!isEmailAuthorizedForRootHost(normalizedEmail, hostname)) {
    return false;
  }
  return verifyRootOperatorCredentials(normalizedEmail, password);
}
