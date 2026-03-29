"use client";

import React, { useState, useEffect } from "react";

interface NotificationEntry {
  id: string;
  recipient: string;
  channel: string;
  status: string;
  message_preview?: string;
  created_at: string;
  job_id?: string;
  event_type?: string;
}

interface NotificationLogProps {
  maxItems?: number;
}

const channelMeta: Record<string, { icon: string; color: string }> = {
  telegram: { icon: "✈", color: "#2AABEE" },
  imessage: { icon: "💬", color: "#3ec983" },
  whatsapp: { icon: "📱", color: "#25D366" },
  email: { icon: "✉", color: "#8ba4c4" },
  sms: { icon: "📩", color: "#e4ad5b" },
};

const statusMeta: Record<string, { icon: string; color: string }> = {
  sent: { icon: "✓", color: "#3ec983" },
  delivered: { icon: "✓✓", color: "#3ec983" },
  failed: { icon: "✗", color: "#de7676" },
  queued: { icon: "⏳", color: "#e4ad5b" },
  async: { icon: "⏳", color: "#e4ad5b" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationLog({ maxItems = 50 }: NotificationLogProps) {
  const [entries, setEntries] = useState<NotificationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [channelFilter]);

  async function fetchNotifications() {
    try {
      const params = new URLSearchParams({ limit: String(maxItems) });
      if (channelFilter !== "all") params.set("channel", channelFilter);
      const res = await fetch(`/api/operations/notifications?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.notifications || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  const channels = ["all", "telegram", "imessage", "whatsapp", "email"];

  return (
    <div style={{
      background: "rgba(12,19,34,0.95)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 12,
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Notifications
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {channels.map((ch) => (
            <button
              key={ch}
              onClick={() => setChannelFilter(ch)}
              style={{
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: "0.62rem",
                fontWeight: 600,
                cursor: "pointer",
                border: "none",
                textTransform: "uppercase",
                letterSpacing: "0.03em",
                background: channelFilter === ch ? "rgba(139,164,196,0.15)" : "transparent",
                color: channelFilter === ch ? "var(--ink)" : "var(--muted)",
              }}
            >
              {ch === "all" ? "ALL" : (channelMeta[ch]?.icon || "") + " " + ch.slice(0, 3).toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ maxHeight: 360, overflow: "auto" }}>
        {loading ? (
          <div style={{ padding: "24px 16px", fontSize: "0.78rem", color: "var(--muted)", textAlign: "center" }}>
            Loading notifications...
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding: "24px 16px", fontSize: "0.78rem", color: "var(--muted)", textAlign: "center" }}>
            No notifications found
          </div>
        ) : (
          entries.map((entry) => {
            const ch = channelMeta[entry.channel] || { icon: "📨", color: "#8ba4c4" };
            const st = statusMeta[entry.status] || statusMeta.queued;
            const isExpanded = expandedId === entry.id;

            return (
              <div
                key={entry.id}
                onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                style={{
                  padding: "10px 16px",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {/* Channel icon */}
                  <span style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: `${ch.color}20`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.72rem",
                    flexShrink: 0,
                  }}>{ch.icon}</span>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}>
                      {entry.recipient}
                    </div>
                    {entry.event_type && (
                      <div style={{ fontSize: "0.62rem", color: "var(--muted)", marginTop: 1 }}>
                        {entry.event_type.replace(/_/g, " ")}
                      </div>
                    )}
                  </div>

                  {/* Status + time */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <span style={{
                      fontSize: "0.64rem",
                      fontWeight: 700,
                      color: st.color,
                    }}>
                      {st.icon} {entry.status}
                    </span>
                    <div style={{ fontSize: "0.6rem", color: "var(--muted)", marginTop: 2 }}>
                      {timeAgo(entry.created_at)}
                    </div>
                  </div>
                </div>

                {/* Expanded message preview */}
                {isExpanded && entry.message_preview && (
                  <div style={{
                    marginTop: 8,
                    padding: "8px 10px",
                    borderRadius: 6,
                    background: "rgba(255,255,255,0.03)",
                    fontSize: "0.72rem",
                    color: "var(--muted)",
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                  }}>
                    {entry.message_preview}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
