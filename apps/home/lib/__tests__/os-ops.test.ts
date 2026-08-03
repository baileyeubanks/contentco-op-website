import { expect, test } from "vitest";
import { runtimeCertificationTone } from "../os-runtime-certification";
import {
  getRootWorkspaceItem,
  getRootWorkspaceSection,
  runRootWorkspaceSheetAction,
  type RootWorkspaceSnapshot,
} from "../os-workspace";
import { __rootContactOpsTestUtils } from "../os-contact-ops";
import { __rootGoalsTestUtils } from "../os-goals";

test("runtime certification tone falls back to attention for unknown states", () => {
  expect(runtimeCertificationTone("healthy")).toBe("healthy");
  expect(runtimeCertificationTone("attention")).toBe("attention");
  expect(runtimeCertificationTone("critical")).toBe("critical");
  expect(runtimeCertificationTone(undefined)).toBe("attention");
});

test("workspace helpers return the expected section and item", () => {
  const snapshot: RootWorkspaceSnapshot = {
    meta: {
      generatedAt: "2026-04-12T00:00:00.000Z",
      refreshIntervalMs: 60_000,
      sourceFreshness: "test",
      overallStatus: "healthy",
      workspaceScope: "ALL",
      connectorMode: "stub",
    },
    tabs: [],
    connectors: [],
    actions: [],
    summary: {
      totalItems: 1,
      sectionsLoaded: 1,
      liveConnectors: 0,
      importableItems: 1,
    },
    sections: [
      {
        id: "drive",
        title: "Drive",
        summary: "Recent files",
        status: "healthy",
        emptyState: "none",
        items: [
          {
            id: "drive-file-1",
            kind: "drive",
            title: "Launch plan",
            subtitle: "Docs",
            status: "healthy",
            authority: "Google Drive",
            detail: "Pinned document",
            sourceLabel: "drive",
            tags: ["importable"],
            actions: [],
          },
        ],
      },
    ],
  };

  expect(getRootWorkspaceSection(snapshot, "drive")?.title).toBe("Drive");
  expect(getRootWorkspaceItem(snapshot, "drive-file-1")?.title).toBe("Launch plan");
  expect(getRootWorkspaceItem(snapshot, "missing")).toBeNull();
});

test("workspace sheet action returns a stub when no connector is configured", async () => {
  const envKeys = [
    "ROOT_WORKSPACE_ENDPOINT",
    "GOOGLE_WORKSPACE_ENDPOINT",
    "ROOT_GOOGLE_WORKSPACE_ENDPOINT",
    "ROOT_WORKSPACE_CLI",
    "GOOGLE_WORKSPACE_CLI",
    "ROOT_GOOGLE_WORKSPACE_CLI",
  ] as const;
  const previous = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  for (const key of envKeys) {
    delete process.env[key];
  }

  try {
    const result = await runRootWorkspaceSheetAction({
      id: "sheet-123",
      action: "append-row",
      range: "Sheet1!A1:C2",
    });
    expect(result).toMatchObject({
      ok: true,
      mode: "stub",
      id: "sheet-123",
      action: "append-row",
      range: "Sheet1!A1:C2",
    });
  } finally {
    for (const key of envKeys) {
      const value = previous[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});

test("contact import helpers normalize csv and derive contact fields", () => {
  const rows = __rootContactOpsTestUtils.parseCsv(
    [
      "Full Name,Email,Phone,Company,Tags,Preferences Summary",
      "\"Jane Doe\",JANE@EXAMPLE.COM,(555) 321-9876,Acme,\"vip,repeat\",\"Text first\"",
    ].join("\n"),
  );
  expect(rows).toHaveLength(1);

  const parsed = __rootContactOpsTestUtils.rowToParsedContact(rows[0] || {}, "csv");
  expect(parsed).not.toBeNull();
  expect(parsed?.email).toBe("jane@example.com");
  expect(parsed?.phone).toBe("5553219876");
  expect(parsed?.company).toBe("Acme");
  expect(__rootContactOpsTestUtils.derivePreferredChannel(parsed!)).toBe("phone");
  expect(__rootContactOpsTestUtils.deriveTags(parsed!, "CCO")).toEqual(
    expect.arrayContaining(["cco", "email", "phone", "company-linked", "vip", "repeat"]),
  );
});

test("swarm helpers normalize projected goal and agent rows", () => {
  const goal = __rootGoalsTestUtils.normalizeGoalRow({
    id: "goal-1",
    title: "Fix publish authority",
    business_unit: "content_co_op",
    approval_policy: "gated",
    owner_type: "automation",
    status: "in_progress",
    runtime_sensitive: true,
  });
  expect(goal.business_scope).toBe("CCO");
  expect(goal.approval_policy).toBe("approval_required");
  expect(goal.owner_type).toBe("agent");
  expect(goal.status).toBe("active");
  expect(goal.runtime_sensitive).toBe(true);

  const agent = __rootGoalsTestUtils.normalizeAgentRow({
    id: "agent-1",
    name: "Workspace Agent",
    business_scope: "astro",
    owner_type: "service",
    approval_policy: "operator-only",
    capabilities: "drive import, sheets read",
    status: "online",
  });
  expect(agent.business_scope).toBe("SHARED");
  expect(agent.owner_type).toBe("system");
  expect(agent.approval_policy).toBe("operator_only");
  expect(agent.status).toBe("active");
  expect(agent.capabilities).toEqual(["drive import", "sheets read"]);
});
