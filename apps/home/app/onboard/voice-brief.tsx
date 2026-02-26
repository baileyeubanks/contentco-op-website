"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import s from "./page.module.css";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface FormState {
  contact_name: string;
  contact_email: string;
  phone: string;
  company: string;
  role: string;
  location: string;
  content_type: string;
  deliverables: string[];
  audience: string;
  tone: string;
  deadline: string;
  objective: string;
  key_messages: string;
  references: string;
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

interface AIResponse {
  message: string;
  extracted: Partial<Record<string, string | string[]>>;
  ready_for_estimate: boolean;
  estimate: {
    low: number;
    high: number;
    weeks: number;
    breakdown: string;
  } | null;
}

interface VoiceBriefProps {
  onComplete: (form: FormState) => void;
}

export default function VoiceBrief({ onComplete }: VoiceBriefProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [supported, setSupported] = useState(true);
  const [extracted, setExtracted] = useState<Partial<Record<string, string | string[]>>>({});
  const [estimate, setEstimate] = useState<AIResponse["estimate"]>(null);
  const [liveTranscript, setLiveTranscript] = useState("");

  const recognitionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  // Initialize speech recognition
  useEffect(() => {
    const w = window as any;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (e: any) => {
      let full = "";
      for (let i = 0; i < e.results.length; i++) {
        full += e.results[i][0].transcript;
      }
      setLiveTranscript(full);
      setInput(full);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
  }, []);

  // Send initial greeting on mount
  useEffect(() => {
    sendToAI([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      setLiveTranscript("");
      try {
        recognitionRef.current.start();
        setListening(true);
      } catch {
        // already started
      }
    }
  }, [listening]);

  async function sendToAI(chatHistory: ChatMsg[]) {
    setThinking(true);
    try {
      const res = await fetch("/api/onboard/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chatHistory }),
      });

      if (!res.ok) throw new Error("AI error");

      const data: AIResponse = await res.json();

      // Update extracted fields
      if (data.extracted) {
        setExtracted((prev) => {
          const merged = { ...prev };
          for (const [k, v] of Object.entries(data.extracted)) {
            if (v !== null && v !== undefined && v !== "") {
              merged[k] = v;
            }
          }
          return merged;
        });
      }

      if (data.estimate) {
        setEstimate(data.estimate);
      }

      const aiMsg: ChatMsg = { role: "assistant", content: data.message };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I had a connection issue. Could you try saying that again?",
        },
      ]);
    }
    setThinking(false);
  }

  function handleSend() {
    const text = input.trim();
    if (!text || thinking) return;

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
    }

    const userMsg: ChatMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLiveTranscript("");

    sendToAI(newMessages);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleFinish() {
    const form: FormState = {
      contact_name: (extracted.contact_name as string) || "",
      contact_email: (extracted.contact_email as string) || "",
      phone: (extracted.phone as string) || "",
      company: (extracted.company as string) || "",
      role: (extracted.role as string) || "",
      location: (extracted.location as string) || "",
      content_type: (extracted.content_type as string) || "",
      deliverables: Array.isArray(extracted.deliverables)
        ? (extracted.deliverables as string[])
        : typeof extracted.deliverables === "string"
          ? extracted.deliverables.split(/,\s*/)
          : [],
      audience: (extracted.audience as string) || "",
      tone: (extracted.tone as string) || "",
      deadline: (extracted.deadline as string) || "",
      objective: (extracted.objective as string) || "",
      key_messages: (extracted.key_messages as string) || "",
      references: (extracted.references as string) || "",
    };
    onComplete(form);
  }

  const filledCount = Object.entries(extracted).filter(
    ([, v]) =>
      v !== null &&
      v !== undefined &&
      v !== "" &&
      !(Array.isArray(v) && v.length === 0),
  ).length;
  const totalFields = 14;
  const progress = Math.round((filledCount / totalFields) * 100);

  if (!supported) {
    return (
      <div
        className={s.panel}
        style={{ textAlign: "center", padding: "2rem" }}
      >
        <h2 className={s.panelTitle}>Voice input not available</h2>
        <p className={s.panelSub}>
          Your browser doesn&apos;t support speech recognition. You can still
          type your answers below.
        </p>
      </div>
    );
  }

  return (
    <div className={s.panel} style={{ padding: 0, overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          padding: "1.2rem 1.4rem .8rem",
          borderBottom: "1px solid #1e3453",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <span
              className={s.kicker}
              style={{ margin: 0, fontSize: ".65rem" }}
            >
              AI Creative Brief
            </span>
            <p
              style={{
                margin: ".2rem 0 0",
                fontSize: ".76rem",
                color: "#5a7ea8",
              }}
            >
              {filledCount} of {totalFields} fields captured
            </p>
          </div>
          <span
            style={{
              fontSize: ".72rem",
              color: "#6b9fd4",
              fontWeight: 600,
            }}
          >
            {progress}%
          </span>
        </div>
        <div
          style={{
            height: 3,
            borderRadius: 2,
            background: "#1e3453",
            marginTop: ".6rem",
          }}
        >
          <div
            style={{
              height: "100%",
              borderRadius: 2,
              background: "#6b9fd4",
              width: `${progress}%`,
              transition: "width .3s ease",
            }}
          />
        </div>
      </div>

      {/* Chat messages */}
      <div
        style={{
          height: 400,
          overflowY: "auto",
          padding: "1rem 1.4rem",
          display: "flex",
          flexDirection: "column",
          gap: ".8rem",
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent:
                msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "80%",
                padding: ".7rem 1rem",
                borderRadius:
                  msg.role === "user"
                    ? "14px 14px 4px 14px"
                    : "14px 14px 14px 4px",
                background:
                  msg.role === "user"
                    ? "rgba(107, 159, 212, 0.15)"
                    : "#0a1524",
                border: `1px solid ${
                  msg.role === "user"
                    ? "rgba(107, 159, 212, 0.3)"
                    : "#1e3453"
                }`,
                fontSize: ".86rem",
                lineHeight: 1.55,
                color:
                  msg.role === "user" ? "#d4e5ff" : "#c8d8ef",
              }}
            >
              {msg.role === "assistant" && (
                <span
                  style={{
                    display: "block",
                    fontSize: ".6rem",
                    letterSpacing: ".14em",
                    textTransform: "uppercase",
                    color: "#6b9fd4",
                    fontWeight: 700,
                    marginBottom: ".3rem",
                  }}
                >
                  Content Co-op AI
                </span>
              )}
              {msg.content}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {thinking && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div
              style={{
                padding: ".7rem 1rem",
                borderRadius: "14px 14px 14px 4px",
                background: "#0a1524",
                border: "1px solid #1e3453",
                fontSize: ".86rem",
                color: "#5a7ea8",
              }}
            >
              <span
                style={{
                  display: "block",
                  fontSize: ".6rem",
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: "#6b9fd4",
                  fontWeight: 700,
                  marginBottom: ".3rem",
                }}
              >
                Content Co-op AI
              </span>
              <span style={{ display: "inline-flex", gap: 4 }}>
                <span
                  style={{
                    animation:
                      "waveBar .6s ease-in-out 0s infinite alternate",
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#5a7ea8",
                    display: "inline-block",
                  }}
                />
                <span
                  style={{
                    animation:
                      "waveBar .6s ease-in-out 0.15s infinite alternate",
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#5a7ea8",
                    display: "inline-block",
                  }}
                />
                <span
                  style={{
                    animation:
                      "waveBar .6s ease-in-out 0.3s infinite alternate",
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#5a7ea8",
                    display: "inline-block",
                  }}
                />
              </span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Estimate card */}
      {estimate && (
        <div
          style={{
            margin: "0 1.4rem",
            padding: ".8rem 1rem",
            borderRadius: 12,
            border: "1px solid rgba(107, 159, 212, 0.28)",
            background: "rgba(107, 159, 212, 0.06)",
            marginBottom: ".8rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: ".4rem",
            }}
          >
            <span
              style={{
                fontSize: ".62rem",
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "#6b9fd4",
                fontWeight: 700,
              }}
            >
              Preliminary Estimate
            </span>
            <span
              style={{
                fontSize: "1.1rem",
                fontWeight: 700,
                color: "#edf3ff",
                letterSpacing: "-.02em",
              }}
            >
              ${estimate.low.toLocaleString()} &ndash; $
              {estimate.high.toLocaleString()}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: ".72rem", color: "#7a9bc4" }}>
              ~{estimate.weeks}-week delivery
            </span>
          </div>
          {estimate.breakdown && (
            <p
              style={{
                fontSize: ".76rem",
                color: "#5a7ea8",
                margin: ".5rem 0 0",
                lineHeight: 1.5,
              }}
            >
              {estimate.breakdown}
            </p>
          )}
          <button
            className={s.btnNext}
            onClick={handleFinish}
            type="button"
            style={{ marginTop: ".8rem", width: "100%" }}
          >
            Review &amp; Submit Brief
          </button>
        </div>
      )}

      {/* Input area */}
      <div
        style={{
          padding: ".8rem 1.4rem 1rem",
          borderTop: "1px solid #1e3453",
          background: "#0a1220",
        }}
      >
        {/* Live transcript while recording */}
        {listening && liveTranscript && (
          <div
            style={{
              fontSize: ".76rem",
              color: "#6b9fd4",
              marginBottom: ".5rem",
              fontStyle: "italic",
              padding: ".3rem .5rem",
              borderRadius: 6,
              background: "rgba(107, 159, 212, 0.06)",
            }}
          >
            {liveTranscript}
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: ".5rem",
            alignItems: "flex-end",
          }}
        >
          {/* Mic button */}
          <button
            onClick={toggleListening}
            type="button"
            style={{
              width: 44,
              height: 44,
              minWidth: 44,
              borderRadius: "50%",
              border: listening
                ? "2px solid #6b9fd4"
                : "2px solid #2b4263",
              background: listening
                ? "rgba(107, 159, 212, 0.15)"
                : "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all .2s ease",
              animation: listening
                ? "voicePulse 1.5s ease-in-out infinite"
                : "none",
            }}
            title={listening ? "Stop recording" : "Start recording"}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke={listening ? "#6b9fd4" : "#5a7ea8"}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>

          {/* Text input */}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              listening
                ? "Listening... speak naturally"
                : "Type your message or tap the mic"
            }
            rows={1}
            style={{
              flex: 1,
              border: "1px solid #325276",
              borderRadius: 12,
              background: "#0d1a2e",
              color: "#e9f0ff",
              padding: ".6rem .75rem",
              fontSize: ".86rem",
              fontFamily: "inherit",
              outline: "none",
              resize: "none",
              minHeight: 44,
              maxHeight: 120,
              transition: "border-color 140ms ease",
              lineHeight: 1.4,
            }}
            onFocus={(e) =>
              (e.currentTarget.style.borderColor = "#6b9fd4")
            }
            onBlur={(e) =>
              (e.currentTarget.style.borderColor = "#325276")
            }
          />

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || thinking}
            type="button"
            style={{
              width: 44,
              height: 44,
              minWidth: 44,
              borderRadius: "50%",
              border: "none",
              background:
                input.trim() && !thinking ? "#6b9fd4" : "#1e3453",
              cursor:
                input.trim() && !thinking
                  ? "pointer"
                  : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all .2s ease",
            }}
            title="Send message"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke={
                input.trim() && !thinking ? "#0c1322" : "#4a6888"
              }
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>

        <p
          style={{
            margin: ".5rem 0 0",
            fontSize: ".64rem",
            color: "#3a5470",
            textAlign: "center",
          }}
        >
          {listening
            ? "Recording\u2026 click mic to stop, then send"
            : "Speak or type \u2022 Press Enter to send"}
        </p>
      </div>
    </div>
  );
}
