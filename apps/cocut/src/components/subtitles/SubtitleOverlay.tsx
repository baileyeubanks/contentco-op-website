import { useElementStore } from '../../store/elementStore';
import { usePlaybackStore } from '../../store/playbackStore';
import type { SubtitleElement } from '../../types';

/**
 * Renders active subtitle cues on the canvas viewport.
 * Positioned absolutely over the canvas area.
 */
export function SubtitleOverlay() {
  const elements = useElementStore((s) => s.elements);
  const currentTime = usePlaybackStore((s) => s.currentTime);

  const subtitles = elements.filter((e) => e.type === 'subtitle' && e.visible) as SubtitleElement[];

  if (subtitles.length === 0) return null;

  return (
    <>
      {subtitles.map((sub) => {
        // Find active cues at current time
        const activeCues = sub.cues.filter(
          (c) =>
            currentTime >= sub.startTime + c.startTime &&
            currentTime <= sub.startTime + c.endTime,
        );

        // Also check if cue times are absolute (not relative to element start)
        const absoluteCues = sub.cues.filter(
          (c) => currentTime >= c.startTime && currentTime <= c.endTime,
        );

        const cues = activeCues.length > 0 ? activeCues : absoluteCues;
        if (cues.length === 0) return null;

        const positionStyle: React.CSSProperties = {
          position: 'absolute',
          left: 0,
          right: 0,
          textAlign: 'center',
          pointerEvents: 'none',
          zIndex: 100,
        };

        if (sub.position === 'top') {
          positionStyle.top = '5%';
        } else if (sub.position === 'center') {
          positionStyle.top = '50%';
          positionStyle.transform = 'translateY(-50%)';
        } else {
          positionStyle.bottom = '8%';
        }

        return (
          <div key={sub.id} style={positionStyle}>
            {cues.map((cue) => (
              <div
                key={cue.id}
                style={{
                  display: 'inline-block',
                  padding: '6px 16px',
                  borderRadius: 4,
                  background: sub.backgroundColor,
                  color: sub.color,
                  fontSize: sub.fontSize * 0.5, // Scale down for viewport
                  fontFamily: sub.fontFamily,
                  fontWeight: 600,
                  lineHeight: 1.4,
                  maxWidth: '80%',
                  textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                }}
              >
                {cue.text}
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
