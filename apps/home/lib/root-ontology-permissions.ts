/**
 * ROOT Ontology Permissions — CRUD permission matrix per object type per role.
 */

export type OntologyObjectType =
  | "contact"
  | "company"
  | "relationship"
  | "opportunity"
  | "quote"
  | "invoice"
  | "payment"
  | "project"
  | "deliverable"
  | "campaign"
  | "catalog_item"
  | "automation_rule";

export type OntologyRole = "admin" | "manager" | "member" | "viewer";
export type CrudAction = "create" | "read" | "update" | "delete";

type PermissionMatrix = Record<OntologyObjectType, Record<OntologyRole, CrudAction[]>>;

const FULL_CRUD: CrudAction[] = ["create", "read", "update", "delete"];
const READ_ONLY: CrudAction[] = ["read"];
const CRU: CrudAction[] = ["create", "read", "update"];

const PERMISSIONS: PermissionMatrix = {
  contact:         { admin: FULL_CRUD, manager: FULL_CRUD, member: CRU, viewer: READ_ONLY },
  company:         { admin: FULL_CRUD, manager: FULL_CRUD, member: CRU, viewer: READ_ONLY },
  relationship:    { admin: FULL_CRUD, manager: FULL_CRUD, member: CRU, viewer: READ_ONLY },
  opportunity:     { admin: FULL_CRUD, manager: FULL_CRUD, member: CRU, viewer: READ_ONLY },
  quote:           { admin: FULL_CRUD, manager: FULL_CRUD, member: CRU, viewer: READ_ONLY },
  invoice:         { admin: FULL_CRUD, manager: FULL_CRUD, member: READ_ONLY, viewer: READ_ONLY },
  payment:         { admin: FULL_CRUD, manager: CRU, member: READ_ONLY, viewer: READ_ONLY },
  project:         { admin: FULL_CRUD, manager: FULL_CRUD, member: CRU, viewer: READ_ONLY },
  deliverable:     { admin: FULL_CRUD, manager: FULL_CRUD, member: CRU, viewer: READ_ONLY },
  campaign:        { admin: FULL_CRUD, manager: FULL_CRUD, member: READ_ONLY, viewer: READ_ONLY },
  catalog_item:    { admin: FULL_CRUD, manager: CRU, member: READ_ONLY, viewer: READ_ONLY },
  automation_rule: { admin: FULL_CRUD, manager: CRU, member: READ_ONLY, viewer: READ_ONLY },
};

export function hasPermission(
  objectType: OntologyObjectType,
  role: OntologyRole,
  action: CrudAction,
): boolean {
  return PERMISSIONS[objectType]?.[role]?.includes(action) ?? false;
}

export function getPermissions(
  objectType: OntologyObjectType,
  role: OntologyRole,
): CrudAction[] {
  return PERMISSIONS[objectType]?.[role] ?? [];
}

export function getAllPermissionsForRole(role: OntologyRole): Record<OntologyObjectType, CrudAction[]> {
  const result = {} as Record<OntologyObjectType, CrudAction[]>;
  for (const [objectType, roles] of Object.entries(PERMISSIONS)) {
    result[objectType as OntologyObjectType] = roles[role] ?? [];
  }
  return result;
}
