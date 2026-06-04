"use client";

import { useEffect, useRef, useCallback } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export { gsap, ScrollTrigger, useGSAP };

export function useScrollReveal(
  selector: string,
  opts?: { y?: number; stagger?: number; duration?: number; start?: string }
) {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = containerRef.current;
      if (!el) return;
      const targets = el.querySelectorAll(selector);
      if (!targets.length) return;

      gsap.from(targets, {
        y: opts?.y ?? 40,
        opacity: 0,
        duration: opts?.duration ?? 0.8,
        stagger: opts?.stagger ?? 0.08,
        ease: "power3.out",
        scrollTrigger: {
          trigger: el,
          start: opts?.start ?? "top 85%",
          toggleActions: "play none none none",
        },
      });
    },
    { scope: containerRef }
  );

  return containerRef;
}

export function useMagnetic(strength = 0.3) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia("(pointer: coarse)").matches) return;

    const xTo = gsap.quickTo(el, "x", { duration: 0.6, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "power3.out" });

    function onMove(e: MouseEvent) {
      const rect = el!.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      xTo((e.clientX - cx) * strength);
      yTo((e.clientY - cy) * strength);
    }

    function onLeave() {
      xTo(0);
      yTo(0);
    }

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [strength]);

  return ref;
}

export function useTextReveal() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      const words = el.textContent?.split(/\s+/) ?? [];
      if (!words.length) return;

      el.innerHTML = words
        .map((w) => `<span class="tr-word"><span class="tr-inner">${w}</span></span>`)
        .join(" ");

      gsap.from(el.querySelectorAll(".tr-inner"), {
        yPercent: 110,
        opacity: 0,
        duration: 0.7,
        stagger: 0.04,
        ease: "power3.out",
        scrollTrigger: {
          trigger: el,
          start: "top 88%",
          toggleActions: "play none none none",
        },
      });
    },
    { scope: ref }
  );

  return ref;
}

export function useParallax(speed = 0.15) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      gsap.to(el, {
        yPercent: speed * 100,
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      });
    },
    { scope: ref }
  );

  return ref;
}
