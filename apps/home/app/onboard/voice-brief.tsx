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

interface QA {
  question: string;
  answer: string;
  field: string;
}

const QUESTIONS: { question: string; field: string; hint: string }[] = [
  { question: "What's your name?", field: "contact_name", hint: "e.g. Jane Smith" },
  { question: "What's your email address?", field: "contact_email", hint: "e.g. jane@company.com" },
  { question: "What company are you with?", field: "company", hint: "e.g. Acme Energy Co." },
  { question: "What kind of content are you looking for?", field: "content_type", hint: "e.g. Safety Film, Brand Reel, Training Video" },
  { question: "What deliverables will you need?", field: "deliverables", hint: "e.g. Final Cut, Social Cuts, B-Roll Pack" },
  { question: "Who's the target audience?", field: "audience", hint: "e.g. Field Ops, Executive, External" },
  { question: "What tone or feel do you want?", field: "tone", hint: "e.g. Cinematic, Documentary, Corporate" },
  { question: "When do you need it delivered?", field: "deadline", hint: "e.g. end of March, 6 weeks, flexible" },
  { question: "What's the main objective of this content?", field: "objective", hint: "e.g. Drive Behavior, Build Trust, Train staff" },
  { question: "Any key messages the viewer should take away?", field: "key_messages", hint: "What should they know, feel, or do?" },
  { question: "Any references or inspiration? YouTube links, competitors, look-and-feel?", field: "references", hint: "Paste a link or describe it" },
];

interface VoiceBriefProps {
  onComplete: (form: FormState) => void;
}

