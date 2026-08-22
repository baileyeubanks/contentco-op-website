export function validateRuntimeProofBody(bodyText, expectSha = "") {
  const body = JSON.parse(bodyText);
  const buildId = String(body.build_id || "");
  const expectedBuildId = String(expectSha || "");
  if (body.status !== "ok") {
    throw new Error(`status=${body.status || "unknown"}`);
  }
  if (!buildId) {
    throw new Error("build_id missing");
  }
  if (expectedBuildId && buildId !== expectedBuildId) {
    throw new Error(`expected build_id ${expectedBuildId}; got ${buildId}`);
  }
  return {
    buildId,
    releaseTimestamp: String(body.release_timestamp || ""),
    runtimeDir: String(body.runtime_dir || ""),
  };
}

export function validatePublishedRef(
  remoteOutput,
  expectSha,
  expectedRef = "refs/heads/main",
  label = "published ref",
) {
  const expectedSha = String(expectSha || "");
  if (!expectedSha) {
    throw new Error(`${label}: expected SHA missing`);
  }
  const refName = String(expectedRef || "");
  if (!refName) {
    throw new Error(`${label}: expected ref missing`);
  }
  const entries = String(remoteOutput || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([0-9a-fA-F]+)\s+(\S+)$/);
      if (!match) {
        throw new Error(`${label}: malformed ls-remote output`);
      }
      return { sha: match[1], ref: match[2] };
    });
  const matchingEntries = entries.filter((entry) => entry.ref === refName);
  if (matchingEntries.length !== 1) {
    throw new Error(
      `${label}: expected exactly one ${refName} entry; got ${matchingEntries.length}`,
    );
  }
  const publishedSha = matchingEntries[0].sha;
  if (publishedSha !== expectedSha) {
    throw new Error(`${label} reports ${publishedSha || "no SHA"}; expected ${expectedSha}`);
  }
  return publishedSha;
}
