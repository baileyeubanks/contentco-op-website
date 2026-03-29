"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";

const ENABLE_PUBLIC_ROOT_REALTIME = false;

export function useRealtimeTableRefresh(tables: string[], onRefresh: () => void) {
  useEffect(() => {
    if (!tables.length) return;
    if (!ENABLE_PUBLIC_ROOT_REALTIME) return;

    const supabase = createClient();
    let timeoutId: number | null = null;

    const scheduleRefresh = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => {
        onRefresh();
      }, 250);
    };

    const channels = tables.map((table) =>
      supabase
        .channel(`root-refresh-${table}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          scheduleRefresh,
        )
        .subscribe(),
    );

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      for (const channel of channels) {
        void supabase.removeChannel(channel);
      }
    };
  }, [onRefresh, tables]);
}
