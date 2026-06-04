import { describe, expect, test } from "vitest";
import { renderSystemMapHtml } from "../system-map/render";
import { SYSTEM_MAP_LAYOUT } from "../system-map/presentation";
import {
  LIVE_SYSTEM_NODE_IDS,
  normalizeLegacyRuntimeClaims,
} from "../system-map/normalize";
import type { SystemMapSnapshot } from "../system-map/contracts";

describe("system map normalization", () => {
  test("legacy NAS runtime claims become conflicts instead of truth", () => {
    const normalized = normalizeLegacyRuntimeClaims({
      machine: {
        authoring: "M2",
        runtime: "M4",
        public_apps: "NAS",
        node_version: "v25.8.2",
      },
      runtime: {
        host: "root.contentco-op.com",
        app_version: "0.1.0",
        node_env: "production",
        default_business_unit: "CC",
        auth_mode: "email_password",
        channels: ["telegram", "imessage"],
        disabled_channels: ["whatsapp"],
        models: {
          primary: "gemini",
          research: "gemini-pro",
          fallback: "gpt",
        },
        machine_roles: {
          m2: "authoring + deer",
          m4: "blaze runtime",
          nas: "public apps + root",
        },
      },
    } as never);

    expect(normalized.machinePublicApps).toBe("M4");
    expect(normalized.machineRoles.nas).toBe("storage + archive + media support");
    expect(normalized.conflicts.map((conflict) => conflict.id)).toEqual(
      expect.arrayContaining(["legacy-nas-public-apps", "legacy-nas-machine-role"]),
    );
  });

  test("live graph template excludes langgraph and deer-flow nodes", () => {
    expect(LIVE_SYSTEM_NODE_IDS.join(" ")).not.toMatch(/langgraph|deer-flow/i);
    expect(Object.keys(SYSTEM_MAP_LAYOUT).join(" ")).not.toMatch(/langgraph|deer-flow/i);
  });
});

describe("system map render contract", () => {
  test("html renderer includes snapshot graph, conflicts, and timestamps", () => {
    const snapshot: SystemMapSnapshot = {
      meta: {
        generatedAt: "2026-04-11T18:30:00.000Z",
        refreshIntervalMs: 60_000,
        sourceFreshness: "Live runtime collected inline.",
        overallStatus: "attention",
      },
      graph: {
        nodes: [
          {
            id: "m4",
            label: "M4 Runtime",
            kind: "machine",
            status: "healthy",
            authorityLevel: "runtime",
            detail: "Live runtime authority.",
            sourceRefs: [],
          },
          {
            id: "root",
            label: "Root",
            kind: "control",
            status: "attention",
            authorityLevel: "control_plane",
            detail: "Control plane.",
            sourceRefs: [],
          },
        ],
        edges: [
          {
            id: "publish",
            from: "m4",
            to: "root",
            flowType: "publish",
            status: "healthy",
            label: "targeted publish",
            direction: "one_way",
          },
        ],
      },
      panels: [
        {
          id: "runtime",
          title: "Runtime",
          summary: "Runtime summary",
          items: [
            {
              id: "runtime-m4",
              title: "M4 authority",
              status: "healthy",
              summary: "M4 is clean.",
            },
          ],
        },
      ],
      checks: [
        {
          id: "runtime-check",
          group: "runtime",
          label: "Runtime check",
          status: "healthy",
          detail: "ok",
          source: "/api/root/system-map",
        },
      ],
      conflicts: [
        {
          id: "legacy",
          title: "Legacy runtime drift",
          severity: "attention",
          detail: "Old claim still exists.",
          sourceRefs: [],
        },
      ],
      actions: [],
    };

    const html = renderSystemMapHtml(snapshot);

    expect(html).toContain("Blaze System State");
    expect(html).toContain("2026-04-11T18:30:00.000Z");
    expect(html).toContain("M4 Runtime");
    expect(html).toContain("targeted publish");
    expect(html).toContain("Legacy runtime drift");
  });
});
