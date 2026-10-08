import { constants, openSync, fstatSync, readFileSync, closeSync } from "node:fs";
#!/usr/bin/env node

const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_KEY",
  "CCO_SESSION_SECRET",
];

const OPTIONAL_ENV = [
  "BLAZE_API_URL|BLAZE_API_BASE_URL",
  "DEER_API_BASE_URL",
  "DEER_HEALTH_URL",
  "ALLOW_PRIVATE_RUNTIME_TARGETS",
  // Content Co-Op public intake (/brief). Without one of these the brief is
  // still persisted, but every admin alert and client receipt logs as failed.
  "RESEND_API_KEY|GOOGLE_OAUTH_TOKEN_FILE_BLAZE|GOOGLE_DWD_SERVICE_ACCOUNT_FILE",
  "CCO_SUPABASE_URL|SUPABASE_URL|NEXT_PUBLIC_SUPABASE_URL",
  "CCO_SUPABASE_SERVICE_ROLE_KEY|CCO_SUPABASE_SERVICE_KEY|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SERVICE_KEY",
  "CCO_ADMIN_ALERT_EMAILS",
  "GEMINI_API_KEY",
];

const BUILD_REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

function isKeySatisfied(spec) {
  if (!spec.includes("|")) {
    return process.env[spec]?.trim();
  }

  return spec.split("|").some((key) => process.env[key]?.trim());
}

function clientLinkKeyReason() {
  const path = process.env.CCO_CLIENT_LINK_KEY_FILE;
  if (!path) return "client_link_key_file_missing";
  let fd;
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = fstatSync(fd);
    if (!stat.isFile() || (stat.mode & 0o077) !== 0 || typeof process.getuid !== "function" || stat.uid !== process.getuid()) return "client_link_key_file_insecure";
    if (stat.size > 8192) return "client_link_key_file_invalid";
    const ids = new Set();
    for (const line of readFileSync(fd, "utf8").trim().split(/\r?\n/)) {
      const match = /^([a-z0-9]{1,8}) ([0-9a-fA-F]{64})$/.exec(line);
      if (!match || ids.has(match[1])) return "client_link_key_file_invalid";
      ids.add(match[1]);
    }
    return null;
  } catch { return "client_link_key_file_unreadable"; }
  finally { if (fd !== undefined) closeSync(fd); }
}
const keyReason = clientLinkKeyReason();
if (!process.argv.includes("--phase=build") && keyReason) {
  console.error(keyReason);
  process.exit(1);
}

const phase = process.argv.includes("--phase=build") ? "build" : "runtime";
const required = phase === "build" ? BUILD_REQUIRED_ENV : REQUIRED_ENV;
const missing = required.filter((spec) => !isKeySatisfied(spec));

if (missing.length === 0) {
  const optionalMissing = OPTIONAL_ENV.filter((spec) => !isKeySatisfied(spec));
  if (optionalMissing.length > 0) {
    console.warn("[cco-runtime] optional integrations not configured:");
    for (const key of optionalMissing) {
      console.warn(` - ${key}`);
    }
  }
  console.log(`[cco-runtime] all required ${phase} env vars present`);
  process.exit(0);
}

if (phase === "build") {
  console.warn("[cco-runtime] build proceeding with missing env vars:");
  for (const key of missing) {
    console.warn(` - ${key}`);
  }
  process.exit(0);
}

console.error("[cco-runtime] startup blocked: missing required env vars:");
for (const key of missing) {
  console.error(` - ${key}`);
}
process.exit(1);
