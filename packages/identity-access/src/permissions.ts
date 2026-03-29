import type { Permission, Role } from "./types";

const ALL_PERMISSIONS: Permission[] = [
  "org_admin",
  "project_read",
  "project_manage",
  "asset_read",
  "asset_manage",
  "comments_review",
  "quote_read",
  "quote_manage",
  "invoice_read",
  "invoice_manage",
  "payment_manage",
  "finance_read",
  "finance_manage",
  "system_config",
  "workflow_intervene",
  "audit_read",
  "automation_manage",
  "client_portal_access",
  "reviewer_access",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  platform_owner: ALL_PERMISSIONS,
  platform_admin: ALL_PERMISSIONS,
  ops_admin: [
    "project_read",
    "project_manage",
    "asset_read",
    "asset_manage",
    "comments_review",
    "quote_read",
    "quote_manage",
    "invoice_read",
    "finance_read",
    "workflow_intervene",
    "automation_manage",
    "audit_read",
  ],
  finance_admin: [
    "quote_read",
    "quote_manage",
    "invoice_read",
    "invoice_manage",
    "payment_manage",
    "finance_read",
    "finance_manage",
    "audit_read",
  ],
  production_manager: [
    "project_read",
    "project_manage",
    "asset_read",
    "asset_manage",
    "comments_review",
    "workflow_intervene",
  ],
  internal_editor: ["project_read", "asset_read", "asset_manage", "comments_review"],
  client_admin: ["client_portal_access", "project_read", "asset_read", "comments_review"],
  client_member: ["client_portal_access", "project_read", "asset_read", "comments_review"],
  reviewer: ["reviewer_access", "asset_read", "comments_review"],
  vendor_limited: ["project_read", "asset_read"],
  automation_operator: ["workflow_intervene", "automation_manage", "project_read", "quote_read"],
};

export function getPermissionsForRoles(roles: Role[]): Permission[] {
  return Array.from(new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role] || [])));
}

export function getPermissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}
