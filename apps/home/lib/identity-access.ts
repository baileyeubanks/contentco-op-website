import { createServerClient } from "@supabase/ssr";
import { createInternalOperatorActor, type Permission, type SessionActor } from "@contentco-op/identity-access";
import { getRootBusinessScopeFromRequest } from "@/lib/root-request-scope";
import {
  getRootOperatorRoleForHost,
  isAdvancedRootOperatorForHost,
  isEmailAuthorizedForRootHost,
} from "@/lib/root-auth";
import { resolvePublicSupabaseConfig } from "@/lib/runtime-config";
import { verifyInviteSession } from "@/lib/session";
import { getSessionCookieName } from "@/lib/session-shared";

function parseCookies(header: string | null) {
  const pairs = String(header || "")
    .split(/;\s*/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const index = entry.indexOf("=");
      if (index === -1) return null;
      return [entry.slice(0, index), decodeURIComponent(entry.slice(index + 1))] as const;
    })
    .filter((entry): entry is readonly [string, string] => Boolean(entry));

  return new Map(pairs);
}

function readHost(request: Request) {
  return request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host;
}

async function getSupabaseUserFromRequest(request: Request) {
  const config = resolvePublicSupabaseConfig();
  if (!config.isConfigured || !config.url || !config.anonKey) return null;

  const cookieHeader = request.headers.get("cookie");
  const cookieMap = parseCookies(cookieHeader);
  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return Array.from(cookieMap.entries()).map(([name, value]) => ({ name, value }));
      },
      setAll() {
        // Route handlers use proxy/session refresh; no cookie writes here.
      },
    },
  });

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

export async function getRootSessionActor(request: Request): Promise<SessionActor | null> {
  const host = readHost(request);
  const businessUnit = getRootBusinessScopeFromRequest(request);
  const cookies = parseCookies(request.headers.get("cookie"));
  const inviteToken = cookies.get(getSessionCookieName()) || null;
  const inviteSession = verifyInviteSession(inviteToken);

  if (inviteSession && isEmailAuthorizedForRootHost(inviteSession.email, host)) {
    return createInternalOperatorActor({
      actorId: `invite:${inviteSession.email}`,
      email: inviteSession.email,
      legacyRole: getRootOperatorRoleForHost(inviteSession.email, host),
      businessUnit,
      sessionType: "operator_invite",
      metadata: { auth_source: "invite_cookie" },
    });
  }

  const user = await getSupabaseUserFromRequest(request);
  if (user?.email && isEmailAuthorizedForRootHost(user.email, host)) {
    return createInternalOperatorActor({
      actorId: user.id,
      email: user.email,
      legacyRole: getRootOperatorRoleForHost(user.email, host),
      businessUnit,
      sessionType: "supabase_user",
      metadata: { auth_source: "supabase_user" },
    });
  }

  return null;
}

export async function hasAdvancedRootAccess(request: Request) {
  const actor = await getRootSessionActor(request);
  if (!actor?.email) return false;
  return isAdvancedRootOperatorForHost(actor.email, readHost(request));
}

export type RootRouteAccess = {
  actor: SessionActor;
  businessUnit: "ACS" | "CC" | null;
  hasPermission(permission: Permission): boolean;
};

export async function getRootRouteAccess(request: Request): Promise<RootRouteAccess | null> {
  const actor = await getRootSessionActor(request);
  if (!actor) return null;

  return {
    actor,
    businessUnit: getRootBusinessScopeFromRequest(request),
    hasPermission(permission: Permission) {
      return actor.permissions.includes(permission);
    },
  };
}
