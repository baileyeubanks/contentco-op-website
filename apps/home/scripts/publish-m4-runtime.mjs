#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertPortableStandalone } from "./assert-portable-standalone.mjs";
import { removeStandaloneBuild } from "./prepare-standalone-build.mjs";

const __filename = fileURLToPath(import.meta.url);
const appRoot = path.resolve(path.dirname(__filename), "..");
const repoRoot = path.resolve(appRoot, "../..");
const host = process.env.CCO_M4_HOST || "_mxappservice@Blaze.local";
const runtimeHome = "/Users/_mxappservice/.contentco-op/home-runtime";
const strictIpv6 = process.argv.includes("--strict-ipv6");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    encoding: "utf8",
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}

function capture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `${command} failed`).trim());
  }
  return result.stdout.trim();
}

function ssh(script) {
  run("ssh", ["-o", "BatchMode=yes", host, "bash", "-s"], {
    input: script,
    stdio: ["pipe", "inherit", "inherit"],
  });
}

const sha = capture("git", ["rev-parse", "HEAD"]);
const shortSha = sha.slice(0, 12);

function assertSourceIdentity(stage) {
  const currentSha = capture("git", ["rev-parse", "HEAD"]);
  if (currentSha !== sha) {
    throw new Error(`${stage}: HEAD changed from ${sha} to ${currentSha}`);
  }
  const dirty = capture("git", ["status", "--short"]);
  if (dirty) {
    throw new Error(`${stage}: working tree has uncommitted changes`);
  }
}

assertSourceIdentity("before build");

const standaloneDir = path.join(appRoot, ".next", "standalone");
const nextEnvPath = path.join(appRoot, "next-env.d.ts");
const nextEnvSnapshot = fs.readFileSync(nextEnvPath);
try {
  run("npm", ["run", "ops:portfolio"]);
  run("npm", ["run", "ops:pwa"]);
  run("npm", ["run", "typecheck", "-w", "@contentco-op/home"]);
  removeStandaloneBuild(appRoot);
  run("npm", ["run", "build", "-w", "@contentco-op/home"]);
} finally {
  fs.writeFileSync(nextEnvPath, nextEnvSnapshot);
}
assertSourceIdentity("after build");

if (!fs.existsSync(path.join(standaloneDir, "apps", "home", "server.js"))) {
  throw new Error(`missing standalone build at ${standaloneDir}`);
}
assertPortableStandalone(standaloneDir);

const releaseDir = `${runtimeHome}/releases/${shortSha}`;
run("rsync", [
  "-az",
  "--delete",
  "--exclude=.DS_Store",
  "--exclude=.next/cache",
  `${standaloneDir}/`,
  `${host}:${releaseDir}/`,
]);

