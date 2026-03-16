"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AmbientVideo } from "./ambient-video";

const TAGLINES = [
  {
    line1: "Minimal stage,",
    line2: "maximum signal.",
    sub: "Industrial stories that hold up under scrutiny.",
  },
  {
    line1: "From the field,",
    line2: "to the boardroom.",
    sub: "We close the gap between what you do and what they see.",
  },
  {
    line1: "Twelve years",
    line2: "on the floor.",
    sub: "Every frame is a production decision.",
  },
  {
    line1: "Complex subjects,",
    line2: "clear stories.",
    sub: "Energy, infrastructure, and the people behind both.",
  },
  {
    line1: "Built for risk",
    line2: "environments.",
    sub: "Production systems designed for industrial timelines.",
  },
  {
    line1: "Not a vendor.",
    line2: "A content system.",
    sub: "Script, shoot, edit, and deliver — under one roof.",
  },
  {
    line1: "On-site.",
    line2: "On-deadline.",
    sub: "Field-to-boardroom turnarounds without the friction.",
  },
  {
    line1: "Energy stories",
    line2: "at scale.",
    sub: "Crews, cameras, and content infrastructure.",
  },
  {
    line1: "Industrial footage",
    line2: "that earns trust.",
    sub: "The lens that's been inside the fence line.",
  },
  {
    line1: "Every project",
    line2: "leaves a record.",
    sub: "Twelve years of work that still holds up.",
  },
];

interface HeroSectionProps {
  clips: string[];
}

export function HeroSection({ clips }: HeroSectionProps) {
  const [idx, setIdx] = useState(0);
  const [fade, setFade] = useState(true);

  const advance = useCallback(() => {
    setFade(false);
    setTimeout(() => {
      setIdx((prev) => (prev + 1) % TAGLINES.length);
      setFade(true);
    }, 600);
  }, []);

  useEffect(() => {
    const interval = setInterval(advance, 7000);
    return () => clearInterval(interval);
  }, [advance]);

  const t = TAGLINES[idx];

  return (
    <section className="hero">
      <AmbientVideo
        src={clips}
        poster="/cc/video/ambient-hero-poster.jpg"
        label="Industrial energy production footage"
      />
      <div className="hero-overlay" aria-hidden="true" />
      <div
        className="hero-content"
        style={{
          opacity: fade ? 1 : 0,
          transform: fade ? "translateY(0)" : "translateY(12px)",
          transition: "opacity 600ms ease, transform 600ms ease",
        }}
      >
        <h1>
          <span className="hero-thin">{t.line1}</span>
          <br />
          <em>{t.line2}</em>
        </h1>
        <p className="hero-subtitle">{t.sub}</p>
        <Link className="button light" href="/onboard">
          Start a Project
        </Link>
      </div>
    </section>
  );
}
