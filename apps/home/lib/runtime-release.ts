import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type RuntimeReleaseProof = {
  buildId: string;
  releaseTimestamp: string;
  runtimeDir: string;
  sourceDir: string;
  nodeBin: string;
};

function readReleaseJson(): Partial<RuntimeReleaseProof> {
  const releasePath = path.join(os.homedir(), ".contentco-op", "home-runtime", "current", "release.json");
  try {
    const raw = JSON.parse(fs.readFileSync(releasePath, "utf8"));
    return {
      buildId: String(raw?.buildId || ""),
      releaseTimestamp: String(raw?.stagedAt || ""),
      runtimeDir: String(raw?.currentDir || ""),
      sourceDir: String(raw?.sourceAppDir || ""),
      nodeBin: String(raw?.nodeBin || ""),
    };
  } catch {
    return {};
  }
}

export function getRuntimeReleaseProof(): RuntimeReleaseProof {
  const fromFile = readReleaseJson();
  return {
    buildId: String(process.env.CCO_RUNTIME_BUILD_ID || fromFile.buildId || ""),
    releaseTimestamp: String(process.env.CCO_RUNTIME_RELEASE_TIMESTAMP || fromFile.releaseTimestamp || ""),
    runtimeDir: String(process.env.CCO_RUNTIME_CURRENT_DIR || fromFile.runtimeDir || ""),
    sourceDir: String(process.env.CCO_RUNTIME_SOURCE_APP_DIR || fromFile.sourceDir || ""),
    nodeBin: String(process.env.CCO_RUNTIME_NODE_BIN || fromFile.nodeBin || process.execPath || ""),
  };
}

export function getRuntimeReleaseHeaders(proof: RuntimeReleaseProof): HeadersInit {
  return {
    "Cache-Control": "no-store",
    "X-CCO-Release-Build": proof.buildId || "unknown",
    "X-CCO-Release-Timestamp": proof.releaseTimestamp || "unknown",
    "X-CCO-Runtime-Dir": proof.runtimeDir || "unknown",
    "X-CCO-Source-Dir": proof.sourceDir || "unknown",
  };
}
