"use client";

import { useEffect, useRef, useState } from "react";
import { HERO_VARIANTS } from "./home-copy";

const HOLD_MS = 6000;
const FADE_OUT_MS = 600;

export function HeroCopyRotator() {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"visible" | "out" | "in">("visible");
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    function cycle() {
      timerRef.current = window.setTimeout(() => {
        setPhase("out");
        timerRef.current = window.setTimeout(() => {
          setIndex((c) => (c + 1) % HERO_VARIANTS.length);
          setPhase("in");
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setPhase("visible");
              cycle();
            });
          });
        }, FADE_OUT_MS);
      }, HOLD_MS);
    }
    cycle();
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const variant = HERO_VARIANTS[index];
  const cls =
    phase === "out" ? " is-out" : phase === "in" ? " is-in" : "";

  return (
    <h1 className={`hero-copy-rotator${cls}`}>
      <span className="hero-thin">{variant.line1}</span>
      <em>{variant.line2}</em>
    </h1>
  );
}
