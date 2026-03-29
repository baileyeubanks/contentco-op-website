"use client";

import React, { useState, useEffect, useCallback } from "react";
import { CrewMap } from "./components/crew-map";
import { CrewCard } from "./components/crew-card";
import { SiteCard } from "./components/site-card";
import { OverridePanel } from "./components/override-panel";
import { DispatchModal } from "./components/dispatch-modal";
import { NotificationLog } from "./components/notification-log";

/* ─── Types ─── */

interface CrewMember {
  crew_member_id: string;
  name: string;
  color: string;
  lat: number;
  lng: number;
  status: string;
  last_ping: string;
  job_id?: string;
  client_name?: string;
  address?: string;
  distance_m?: number;
  eta_minutes?: number;
  eta_source?: "admin_override" | "historical" | "estimate";
  preferred_channel?: string;
}

interface Site {
  job_id: string;
  lat: number;
  lng: number;
  client_name: string;
  address: string;
  status: string;
  scheduled_time?: string;
  assigned_crew: { name: string; color: string }[];
  geofence_status?: "inside" | "outside" | "departed" | null;
}

type SidebarTab = "crew" | "sites" | "log";

/* ─── Main Page ─── */

export default function OperationsPage() {
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Selection state
  const [selectedCrewId, setSelectedCrewId] = useState<string | null>(null);
  const [overrideTarget, setOverrideTarget] = useState<CrewMember | null>(null);
  const [showDispatch, setShowDispatch] = useState(false);

  // Sidebar tab
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("crew");

  // Map controls
  const [showGeofences, setShowGeofences] = useState(true);

  /* ─── Data Fetching ─── */

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/operations/crew");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setCrew(data.crew || []);

      // Build sites from the API response
      const apiSites = (data.sites || []).map((s: any) => ({
        job_id: s.job_id || "",
        lat: s.lat,
        lng: s.lng,
        client_name: s.client_name,
        address: s.address,
        status: s.status || "scheduled",
        scheduled_time: s.scheduled_time,
        assigned_crew: s.assigned_crew || [],
        geofence_status: s.geofence_status || null,
      }));
      setSites(apiSites);

      setLastRefresh(new Date());
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to fetch crew data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // 30s polling (matches admin/map.html)
    return () => clearInterval(interval);
  }, [fetchData]);

  /* ─── Handlers ─── */

  function handleSelectCrew(id: string) {
    setSelectedCrewId(id === selectedCrewId ? null : id);
    setSidebarTab("crew");
  }

  function handleOpenOverride(member: CrewMember) {
    setOverrideTarget(member);
  }

  async function handleOverrideAction(action: any) {
    const res = await fetch("/api/operations/crew/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Override failed");
    }
    // Refresh data after override
    await fetchData();
  }

  async function handleDispatch(jobId: string, crewMemberIds: string[]) {
    const res = await fetch("/api/operations/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobId, crew_member_ids: crewMemberIds }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Dispatch failed");
    }
    const result = await res.json();
    await fetchData();
    return result;
  }

  /* ─── Stats ─── */

  const activeCrew = crew.filter(
    (c) => c.last_ping && Date.now() - new Date(c.last_ping).getTime() < 15 * 60000
  );
  const jobsInProgress = sites.filter((s) => ["in_progress", "arrived", "on_my_way"].includes(s.status));
  const completedToday = sites.filter((s) => s.status === "completed");

  /* ─── Render ─── */

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 14px",
    borderRadius: 6,
    fontSize: "0.72rem",
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: active ? "rgba(139,164,196,0.15)" : "transparent",
    color: active ? "var(--ink)" : "var(--muted)",
  });

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 24px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
      }}>
        <div>
          <h1 style={{
            fontFamily: "var(--font-body), sans-serif",
            fontSize: "1.1rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            margin: 0,
          }}>
            ACS Operations
          </h1>
          <div style={{ fontSize: "0.68rem", color: "var(--muted)", marginTop: 2 }}>
            {activeCrew.length} active crew · {jobsInProgress.length} in progress · {completedToday.length} completed
            {lastRefresh && (
              <span style={{ marginLeft: 8 }}>
                Updated {lastRefresh.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <label style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: "0.72rem",
            color: "var(--muted)",
            cursor: "pointer",
          }}>
            <input
              type="checkbox"
              checked={showGeofences}
              onChange={(e) => setShowGeofences(e.target.checked)}
              style={{ accentColor: "#3d7dd8" }}
            />
            Geofences
          </label>

          <button
            onClick={() => setShowDispatch(true)}
            style={{
              padding: "6px 16px",
              borderRadius: 8,
              fontSize: "0.74rem",
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              background: "#3d7dd8",
              color: "#fff",
            }}
          >
            + Dispatch
          </button>

          <button
            onClick={fetchData}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              fontSize: "0.74rem",
              fontWeight: 600,
              cursor: "pointer",
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)",
              color: "var(--muted)",
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          padding: "8px 24px",
          fontSize: "0.78rem",
          fontWeight: 600,
          background: "rgba(222,118,118,0.1)",
          color: "#de7676",
          borderBottom: "1px solid rgba(222,118,118,0.15)",
        }}>
          ⚠ {error}
        </div>
      )}

      {/* Main content: map + sidebar */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Map (60%) */}
        <div style={{ flex: 3, position: "relative" }}>
          {loading ? (
            <div style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--muted)",
              fontSize: "0.88rem",
            }}>
              Loading crew data...
            </div>
          ) : (
            <CrewMap
              crew={crew.map((c) => ({
                crew_member_id: c.crew_member_id,
                name: c.name,
                color: c.color,
                lat: c.lat,
                lng: c.lng,
                status: c.status,
              }))}
              sites={sites.map((s) => ({
                lat: s.lat,
                lng: s.lng,
                client_name: s.client_name,
                address: s.address,
                status: s.status,
                job_id: s.job_id,
              }))}
              selectedCrewId={selectedCrewId}
              onSelectCrew={handleSelectCrew}
              showGeofences={showGeofences}
            />
          )}

          {/* Override panel overlay */}
          {overrideTarget && (
            <div style={{
              position: "absolute",
              bottom: 16,
              left: 16,
              right: 16,
              maxWidth: 480,
              zIndex: 500,
            }}>
              <OverridePanel
                jobId={overrideTarget.job_id || ""}
                crewName={overrideTarget.name}
                currentStatus={overrideTarget.status}
                onClose={() => setOverrideTarget(null)}
                onAction={handleOverrideAction}
              />
            </div>
          )}
        </div>

        {/* Sidebar (40%) */}
        <div style={{
          flex: 2,
          borderLeft: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          maxWidth: 420,
          minWidth: 300,
        }}>
          {/* Sidebar tabs */}
          <div style={{
            display: "flex",
            gap: 4,
            padding: "12px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            flexShrink: 0,
          }}>
            <button onClick={() => setSidebarTab("crew")} style={tabBtnStyle(sidebarTab === "crew")}>
              Crew ({crew.length})
            </button>
            <button onClick={() => setSidebarTab("sites")} style={tabBtnStyle(sidebarTab === "sites")}>
              Sites ({sites.length})
            </button>
            <button onClick={() => setSidebarTab("log")} style={tabBtnStyle(sidebarTab === "log")}>
              Log
            </button>
          </div>

          {/* Sidebar content */}
          <div style={{ flex: 1, overflow: "auto", padding: "12px 16px" }}>
            {sidebarTab === "crew" && (
              <>
                {crew.length === 0 && !loading && (
                  <div style={{ fontSize: "0.78rem", color: "var(--muted)", textAlign: "center", padding: 24 }}>
                    No crew data available
                  </div>
                )}
                {crew.map((member) => (
                  <CrewCard
                    key={member.crew_member_id}
                    crew_member_id={member.crew_member_id}
                    name={member.name}
                    color={member.color}
                    status={member.status}
                    last_ping={member.last_ping}
                    job_id={member.job_id}
                    client_name={member.client_name}
                    address={member.address}
                    distance_m={member.distance_m}
                    eta_minutes={member.eta_minutes}
                    eta_source={member.eta_source}
                    selected={member.crew_member_id === selectedCrewId}
                    onClick={() => handleSelectCrew(member.crew_member_id)}
                    onOverride={() => handleOpenOverride(member)}
                  />
                ))}
              </>
            )}

            {sidebarTab === "sites" && (
              <>
                {sites.length === 0 && !loading && (
                  <div style={{ fontSize: "0.78rem", color: "var(--muted)", textAlign: "center", padding: 24 }}>
                    No job sites today
                  </div>
                )}
                {sites.map((site) => (
                  <SiteCard
                    key={site.job_id}
                    job_id={site.job_id}
                    client_name={site.client_name}
                    address={site.address}
                    status={site.status}
                    assigned_crew={site.assigned_crew}
                    geofence_status={site.geofence_status}
                    scheduled_time={site.scheduled_time}
                  />
                ))}
              </>
            )}

            {sidebarTab === "log" && (
              <NotificationLog maxItems={50} />
            )}
          </div>
        </div>
      </div>

      {/* Dispatch Modal */}
      {showDispatch && (
        <DispatchModal
          jobs={sites.map((s) => ({
            id: s.job_id,
            client_name: s.client_name,
            address: s.address,
            scheduled_time: s.scheduled_time,
            status: s.status,
          }))}
          crew={crew.map((c) => ({
            crew_member_id: c.crew_member_id,
            name: c.name,
            color: c.color,
            preferred_channel: c.preferred_channel,
            status: c.status,
          }))}
          onClose={() => setShowDispatch(false)}
          onDispatch={handleDispatch}
        />
      )}
    </div>
  );
}
