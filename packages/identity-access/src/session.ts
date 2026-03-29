import { getPermissionsForRoles } from "./permissions";
import type { SessionActor } from "./types";

export function createSessionActor(input: Omit<SessionActor, "permissions"> & { permissions?: SessionActor["permissions"] }): SessionActor {
  return {
    ...input,
    permissions: input.permissions?.length ? input.permissions : getPermissionsForRoles(input.roles),
  };
}
