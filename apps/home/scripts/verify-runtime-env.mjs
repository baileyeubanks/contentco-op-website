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