ssh(`set -euo pipefail
runtime="${runtimeHome}"
release="${releaseDir}"
sha="${sha}"
test -f "$release/apps/home/server.js"
validate_health_file() {
  python3 - "$1" <<'PY'
import json
import sys
from pathlib import Path

try:
    body = json.loads(Path(sys.argv[1]).read_text())
except Exception:
    sys.exit(1)

summary = body.get("summary") or {}
failed = [
    check for check in body.get("checks", [])
    if check.get("status") in {"fail", "critical", "missing"}
]

if body.get("status") != "healthy" or int(summary.get("fail") or 0) or int(summary.get("missing") or 0) or failed:
    sys.exit(1)
PY
}
validate_runtime_proof_file() {
  python3 - "$1" "$sha" <<'PY'
import json
import sys
from pathlib import Path

try:
    body = json.loads(Path(sys.argv[1]).read_text())
except Exception:
    sys.exit(1)

if body.get("status") != "ok" or str(body.get("build_id") or "") != sys.argv[2]:
    sys.exit(1)
PY
}
for env_file in .env.local .env.generated .env; do
  if [ -f "$runtime/current/apps/home/$env_file" ]; then
    cp "$runtime/current/apps/home/$env_file" "$release/apps/home/$env_file"
  fi
done
printf '%s\\n' "$sha" > "$release/BUILD_ID"
node_bin="$(command -v node || printf '/usr/local/bin/node')"
staged_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
python3 - <<PY
import json
from pathlib import Path

Path("$release/release.json").write_text(json.dumps({
    "stagedAt": "$staged_at",
    "runtimeHome": "$runtime",
    "currentDir": "$runtime/current",
    "sourceAppDir": "$release/apps/home",
    "sourceGitHead": "$sha",
    "sourceGitBranch": "main",
    "buildId": "$sha",
    "nodeBin": "$node_bin",
    "runtimeLabel": "ai.contentcoop.home-runtime",
    "port": 4100,
}, indent=2) + "\\n")
PY
preflight_port=""
for candidate_port in 4199 4201 4202 4203 4204 4205; do
  if ! lsof -nP -iTCP:"$candidate_port" -sTCP:LISTEN >/dev/null 2>&1; then
    preflight_port="$candidate_port"
    break
  fi
done
if [ -z "$preflight_port" ]; then
  printf 'no free preflight port found\\n' >&2
  exit 1
fi
mkdir -p "$runtime/logs"
(
  set -a
  for env_file in "$release/apps/home/.env.generated" "$release/apps/home/.env.local" "$release/apps/home/.env"; do
    if [ -f "$env_file" ]; then
      . "$env_file"
    fi
  done
  set +a
  cd "$release/apps/home"
  exec env \
    HOSTNAME="127.0.0.1" \
    PORT="$preflight_port" \
    NODE_ENV=production \
    CCO_RUNTIME_BUILD_ID="$sha" \
    CCO_RUNTIME_RELEASE_TIMESTAMP="$staged_at" \
    CCO_RUNTIME_CURRENT_DIR="$release" \
    CCO_RUNTIME_SOURCE_APP_DIR="$release/apps/home" \
    "$node_bin" "$release/apps/home/server.js"
) >"$runtime/logs/preflight-$sha.log" 2>&1 &
preflight_pid="$!"
cleanup_preflight() {
  if [ -n "$preflight_pid" ] && kill -0 "$preflight_pid" >/dev/null 2>&1; then
    kill "$preflight_pid" >/dev/null 2>&1 || true
    wait "$preflight_pid" >/dev/null 2>&1 || true
  fi
}
trap cleanup_preflight EXIT
preflight_ok=0
for i in $(seq 1 60); do
  if ! kill -0 "$preflight_pid" >/dev/null 2>&1; then
    printf 'preflight server exited early\\n' >&2
    tail -120 "$runtime/logs/preflight-$sha.log" >&2 || true
    exit 1
  fi
  if curl -fsS --max-time 10 "http://127.0.0.1:$preflight_port/api/health?scope=local" >/tmp/cco-home-preflight-health.json \
    && validate_health_file /tmp/cco-home-preflight-health.json \
    && curl -fsS --max-time 10 "http://127.0.0.1:$preflight_port/api/runtime-proof" >/tmp/cco-home-preflight-proof.json \
    && validate_runtime_proof_file /tmp/cco-home-preflight-proof.json; then
    preflight_ok=1
    break
  fi
  sleep 2
done
if [ "$preflight_ok" != "1" ]; then
  printf 'preflight health failed for %s on port %s\\n' "$sha" "$preflight_port" >&2
  if [ -s /tmp/cco-home-preflight-health.json ]; then
    cat /tmp/cco-home-preflight-health.json >&2
  fi
  tail -120 "$runtime/logs/preflight-$sha.log" >&2 || true
  exit 1
fi
previous=""
if [ -L "$runtime/current" ]; then
  previous="$(readlink "$runtime/current")"
  rm "$runtime/current"
elif [ -d "$runtime/current" ]; then
  previous="$runtime/previous-$(date +%Y%m%d%H%M%S)"
  mv "$runtime/current" "$previous"
fi
ln -s "$release" "$runtime/current"
launchctl kickstart -k "gui/$(id -u)/ai.contentcoop.home-runtime"
health_ok=0
for i in $(seq 1 60); do
  if curl -fsS --max-time 10 "http://127.0.0.1:4100/api/health?scope=local" >/tmp/cco-home-health.json \
    && validate_health_file /tmp/cco-home-health.json \
    && curl -fsS --max-time 10 "http://127.0.0.1:4100/api/runtime-proof" >/tmp/cco-home-proof.json \
    && validate_runtime_proof_file /tmp/cco-home-proof.json; then
    health_ok=1
    break
  fi
  sleep 2
done
if [ "$health_ok" = "1" ]; then
    python3 - <<PY
import json, shutil, time
from pathlib import Path
sha = "${sha}"
runtime = Path("${runtimeHome}")
current_release = Path("${releaseDir}").resolve()
receipt_dir = Path("/Users/_mxappservice/Projects/platform/run/deploy-receipts")
receipt_dir.mkdir(parents=True, exist_ok=True)
receipt_id = "cco_home"
(receipt_dir / f"{receipt_id}.json").write_text(json.dumps({
    "receipt_id": receipt_id,
    "surface": receipt_id,
    "status": "ok",
    "sha": sha,
    "build_id": sha[:12],
    "detail": "standalone runtime updated and local health passed",
    "authority": "codex_publish_m4_runtime",
    "runtime_host": "Blaze",
    "runtime_user": "_mxappservice",
    "updated_at": int(time.time()),
    "updated_at_iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
}, indent=2))
(receipt_dir / "root_control_plane.json").unlink(missing_ok=True)

releases_dir = runtime / "releases"
if releases_dir.exists():
    releases = [path for path in releases_dir.iterdir() if path.is_dir()]
    keep = set(sorted(releases, key=lambda path: path.stat().st_mtime, reverse=True)[:8])
    keep.add(current_release)
    for release_path in releases:
        if release_path.resolve() not in {path.resolve() for path in keep}:
            shutil.rmtree(release_path, ignore_errors=True)

logs_dir = runtime / "logs"
if logs_dir.exists():
    preflight_logs = sorted(logs_dir.glob("preflight-*.log"), key=lambda path: path.stat().st_mtime, reverse=True)
    for log_path in preflight_logs[20:]:
        log_path.unlink(missing_ok=True)
PY
    cat /tmp/cco-home-health.json
    exit 0
fi
printf 'local health failed or reported non-healthy status\\n' >&2
if [ -s /tmp/cco-home-health.json ]; then
  cat /tmp/cco-home-health.json >&2
fi
if [ -n "$previous" ] && [ -e "$previous" ]; then
  rm -f "$runtime/current"
  ln -s "$previous" "$runtime/current"
  launchctl kickstart -k "gui/$(id -u)/ai.contentcoop.home-runtime" || true
  printf 'rolled back to %s\\n' "$previous" >&2
fi
exit 1
`);

run("git", ["push", "origin", `HEAD:main`]);

const auditArgs = ["scripts/audit-public-runtime.mjs", `--expect-sha=${sha}`];
if (strictIpv6) auditArgs.push("--strict-ipv6");
run("node", auditArgs, { cwd: appRoot });

process.stdout.write(`[cco-publish] live commit ${sha} is published to https://contentco-op.com/\\n`);
