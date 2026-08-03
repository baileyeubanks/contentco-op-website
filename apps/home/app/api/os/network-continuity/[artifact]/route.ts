import fs from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";

export const dynamic = "force-dynamic";

const ARTIFACTS: Record<string, string> = {
  doctor: "/Users/baileyeubanks/Desktop/Projects/platform/run/network-doctor-latest.json",
  "incident-pack": "/Users/baileyeubanks/Desktop/Projects/platform/run/network-incident-pack.json",
  "burn-in-summary": "/Users/baileyeubanks/Desktop/Projects/platform/run/network-burn-in-summary.json",
  "route-state": "/Users/baileyeubanks/Desktop/Projects/platform/run/network-route-state.json",
  "tunnel-truth": "/Users/baileyeubanks/Desktop/Projects/platform/run/network-tunnel-truth.json",
  parity: "/Users/baileyeubanks/Desktop/Projects/platform/run/network-public-local-parity.json",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ artifact: string }> },
) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.network.continuity.read",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["system_config"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const { artifact } = await params;
  const filePath = ARTIFACTS[artifact];
  if (!filePath) {
    return NextResponse.json({ error: "Unknown continuity artifact" }, { status: 404 });
  }

  try {
    const raw = await fs.readFile(filePath, "utf8");
    return new NextResponse(raw, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "artifact_unavailable",
        artifact,
        path: filePath,
      },
      { status: 404 },
    );
  }
}
