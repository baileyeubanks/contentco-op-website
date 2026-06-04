"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/animations";

export function AnimatedPortfolio({ children }: { children: React.ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = scope.current;
      if (!el) return;
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      gsap.from(el.querySelectorAll("[class*='filterDeck'] button"), {
        opacity: 0,
        duration: 0.6,
        stagger: 0.05,
        ease: "power3.out",
        delay: 0.5,
      });
    },
    { scope }
  );

  return <div ref={scope}>{children}</div>;
}
