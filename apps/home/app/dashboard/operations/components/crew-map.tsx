"use client";

import { useEffect, useRef } from "react";

interface CrewMarker {
  crew_member_id: string;
  name: string;
  color: string;
  lat: number;
  lng: number;
  status: string;
}

interface SiteMarker {
  lat: number;
  lng: number;
  client_name: string;
  address: string;
  status: string;
  job_id?: string;
}

interface CrewMapProps {
  crew: CrewMarker[];
  sites: SiteMarker[];
  selectedCrewId?: string | null;
  onSelectCrew?: (id: string) => void;
  showGeofences?: boolean;
}

// Geofence thresholds (matching crewReportLocation.js)
const GEOFENCE_INSIDE_M = 300;
const GEOFENCE_OUTSIDE_M = 600;

export function CrewMap({ crew, sites, selectedCrewId, onSelectCrew, showGeofences = true }: CrewMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (!mapRef.current) return;

    // Dynamically load Leaflet to avoid SSR issues
    const loadLeaflet = async () => {
      if (typeof window === "undefined") return;

      const L = await import("leaflet");

      // Load CSS
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      if (leafletMap.current) {
        leafletMap.current.remove();
      }

      const map = L.map(mapRef.current!, {
        center: [29.7604, -95.3698], // Houston
        zoom: 11,
        maxZoom: 19,
        zoomControl: true,
      });

      // CartoDB Dark tiles
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://carto.com">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);

      leafletMap.current = map;
      updateMarkers(L, map);
    };

    loadLeaflet();

    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers when data changes
  useEffect(() => {
    if (!leafletMap.current) return;

    const loadAndUpdate = async () => {
      const L = await import("leaflet");
      updateMarkers(L, leafletMap.current);
    };
    loadAndUpdate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crew, sites, showGeofences]);

  // Fly to selected crew
  useEffect(() => {
    if (!leafletMap.current || !selectedCrewId) return;
    const member = crew.find(c => c.crew_member_id === selectedCrewId);
    if (member) {
      leafletMap.current.flyTo([member.lat, member.lng], 15, { duration: 0.8 });
    }
  }, [selectedCrewId, crew]);

  function updateMarkers(L: any, map: any) {
    // Clear existing
    for (const m of markersRef.current) {
      map.removeLayer(m);
    }
    markersRef.current = [];

    // Site markers (green dots) + geofence circles
    for (const site of sites) {
      if (!site.lat || !site.lng) continue;

      const siteMarker = L.circleMarker([site.lat, site.lng], {
        radius: 6,
        fillColor: "#3ec983",
        color: "#3ec983",
        weight: 1,
        opacity: 0.8,
        fillOpacity: 0.6,
      }).addTo(map);

      siteMarker.bindPopup(`
        <div style="font-family:sans-serif;font-size:12px;">
          <strong>${site.client_name}</strong><br/>
          ${site.address}<br/>
          <span style="text-transform:uppercase;font-size:10px;font-weight:600;">${site.status}</span>
        </div>
      `);
      markersRef.current.push(siteMarker);

      // Geofence circles
      if (showGeofences) {
        const insideCircle = L.circle([site.lat, site.lng], {
          radius: GEOFENCE_INSIDE_M,
          color: "#3ec983",
          fillColor: "#3ec983",
          fillOpacity: 0.05,
          weight: 1,
          dashArray: "6 4",
        }).addTo(map);
        markersRef.current.push(insideCircle);

        const outsideCircle = L.circle([site.lat, site.lng], {
          radius: GEOFENCE_OUTSIDE_M,
          color: "#de7676",
          fillColor: "#de7676",
          fillOpacity: 0.03,
          weight: 1,
          dashArray: "6 4",
        }).addTo(map);
        markersRef.current.push(outsideCircle);
      }
    }

    // Crew markers (colored circles with initial)
    for (const member of crew) {
      if (!member.lat || !member.lng) continue;

      const initial = (member.name || "?").charAt(0).toUpperCase();
      const color = member.color || "#3d7dd8";
      const isSelected = member.crew_member_id === selectedCrewId;

      const icon = L.divIcon({
        className: "",
        html: `<div style="
          width:${isSelected ? 38 : 32}px;
          height:${isSelected ? 38 : 32}px;
          border-radius:50%;
          background:${color};
          color:#fff;
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:${isSelected ? 16 : 14}px;
          font-weight:700;
          font-family:sans-serif;
          border:${isSelected ? "3px solid #fff" : "2px solid rgba(255,255,255,0.4)"};
          box-shadow:0 2px 8px rgba(0,0,0,0.4);
          cursor:pointer;
        ">${initial}</div>`,
        iconSize: [isSelected ? 38 : 32, isSelected ? 38 : 32],
        iconAnchor: [isSelected ? 19 : 16, isSelected ? 19 : 16],
      });

      const marker = L.marker([member.lat, member.lng], { icon }).addTo(map);
      marker.on("click", () => onSelectCrew?.(member.crew_member_id));

      const statusColors: Record<string, string> = {
        arrived: "#3ec983",
        in_progress: "#3ec983",
        on_my_way: "#e4ad5b",
        completed: "#8ba4c4",
      };

      marker.bindPopup(`
        <div style="font-family:sans-serif;font-size:12px;">
          <strong>${member.name}</strong><br/>
          <span style="color:${statusColors[member.status] || "#9cadc8"};font-weight:600;text-transform:uppercase;font-size:10px;">
            ${member.status.replace(/_/g, " ")}
          </span>
        </div>
      `);
      markersRef.current.push(marker);
    }
  }

  return (
    <div
      ref={mapRef}
      style={{
        width: "100%",
        height: "100%",
        minHeight: 500,
        borderRadius: 12,
        overflow: "hidden",
      }}
    />
  );
}
