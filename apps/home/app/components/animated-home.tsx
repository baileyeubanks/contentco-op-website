"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/animations";

export function AnimatedHome({ children }: { children: React.ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = scope.current;
      if (!el) return;
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      gsap.from(".hero-content h1", {
        y: 28,
        duration: 0.7,
        ease: "power3.out",
      });

      gsap.from(".hero-lede", {
        y: 14,
        duration: 0.55,
        ease: "power3.out",
        delay: 0.05,
      });

      gsap.from(".hero-actions", {
        y: 10,
        duration: 0.55,
        ease: "power3.out",
        delay: 0.1,
      });

      gsap.from(".client-logos", {
        opacity: 0,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".client-logos",
          start: "top 90%",
        },
      });

      const bleedStatement = el.querySelector(".bleed-statement");
      if (bleedStatement) {
        gsap.from(bleedStatement, {
          y: 40,
          opacity: 0,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: ".bleed",
            start: "top 60%",
          },
        });

        gsap.to(bleedStatement, {
          yPercent: -20,
          ease: "none",
          scrollTrigger: {
            trigger: ".bleed",
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        });
      }

      const bleedImg = el.querySelector(".bleed img");
      if (bleedImg) {
        gsap.to(bleedImg, {
          yPercent: 12,
          scale: 1.08,
          ease: "none",
          scrollTrigger: {
            trigger: ".bleed",
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        });
      }

      const gallerySection = el.querySelector(".cream-section-flush");
      if (gallerySection) {
        gsap.from(gallerySection, {
          opacity: 0,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: gallerySection,
            start: "top 85%",
          },
        });
      }

      const productsKicker = el.querySelector(".products-kicker");
      const productsHeadline = el.querySelector(".products-headline");
      if (productsKicker) {
        gsap.from(productsKicker, {
          opacity: 0,
          duration: 0.7,
          ease: "power3.out",
          scrollTrigger: {
            trigger: ".products-content",
            start: "top 80%",
          },
        });
      }
      if (productsHeadline) {
        gsap.from(productsHeadline, {
          opacity: 0,
          duration: 0.8,
          ease: "power3.out",
          delay: 0.1,
          scrollTrigger: {
            trigger: ".products-content",
            start: "top 80%",
          },
        });
      }

      const productCards = el.querySelectorAll(".product-card");
      if (productCards.length) {
        gsap.from(productCards, {
          opacity: 0,
          duration: 0.8,
          stagger: 0.12,
          ease: "power3.out",
          scrollTrigger: {
            trigger: ".products-grid",
            start: "top 85%",
          },
        });
      }

      const trustQuote = el.querySelector(".trust-quote");
      const trustPhoto = el.querySelector(".trust-photo");
      const trustSignoff = el.querySelector(".trust-signoff");

      if (trustQuote) {
        gsap.from(trustQuote, {
          y: 40,
          opacity: 0,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: ".trust",
            start: "top 75%",
          },
        });
      }

      if (trustPhoto) {
        gsap.from(trustPhoto, {
          scale: 0.85,
          opacity: 0,
          duration: 1,
          ease: "power3.out",
          delay: 0.2,
          scrollTrigger: {
            trigger: ".trust",
            start: "top 75%",
          },
        });

        gsap.to(trustPhoto, {
          yPercent: -8,
          ease: "none",
          scrollTrigger: {
            trigger: ".trust",
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        });
      }

      if (trustSignoff) {
        gsap.from(trustSignoff, {
          y: 20,
          opacity: 0,
          duration: 0.8,
          ease: "power3.out",
          delay: 0.4,
          scrollTrigger: {
            trigger: ".trust",
            start: "top 75%",
          },
        });
      }
    },
    { scope }
  );

  return <div ref={scope}>{children}</div>;
}