export default function VoiceBrief({ onComplete }: VoiceBriefProps) {
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<QA[]>([]);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [editingText, setEditingText] = useState("");
  const recognitionRef = useRef<any>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const w = window as any;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (e: any) => {
      let interim = "";
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalText += e.results[i][0].transcript;
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      if (finalText) {
        setTranscript((prev: string) => (prev + " " + finalText).trim());
        setEditingText((prev: string) => (prev + " " + finalText).trim());
      } else {
        setTranscript((prev: string) => prev + interim);
      }
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
  }, []);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
    } else {
      setTranscript("");
      setEditingText("");
      try {
        recognitionRef.current.start();
        setListening(true);
      } catch {
        // already started
      }
    }
  }, [listening]);

  function confirmAnswer() {
    const answer = editingText.trim();
    if (!answer) return;

    const q = QUESTIONS[qIndex];
    setAnswers((prev) => [...prev, { question: q.question, answer, field: q.field }]);
    setTranscript("");
    setEditingText("");

    if (qIndex < QUESTIONS.length - 1) {
      setQIndex(qIndex + 1);
    } else {
      // All questions answered — build form
      const allAnswers = [...answers, { question: q.question, answer, field: q.field }];
      const form = buildForm(allAnswers);
      onComplete(form);
    }
  }

  function buildForm(qa: QA[]): FormState {
    const form: FormState = {
      contact_name: "", contact_email: "", phone: "", company: "", role: "", location: "",
      content_type: "", deliverables: [], audience: "", tone: "", deadline: "",
      objective: "", key_messages: "", references: "",
    };
    for (const { field, answer } of qa) {
      if (field === "deliverables") {
        form.deliverables = answer.split(/,\s*/).map((s) => s.trim()).filter(Boolean);
      } else {
        (form as any)[field] = answer;
      }
    }
    return form;
  }

  const currentQ = QUESTIONS[qIndex];
  const progress = ((qIndex) / QUESTIONS.length) * 100;

  if (!supported) {
    return (
      <div className={s.panel} style={{ textAlign: "center", padding: "2rem" }}>
        <h2 className={s.panelTitle}>Voice input not available</h2>
        <p className={s.panelSub}>
          Your browser doesn&apos;t support speech recognition. Please use Chrome, Edge, or Safari, or switch to the manual form.
        </p>
      </div>
    );
  }

  return (
    <div className={s.panel}>
      {/* Progress */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".8rem" }}>
        <span className={s.kicker} style={{ margin: 0 }}>
          Question {qIndex + 1} of {QUESTIONS.length}
        </span>
        <span style={{ fontSize: ".72rem", color: "#5a7ea8" }}>{Math.round(progress)}% complete</span>
      </div>
      <div style={{ height: 3, borderRadius: 2, background: "#1e3453", marginBottom: "1.4rem" }}>
        <div style={{ height: "100%", borderRadius: 2, background: "#6b9fd4", width: `${progress}%`, transition: "width .3s ease" }} />
      </div>

      {/* Current question */}
      <h2 className={s.panelTitle} style={{ fontSize: "1.2rem", marginBottom: ".3rem" }}>{currentQ.question}</h2>
      <p className={s.panelSub} style={{ marginBottom: "1.2rem" }}>{currentQ.hint}</p>

      {/* Waveform / listening indicator */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1rem",
          margin: "1rem 0",
        }}
      >
        <button
          onClick={toggleListening}
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            border: listening ? "3px solid #6b9fd4" : "3px solid #2b4263",
            background: listening ? "rgba(107, 159, 212, 0.15)" : "#0d1a2e",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all .2s ease",
            animation: listening ? "voicePulse 1.5s ease-in-out infinite" : "none",
          }}
          title={listening ? "Stop listening" : "Tap to speak"}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={listening ? "#6b9fd4" : "#5a7ea8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </button>
        <span style={{ fontSize: ".72rem", color: listening ? "#6b9fd4" : "#4a6888", letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 600 }}>
          {listening ? "Listening..." : "Tap to speak"}
        </span>

        {/* Waveform bars */}
        {listening && (
          <div style={{ display: "flex", gap: 3, alignItems: "center", height: 24 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 3,
                  borderRadius: 2,
                  background: "#6b9fd4",
                  animation: `waveBar .6s ease-in-out ${i * 0.05}s infinite alternate`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Transcript / editable text */}
      {(transcript || editingText) && (
        <div style={{ marginTop: ".6rem" }}>
          <label style={{ fontSize: ".68rem", letterSpacing: ".1em", textTransform: "uppercase", color: "#7a9bc4", fontWeight: 700, display: "block", marginBottom: ".3rem" }}>
            Your answer
          </label>
          <textarea
            className={s.textarea}
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            rows={3}
            style={{ minHeight: 60 }}
          />
          <div style={{ display: "flex", gap: ".5rem", marginTop: ".5rem" }}>
            <button
              className={s.btnNext}
              onClick={confirmAnswer}
              disabled={!editingText.trim()}
              type="button"
            >
              {qIndex < QUESTIONS.length - 1 ? "Next question" : "Finish"}
            </button>
            <button
              className={s.btnBack}
              onClick={() => { setTranscript(""); setEditingText(""); }}
              type="button"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Or type it */}
      {!transcript && !editingText && !listening && (
        <div style={{ marginTop: ".6rem" }}>
          <label style={{ fontSize: ".68rem", letterSpacing: ".1em", textTransform: "uppercase", color: "#7a9bc4", fontWeight: 700, display: "block", marginBottom: ".3rem" }}>
            Or type your answer
          </label>
          <textarea
            className={s.textarea}
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            placeholder={currentQ.hint}
            rows={2}
            style={{ minHeight: 50 }}
          />
          {editingText.trim() && (
            <button
              className={s.btnNext}
              onClick={confirmAnswer}
              type="button"
              style={{ marginTop: ".5rem" }}
            >
              {qIndex < QUESTIONS.length - 1 ? "Next question" : "Finish"}
            </button>
          )}
        </div>
      )}

      {/* Previous answers */}
      {answers.length > 0 && (
        <div style={{ marginTop: "1.4rem", borderTop: "1px solid #1e3453", paddingTop: ".8rem" }}>
          <span style={{ fontSize: ".62rem", letterSpacing: ".14em", textTransform: "uppercase", color: "#4a6888", fontWeight: 700 }}>
            Previous answers
          </span>
          <div style={{ marginTop: ".4rem", display: "grid", gap: ".3rem" }}>
            {answers.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: ".5rem", padding: ".3rem 0", borderBottom: "1px solid #13253d" }}>
                <span style={{ fontSize: ".68rem", color: "#5a7ea8", whiteSpace: "nowrap", minWidth: 60, textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 600 }}>
                  Q{i + 1}
                </span>
                <span style={{ fontSize: ".82rem", color: "#d4e5ff" }}>{a.answer}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
