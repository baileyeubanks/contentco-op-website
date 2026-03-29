import type { EasingType } from '../types';

export function applyEasing(t: number, ease: EasingType): number {
  switch (ease) {
    case 'ease-in':
      return t * t;
    case 'ease-out':
      return t * (2 - t);
    case 'ease-in-out':
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    case 'bounce': {
      const n = 7.5625;
      const d = 2.75;
      if (t < 1 / d) return n * t * t;
      if (t < 2 / d) { const t2 = t - 1.5 / d; return n * t2 * t2 + 0.75; }
      if (t < 2.5 / d) { const t2 = t - 2.25 / d; return n * t2 * t2 + 0.9375; }
      const t2 = t - 2.625 / d;
      return n * t2 * t2 + 0.984375;
    }
    default:
      return t;
  }
}
