"use client";

import { useRef } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/animations";

export function AnimatedSuite({ children }: { children: React.ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = scope.current;
      if (!el) return;
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const kicker = el.querySelector("p");
      const title = el.querySelector("h1");

      if (kicker) {
        gsap.from(kicker, {
          y: 20,
          opacity: 0,
          duration: 0.7,
          ease: "power3.out",
          delay: 0.15,
        });
      }

      if (title) {
        gsap.from(title, {
          y: 50,
          opacity: 0,
          duration: 1,
          ease: "power3.out",
          delay: 0.25,
        });
      }

      const cards = el.querySelectorAll("a[class*='card']");
      if (cards.length) {
        gsap.from(cards, {
          y: 70,
          opacity: 0,
          scale: 0.95,
          duration: 0.9,
          stagger: 0.15,
          ease: "power3.out",
          delay: 0.4,
        });
      }

      const ctas = el.querySelector("div[class*='heroCtas']");
      if (ctas) {
        gsap.from(ctas, {
          y: 20,
          opacity: 0,
          duration: 0.7,
          ease: "power3.out",
          delay: 0.9,
        });
      }
    },
    { scope }
  );

  return <div ref={scope}>{children}</div>;
}
