"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Plus, Users } from "lucide-react";
import AuditLog from "@/components/teams/AuditLog";
import TeamSettings from "@/components/teams/TeamSettings";
import {
  EmptyState,
  MetricTile,
  SectionCard,
  SuitePage,
} from "@/components/suite/SuitePrimitives";

interface TeamRow {
  id: string;
  name: string;
  created_at: string;
  currentRole: "owner" | "admin" | "member" | "viewer";
}

export default function TeamPage() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [creating, setCreating] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetch("/api/teams")
      .then((response) => response.json())
      .then((data) => {
        const items = (data.items ?? []) as TeamRow[];
        setTeams(items);
        if (items[0] && !selectedTeamId) {
          setSelectedTeamId(items[0].id);
        }
      })
      .catch(() => {});
  }, [refreshKey, selectedTeamId]);

  async function createTeam() {
    if (!teamName.trim()) return;
    setCreating(true);

    const response = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: teamName.trim() }),
    });

    if (response.ok) {
      const team = (await response.json()) as TeamRow;
      setTeamName("");
      setSelectedTeamId(team.id);
      setRefreshKey((value) => value + 1);
    }

    setCreating(false);
  }

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) ?? null,
    [selectedTeamId, teams],
  );

  const adminCount = teams.filter((team) => team.currentRole === "owner" || team.currentRole === "admin").length;

  return (
    <SuitePage
      eyebrow="Admin Surface"
      title="Team access and governance"
      description="Manage the people behind co-deliver, invite reviewers or operators, and audit team-level actions without leaving the suite."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <MetricTile
          label="Teams"
          value={teams.length}
          note="Workspace groups you can manage from this surface."
        />
        <MetricTile
          label="Admin Roles"
          value={adminCount}
          note="Owner and admin memberships currently in your visible team set."
          accent="var(--orange)"
        />
        <MetricTile
          label="Active Focus"
          value={selectedTeam ? selectedTeam.name : "None"}
          note="The team currently loaded into member settings and audit visibility."
          accent="var(--green)"
        />
      </div>

      <SectionCard
        title="Team directory"
        description="Create or switch between teams, then manage members, roles, invites, and governance details below."
      >
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <div className="rounded-[18px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                <Plus size={15} className="text-[var(--accent)]" />
                Create team
              </div>
              <div className="flex gap-2">
                <input
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") createTeam();
                  }}
                  placeholder="Operations, clients, or delivery pod"
                  className="flex-1 rounded-2xl border border-[var(--border)] bg-[color:rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[var(--ink)] outline-none"
                />
                <button
                  type="button"
                  onClick={createTeam}
                  disabled={creating || !teamName.trim()}
                  className="rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </div>

            {teams.length === 0 ? (
              <EmptyState
                title="No teams yet"
                body="Create your first team to start managing members, invites, and audit activity inside co-deliver."
              />
            ) : (
              <div className="grid gap-3">
                {teams.map((team) => (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => setSelectedTeamId(team.id)}
                    className={`rounded-[18px] border px-4 py-4 text-left transition ${
                      selectedTeamId === team.id
                        ? "border-[color:rgba(52,211,153,0.28)] bg-[color:rgba(52,211,153,0.08)]"
                        : "border-[var(--border)] bg-[color:rgba(255,255,255,0.02)] hover:border-[color:rgba(52,211,153,0.14)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-base font-semibold text-[var(--ink)]">{team.name}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--dim)]">
                          {team.currentRole}
                        </div>
                      </div>
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:rgba(255,255,255,0.04)] text-[var(--muted)]">
                        <Users size={16} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            {selectedTeam ? (
              <TeamSettings key={`${selectedTeam.id}-${refreshKey}`} teamId={selectedTeam.id} />
            ) : (
              <EmptyState
                title="Select a team"
                body="Choose a team from the directory to manage members, roles, and invites."
              />
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Audit visibility"
        description="Recent team activity with filters for invites, role changes, sharing, and review actions."
        action={
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--dim)]">
            <Activity size={13} />
            Team events
          </div>
        }
      >
        {selectedTeam ? (
          <AuditLog key={`${selectedTeam.id}-${refreshKey}-audit`} teamId={selectedTeam.id} />
        ) : (
          <EmptyState
            title="No team selected"
            body="Pick a team above to load audit trails and governance activity."
          />
        )}
      </SectionCard>
    </SuitePage>
  );
}
