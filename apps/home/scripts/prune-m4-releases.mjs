#!/usr/bin/env node

// Dry run of the release prune that publish-m4-runtime.mjs runs after a swap.
// Prints exactly which M4 release dirs the next publish would delete, and
// deletes nothing. Only --dry-run is supported; the real prune runs only
// inside publish:live.
//
//   node apps/home/scripts/prune-m4-releases.mjs --dry-run            # before a publish (assumes 1 new release)
//   node apps/home/scripts/prune-m4-releases.mjs --dry-run --pending=0 # the state right now

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const host = process.env.CCO_M4_HOST || "_mxappservice@Blaze.local";
const runtimeHome = "/Users/_mxappservice/.contentco-op/home-runtime";
const keep = 8;

const argv = process.argv.slice(2);
if (!argv.includes("--dry-run")) {
  process.stderr.write("prune-m4-releases.mjs only supports --dry-run (the real prune runs inside publish:live)\n");
  process.exit(2);
}
const pendingArg = argv.find((arg) => arg.startsWith("--pending="));
const pending = pendingArg ? Number(pendingArg.slice("--pending=".length)) : 1;
if (!Number.isInteger(pending) || pending < 0) {
  process.stderr.write("--pending must be a whole number >= 0\n");
  process.exit(2);
}

const pruneSource = fs.readFileSync(path.join(scriptDir, "prune-releases.py"), "utf8");
if (/^PRUNE_PY$/m.test(pruneSource)) {
  throw new Error("prune-releases.py must not contain a line that is exactly PRUNE_PY");
}

const script = `set -euo pipefail
runtime="${runtimeHome}"
current="$(readlink "$runtime/current" || true)"
echo "[cco-prune] current -> \${current:-<none>}"
python3 - "$runtime/releases" --keep ${keep} --pending ${pending} --dry-run --protect "\${current:-}" <<'PRUNE_PY'
${pruneSource}
PRUNE_PY
`;

const result = spawnSync("ssh", ["-o", "BatchMode=yes", host, "bash", "-s"], {
  input: script,
  stdio: ["pipe", "inherit", "inherit"],
});
process.exit(result.status ?? 1);
