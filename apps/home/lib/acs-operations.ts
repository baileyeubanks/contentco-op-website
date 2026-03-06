/**
 * ACS operations proxy client.
 *
 * Proxies admin operations to the live ACS API
 * at astrocleanings.com/api/*. Server-side only.
 */

const DEFAULT_TIMEOUT_MS = 10000;

function resolveAcsApiBase(): string {
  const base = (process.env.ACS_API_BASE || "https://astrocleanings.com").trim();
  return base.replace(/\/$/, "");
}

function getAcsAdminToken(): string {
  return process.env.ACS_ADMIN_TOKEN?.trim() || "";
}

/* ─── Types ─── */

export interface CrewPosition {
  crew_member_id: string;
  name: string;
  color: string;
  lat: number;
  lng: number;
  last_ping: string;
  job_id: string;
  client_name: string;
  address: string;
  status: "on_my_way" | "arrived" | "in_progress" | "completed";
}

export interface SitePosition {
  lat: number;
  lng: number;
  client_name: string;
  address: string;
  status: "scheduled" | "on_my_way" | "arrived" | "in_progress" | "completed";
  job_id?: string;
  assigned_crew?: string[];
}

export interface CrewPositionsResponse {
  crew: CrewPosition[];
  sites: SitePosition[];
}

export type OverrideAction =
  | { action: "override_eta"; job_id: string; eta_iso: string; reason?: string }
  | { action: "set_status"; job_id: string; status: string }
  | { action: "pause_alerts"; job_id: string }
  | { action: "mark_departed"; job_id: string };

export interface DispatchResult {
  sent: number;
  skipped: number;
  results: Array<{
    crew_member_id: string;
    sent: boolean;
    channel: string;
    error?: string;
  }>;
}

export interface AcsResult<T = unknown> {
  ok: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  data?: T;
  error?: string;
}

/* ─── Core Fetch ─── */

async function acsFetch<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: unknown;
    timeoutMs?: number;
  } = {},
): Promise<AcsResult<T>> {
  const baseUrl = resolveAcsApiBase();
  const token = getAcsAdminToken();
  const { method = "GET", body, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  if (!token) {
    return { ok: false, statusCode: null, latencyMs: null, error: "missing_acs_admin_token" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const startedAt = Date.now();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      accept: "application/json",
    };
    if (body) headers["Content-Type"] = "application/json";

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const latencyMs = Date.now() - startedAt;
    const text = await response.text();

    if (!response.ok) {
      return { ok: false, statusCode: response.status, latencyMs, error: text };
    }

    let data: T | undefined;
    try {
      data = text ? (JSON.parse(text) as T) : undefined;
    } catch {
      return { ok: false, statusCode: response.status, latencyMs, error: "invalid_json" };
    }

    return { ok: true, statusCode: response.status, latencyMs, data };
  } catch (error) {
    return { ok: false, statusCode: null, latencyMs: null, error: String(error) };
  } finally {
    clearTimeout(timer);
  }
}

/* ─── Public API ─── */

/** Fetch live crew positions + job sites */
export function fetchCrewPositions(): Promise<AcsResult<CrewPositionsResponse>> {
  return acsFetch<CrewPositionsResponse>("/api/adminLiveLocations");
}

/** Send admin override (set ETA, force status, pause alerts, mark departed) */
export function postCrewOverride(action: OverrideAction): Promise<AcsResult> {
  return acsFetch("/api/adminLiveLocations", { method: "POST", body: action });
}

/** Dispatch crew to a job */
export function dispatchCrew(
  jobId: string,
  crewMemberIds: string[],
): Promise<AcsResult<DispatchResult>> {
  return acsFetch<DispatchResult>("/api/crewDispatchV2", {
    method: "POST",
    body: { jobId, crewMemberIds },
  });
}
