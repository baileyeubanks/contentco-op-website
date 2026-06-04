"use client";

import { useEffect } from "react";

export function PublicPwaRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Installability should degrade gracefully if the worker cannot register.
      });
    }
  }, []);

  return null;
}
