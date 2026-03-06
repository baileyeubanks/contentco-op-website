import { create } from 'zustand';
import type { MediaAsset } from '../types';

interface MediaState {
  assets: MediaAsset[];
  loading: boolean;
}

interface MediaActions {
  addAsset: (asset: MediaAsset) => void;
  removeAsset: (id: string) => void;
  updateAsset: (id: string, patch: Partial<MediaAsset>) => void;
  setAssets: (assets: MediaAsset[]) => void;
  setLoading: (loading: boolean) => void;
  getAsset: (id: string) => MediaAsset | undefined;
}

export type MediaStore = MediaState & MediaActions;

export const useMediaStore = create<MediaStore>()((set, get) => ({
  assets: [],
  loading: false,

  addAsset: (asset) =>
    set((s) => ({ assets: [...s.assets, asset] })),

  removeAsset: (id) =>
    set((s) => ({ assets: s.assets.filter((a) => a.id !== id) })),

  updateAsset: (id, patch) =>
    set((s) => ({
      assets: s.assets.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    })),

  setAssets: (assets) => set({ assets }),

  setLoading: (loading) => set({ loading }),

  getAsset: (id) => get().assets.find((a) => a.id === id),
}));
