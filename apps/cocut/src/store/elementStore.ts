import { create } from 'zustand';
import { temporal } from 'zundo';
import type { Element } from '../types';
import { uid } from '../utils/uid';

interface ElementState {
  elements: Element[];
  selectedIds: Set<string>;
}

interface ElementActions {
  addElement: (el: Element) => void;
  addElements: (els: Element[]) => void;
  updateElement: (id: string, patch: Partial<Element>) => void;
  deleteElements: (ids: string[]) => void;
  duplicateElements: (ids: string[]) => void;
  setElements: (els: Element[]) => void;
  clearAll: () => void;
  selectElement: (id: string, additive?: boolean) => void;
  deselectAll: () => void;
  selectAll: () => void;
  moveLayer: (id: string, direction: 'up' | 'down' | 'top' | 'bottom') => void;
}

export type ElementStore = ElementState & ElementActions;

export const useElementStore = create<ElementStore>()(
  temporal(
    (set, get) => ({
      elements: [],
      selectedIds: new Set<string>(),

      addElement: (el) =>
        set((s) => ({ elements: [...s.elements, el] })),

      addElements: (els) =>
        set((s) => ({ elements: [...s.elements, ...els] })),

      updateElement: (id, patch) =>
        set((s) => ({
          elements: s.elements.map((e) =>
            e.id === id ? { ...e, ...patch } as Element : e,
          ),
        })),

      deleteElements: (ids) =>
        set((s) => ({
          elements: s.elements.filter((e) => !ids.includes(e.id)),
          selectedIds: new Set([...s.selectedIds].filter((id) => !ids.includes(id))),
        })),

      duplicateElements: (ids) => {
        const state = get();
        const dupes = state.elements
          .filter((e) => ids.includes(e.id))
          .map((e) => ({ ...e, id: uid(), x: e.x + 20, y: e.y + 20, name: e.name + ' copy' } as Element));
        set((s) => ({
          elements: [...s.elements, ...dupes],
          selectedIds: new Set(dupes.map((d) => d.id)),
        }));
      },

      setElements: (els) => set({ elements: els }),

      clearAll: () => set({ elements: [], selectedIds: new Set() }),

      selectElement: (id, additive = false) =>
        set((s) => {
          if (additive) {
            const next = new Set(s.selectedIds);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return { selectedIds: next };
          }
          return { selectedIds: new Set([id]) };
        }),

      deselectAll: () => set({ selectedIds: new Set() }),

      selectAll: () =>
        set((s) => ({ selectedIds: new Set(s.elements.map((e) => e.id)) })),

      moveLayer: (id, direction) =>
        set((s) => {
          const idx = s.elements.findIndex((e) => e.id === id);
          if (idx < 0) return s;
          const next = [...s.elements];
          let target: number;
          switch (direction) {
            case 'up': target = idx + 1; break;
            case 'down': target = idx - 1; break;
            case 'top': target = next.length - 1; break;
            case 'bottom': target = 0; break;
          }
          if (target < 0 || target >= next.length) return s;
          if (direction === 'top' || direction === 'bottom') {
            const [item] = next.splice(idx, 1);
            next.splice(target, 0, item);
          } else {
            [next[idx], next[target]] = [next[target], next[idx]];
          }
          return { elements: next };
        }),
    }),
    {
      limit: 50,
      equality: (a, b) => JSON.stringify(a.elements) === JSON.stringify(b.elements),
    },
  ),
);
