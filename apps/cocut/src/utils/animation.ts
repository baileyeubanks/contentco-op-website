import type { AnimationType, EasingType } from '../types';
import { clamp } from './math';
import { applyEasing } from './easing';

export function getAnimTransform(
  anim: AnimationType,
  progress: number,
  easing: EasingType,
): React.CSSProperties {
  const t = applyEasing(clamp(progress, 0, 1), easing);
  switch (anim) {
    case 'fadeIn':
      return { opacity: t };
    case 'fadeOut':
      return { opacity: 1 - t };
    case 'slideLeft':
      return { opacity: t, transform: `translateX(${(1 - t) * 80}px)` };
    case 'slideRight':
      return { opacity: t, transform: `translateX(${(t - 1) * 80}px)` };
    case 'slideUp':
      return { opacity: t, transform: `translateY(${(1 - t) * 60}px)` };
    case 'scaleUp':
      return { opacity: t, transform: `scale(${0.3 + 0.7 * t})` };
    case 'scaleDown':
      return { opacity: t, transform: `scale(${1.5 - 0.5 * t})` };
    case 'rotateIn':
      return { opacity: t, transform: `rotate(${(1 - t) * 180}deg) scale(${0.5 + 0.5 * t})` };
    case 'bounceIn':
      return { opacity: t, transform: `scale(${0.3 + 0.7 * t})` };
    case 'typewriter':
      return { clipPath: `inset(0 ${(1 - t) * 100}% 0 0)` };
    case 'blurIn':
      return { opacity: t, filter: `blur(${(1 - t) * 8}px)` };
    case 'glitch':
      return {
        opacity: t > 0.1 ? 1 : 0,
        transform: t < 0.8 ? `translate(${Math.sin(t * 50) * 3}px, ${Math.cos(t * 40) * 2}px)` : 'none',
      };
    default:
      return {};
  }
}

/**
 * Get exit animation transform.
 * Progress goes from 0 (start of exit) to 1 (fully exited).
 */
export function getExitAnimTransform(
  anim: AnimationType,
  progress: number,
  easing: EasingType,
): React.CSSProperties {
  const t = applyEasing(clamp(progress, 0, 1), easing);
  switch (anim) {
    case 'fadeIn':
    case 'fadeOut':
      return { opacity: 1 - t };
    case 'slideLeft':
      return { opacity: 1 - t, transform: `translateX(${-t * 80}px)` };
    case 'slideRight':
      return { opacity: 1 - t, transform: `translateX(${t * 80}px)` };
    case 'slideUp':
      return { opacity: 1 - t, transform: `translateY(${-t * 60}px)` };
    case 'scaleUp':
      return { opacity: 1 - t, transform: `scale(${1 + t * 0.5})` };
    case 'scaleDown':
      return { opacity: 1 - t, transform: `scale(${1 - t * 0.7})` };
    case 'rotateIn':
      return { opacity: 1 - t, transform: `rotate(${t * 180}deg) scale(${1 - 0.5 * t})` };
    case 'bounceIn':
      return { opacity: 1 - t, transform: `scale(${1 - t * 0.7})` };
    case 'typewriter':
      return { clipPath: `inset(0 0 0 ${t * 100}%)` };
    case 'blurIn':
      return { opacity: 1 - t, filter: `blur(${t * 8}px)` };
    case 'glitch':
      return {
        opacity: t < 0.9 ? 1 : 0,
        transform: t > 0.2 ? `translate(${Math.sin(t * 50) * 3}px, ${Math.cos(t * 40) * 2}px)` : 'none',
      };
    default:
      return {};
  }
}
