"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import s from "./page.module.css";

interface Brief {
  id: string;
  status: string;
  contact_name: string;
  contact_email: string;
  company: string | null;
  role: string | null;
  content_type: string | null;
  deliverables: string | null;
  audience: string | null;
  tone: string | null;
  deadline: string | null;
  objective: string | null;
  key_messages: string | null;
  references: string | null;
  constraints: string | null;
  created_at: string;
}

interface StatusEntry {
  id: string;
  status: string;
  note: string | null;
  created_at: string;
}

interface Message {
  id: string;
  sender: "client" | "team";
  body: string;
  created_at: string;
}

interface FileEntry {
  id: string;
  file_name: string;
  file_size: number | null;
  content_type: string | null;
  created_at: string;
}

type Tab = "status" | "messages" | "files";

const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  reviewed: "Reviewed",
  in_progress: "In Progress",
  delivered: "Delivered",
  closed: "Closed",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PortalClient({
  brief,
  history,
  token,
}: {
  brief: Brief;
  history: StatusEntry[];
  token: string;
}) {
  const [tab, setTab] = useState<Tab>("status");
  const [messages, setMessages] = useState<Message[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [msgBody, setMsgBody] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const apiBase = `/api/briefs/${brief.id}`;

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/messages?token=${token}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
      }
    } catch { /* silent */ }
  }, [apiBase, token]);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/files?token=${token}`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files);
      }
    } catch { /* silent */ }
  }, [apiBase, token]);

  useEffect(() => {
    if (tab === "messages") fetchMessages();
    if (tab === "files") fetchFiles();
  }, [tab, fetchMessages, fetchFiles]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!msgBody.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`${apiBase}/messages?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: msgBody.trim(), sender: "client" }),
      });
      if (res.ok) {
        setMsgBody("");
        await fetchMessages();
      }
    } catch { /* silent */ }
    setSending(false);
  };

  const uploadFile = async (file: File) => {
    if (uploading) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${apiBase}/files?token=${token}`, {
        method: "POST",
        body: fd,
      });
      if (res.ok) await fetchFiles();
    } catch { /* silent */ }
    setUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  return (
    <div className={s.layout}>
      {/* Sidebar */}
      <div className={s.sidebar}>
        <p className={s.sidebarTitle}>Brief Details</p>
        <div className={s.metaRow}>
          <span className={s.metaKey}>Contact</span>
          <span className={s.metaVal}>{brief.contact_name}</span>
        </div>
        <div className={s.metaRow}>
          <span className={s.metaKey}>Email</span>
          <span className={s.metaVal}>{brief.contact_email}</span>
        </div>
        {brief.company && (
          <div className={s.metaRow}>
            <span className={s.metaKey}>Company</span>
            <span className={s.metaVal}>{brief.company}</span>
          </div>
        )}
        {brief.content_type && (
          <div className={s.metaRow}>
            <span className={s.metaKey}>Type</span>
            <span className={s.metaVal}>{brief.content_type}</span>
          </div>
        )}
        {brief.deliverables && (
          <div className={s.metaRow}>
            <span className={s.metaKey}>Deliverables</span>
            <span className={s.metaVal}>{brief.deliverables}</span>
          </div>
        )}
        {brief.audience && (
          <div className={s.metaRow}>
            <span className={s.metaKey}>Audience</span>
            <span className={s.metaVal}>{brief.audience}</span>
          </div>
        )}
        {brief.deadline && (
          <div className={s.metaRow}>
            <span className={s.metaKey}>Deadline</span>
            <span className={s.metaVal}>{brief.deadline}</span>
          </div>
        )}
        <div className={s.metaRow}>
          <span className={s.metaKey}>Submitted</span>
          <span className={s.metaVal}>{formatDate(brief.created_at)}</span>
        </div>
      </div>

      {/* Main */}
      <div className={s.main}>
        {/* Tabs */}
        <div className={s.tabs}>
          {(["status", "messages", "files"] as Tab[]).map((t) => (
            <button
              key={t}
              className={tab === t ? s.tabActive : s.tab}
              onClick={() => setTab(t)}
              type="button"
            >
              {t}
            </button>
          ))}
        </div>

        {/* Status */}
        {tab === "status" && (
          <div className={s.timeline}>
            {history.map((entry, i) => (
              <div key={entry.id} className={s.timelineItem}>
                <div className={i === history.length - 1 ? s.timelineDotActive : s.timelineDot} />
                <div>
                  <p className={s.timelineStatus}>{STATUS_LABELS[entry.status] || entry.status}</p>
                  {entry.note && <p className={s.timelineNote}>{entry.note}</p>}
                  <p className={s.timelineDate}>{formatDate(entry.created_at)}</p>
                </div>
              </div>
            ))}
            {history.length === 0 && (
              <p className={s.empty}>No status updates yet.</p>
            )}
          </div>
        )}

        {/* Messages */}
        {tab === "messages" && (
          <>
            <div className={s.messagesWrap}>
              {messages.length === 0 && (
                <p className={s.empty}>No messages yet. Send the first one below.</p>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={msg.sender === "client" ? s.messageClient : s.messageTeam}
                >
                  <p className={s.messageSender}>
                    {msg.sender === "client" ? "You" : "Content Co-op"}
                  </p>
                  {msg.body}
                  <p className={s.messageTime}>{formatDate(msg.created_at)}</p>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className={s.messageForm}>
              <textarea
                className={s.messageInput}
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value)}
                placeholder="Type a message..."
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <button
                className={s.btnSend}
                onClick={sendMessage}
                disabled={sending || !msgBody.trim()}
                type="button"
              >
                {sending ? "..." : "Send"}
              </button>
            </div>
          </>
        )}

        {/* Files */}
        {tab === "files" && (
          <>
            <div
              className={s.dropzone}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <p className={s.dropzoneText}>
                {uploading ? "Uploading..." : "Drop files here or click to browse"}
              </p>
              <p className={s.dropzoneHint}>Max 50 MB per file</p>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadFile(f);
                  e.target.value = "";
                }}
              />
            </div>
            <div className={s.fileList}>
              {files.length === 0 && (
                <p className={s.empty}>No files uploaded yet.</p>
              )}
              {files.map((f) => (
                <div key={f.id} className={s.fileRow}>
                  <span className={s.fileName}>{f.file_name}</span>
                  <span className={s.fileSize}>{formatSize(f.file_size)}</span>
                  <span className={s.fileDate}>{formatDate(f.created_at)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
