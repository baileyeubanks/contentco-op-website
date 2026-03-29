/**
 * Project persistence — save/load projects to IndexedDB.
 * Auto-saves every 30s.
 */

import { useElementStore } from '../store/elementStore';
import { usePlaybackStore } from '../store/playbackStore';
import { useTimelineStore } from '../store/timelineStore';
import type { Element } from '../types';

const DB_NAME = 'coedit-projects';
const DB_VERSION = 1;
const STORE_NAME = 'projects';
const AUTOSAVE_KEY = '__autosave__';

interface ProjectData {
  id: string;
  name: string;
  elements: Element[];
  duration: number;
  tracks: any[];
  createdAt: string;
  updatedAt: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Save the current project state to IndexedDB.
 */
export async function saveProject(name?: string): Promise<void> {
  const elements = useElementStore.getState().elements;
  const duration = usePlaybackStore.getState().duration;
  const tracks = useTimelineStore.getState().tracks;

  const project: ProjectData = {
    id: AUTOSAVE_KEY,
    name: name || 'Untitled Project',
    elements,
    duration,
    tracks,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.put(project);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Load the auto-saved project from IndexedDB.
 */
export async function loadProject(): Promise<boolean> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve) => {
      const request = store.get(AUTOSAVE_KEY);
      request.onsuccess = () => {
        const project = request.result as ProjectData | undefined;
        if (!project || !project.elements?.length) {
          resolve(false);
          return;
        }

        // Restore state
        useElementStore.getState().setElements(project.elements);
        usePlaybackStore.getState().setDuration(project.duration || 30);

        if (project.tracks) {
          useTimelineStore.setState({ tracks: project.tracks });
        }

        resolve(true);
      };
      request.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Export project as JSON file for download.
 */
export function exportProjectJSON(): void {
  const elements = useElementStore.getState().elements;
  const duration = usePlaybackStore.getState().duration;
  const tracks = useTimelineStore.getState().tracks;

  const data = {
    version: 1,
    name: 'CoEdit Project',
    elements,
    duration,
    tracks,
    exportedAt: new Date().toISOString(),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `coedit-project-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Import project from JSON file.
 */
export async function importProjectJSON(file: File): Promise<boolean> {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.elements || !Array.isArray(data.elements)) {
      return false;
    }

    useElementStore.getState().setElements(data.elements);
    if (data.duration) usePlaybackStore.getState().setDuration(data.duration);
    if (data.tracks) useTimelineStore.setState({ tracks: data.tracks });

    return true;
  } catch {
    return false;
  }
}

let autosaveInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start auto-saving every 30 seconds.
 */
export function startAutosave(): void {
  if (autosaveInterval) return;
  autosaveInterval = setInterval(() => {
    saveProject().catch(() => {});
  }, 30000);
}

/**
 * Stop auto-saving.
 */
export function stopAutosave(): void {
  if (autosaveInterval) {
    clearInterval(autosaveInterval);
    autosaveInterval = null;
  }
}
