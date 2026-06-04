import { NextResponse } from "next/server";
import { getRuntimeReleaseHeaders, getRuntimeReleaseProof } from "@/lib/runtime-release";

export const dynamic = "force-dynamic";

export async function GET() {
  const proof = getRuntimeReleaseProof();
  return NextResponse.json({
    status: "ok",
    build_id: proof.buildId,
    release_timestamp: proof.releaseTimestamp,
    runtime_dir: proof.runtimeDir,
    source_dir: proof.sourceDir,
    node_bin: proof.nodeBin,
  }, {
    status: 200,
    headers: getRuntimeReleaseHeaders(proof),
  });
}
