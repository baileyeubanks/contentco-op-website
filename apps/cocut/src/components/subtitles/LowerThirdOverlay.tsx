import { usePlaybackStore } from '../../store/playbackStore';

/**
 * Lower Third Overlay — 5 preset styles for on-screen name/title bars
 * Used in canvas viewport, rendered on top of video content
 */

export type LowerThirdStyle = 'minimal' | 'bold' | 'news' | 'social' | 'cinematic';

export interface LowerThirdConfig {
  id: string;
  style: LowerThirdStyle;
  name: string;
  title: string;
  startTime: number;
  endTime: number;
  color?: string;
  accentColor?: string;
}

export const LOWER_THIRD_PRESETS: Record<LowerThirdStyle, {
  label: string;
  description: string;
  defaultConfig: Partial<LowerThirdConfig>;
}> = {
  minimal: {
    label: 'Minimal',
    description: 'Clean white text on semi-transparent bar',
    defaultConfig: { color: '#ffffff', accentColor: 'rgba(0,0,0,0.5)' },
  },
  bold: {
    label: 'Bold',
    description: 'Full-width colored bar with large text',
    defaultConfig: { color: '#ffffff', accentColor: '#4285F4' },
  },
  news: {
    label: 'News',
    description: 'Two-line broadcast style with name and title',
    defaultConfig: { color: '#ffffff', accentColor: '#cc0000' },
  },
  social: {
    label: 'Social',
    description: 'Rounded corners for Instagram/TikTok',
    defaultConfig: { color: '#ffffff', accentColor: '#E1306C' },
  },
  cinematic: {
    label: 'Cinematic',
    description: 'Letterbox style with thin elegant text',
    defaultConfig: { color: '#e0e0e0', accentColor: 'rgba(0,0,0,0.7)' },
  },
};

interface LowerThirdOverlayProps {
  configs: LowerThirdConfig[];
}

function MinimalLowerThird({ config }: { config: LowerThirdConfig }) {
  return (
    <div style={{
      position: 'absolute', bottom: '10%', left: '5%',
      background: config.accentColor || 'rgba(0,0,0,0.5)',
      padding: '8px 20px', borderRadius: 2,
    }}>
      <div style={{ color: config.color || '#fff', fontSize: 16, fontWeight: 600, letterSpacing: 0.5 }}>
        {config.name}
      </div>
      {config.title && (
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>
          {config.title}
        </div>
      )}
    </div>
  );
}

function BoldLowerThird({ config }: { config: LowerThirdConfig }) {
  return (
    <div style={{
      position: 'absolute', bottom: '8%', left: 0, right: 0,
      background: config.accentColor || '#4285F4',
      padding: '12px 24px',
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <div style={{
        width: 4, height: 36, background: '#fff', borderRadius: 2, flexShrink: 0,
      }} />
      <div>
        <div style={{ color: config.color || '#fff', fontSize: 20, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
          {config.name}
        </div>
        {config.title && (
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 500, marginTop: 2 }}>
            {config.title}
          </div>
        )}
      </div>
    </div>
  );
}

function NewsLowerThird({ config }: { config: LowerThirdConfig }) {
  return (
    <div style={{ position: 'absolute', bottom: '8%', left: '3%' }}>
      <div style={{
        background: config.accentColor || '#cc0000',
        padding: '6px 18px',
        display: 'inline-block',
      }}>
        <span style={{ color: '#fff', fontSize: 16, fontWeight: 700, textTransform: 'uppercase' }}>
          {config.name}
        </span>
      </div>
      {config.title && (
        <div style={{
          background: 'rgba(0,0,0,0.8)',
          padding: '5px 18px',
          display: 'inline-block',
          marginLeft: 0,
        }}>
          <span style={{ color: '#e0e0e0', fontSize: 13, fontWeight: 500 }}>
            {config.title}
          </span>
        </div>
      )}
    </div>
  );
}

function SocialLowerThird({ config }: { config: LowerThirdConfig }) {
  return (
    <div style={{
      position: 'absolute', bottom: '12%', left: '50%', transform: 'translateX(-50%)',
      background: config.accentColor || '#E1306C',
      padding: '10px 24px', borderRadius: 24,
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 700, color: '#fff',
      }}>
        {config.name.charAt(0).toUpperCase()}
      </div>
      <div>
        <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{config.name}</div>
        {config.title && (
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>{config.title}</div>
        )}
      </div>
    </div>
  );
}

function CinematicLowerThird({ config }: { config: LowerThirdConfig }) {
  return (
    <div style={{
      position: 'absolute', bottom: '6%', left: 0, right: 0, textAlign: 'center',
    }}>
      <div style={{
        display: 'inline-block',
        borderTop: '1px solid rgba(255,255,255,0.3)',
        borderBottom: '1px solid rgba(255,255,255,0.3)',
        padding: '8px 40px',
        background: config.accentColor || 'rgba(0,0,0,0.7)',
      }}>
        <div style={{
          color: config.color || '#e0e0e0', fontSize: 14,
          fontWeight: 300, letterSpacing: 3, textTransform: 'uppercase',
          fontFamily: "'Georgia', serif",
        }}>
          {config.name}
        </div>
        {config.title && (
          <div style={{
            color: 'rgba(255,255,255,0.5)', fontSize: 11,
            letterSpacing: 2, marginTop: 4, textTransform: 'uppercase',
          }}>
            {config.title}
          </div>
        )}
      </div>
    </div>
  );
}

const RENDERERS: Record<LowerThirdStyle, React.FC<{ config: LowerThirdConfig }>> = {
  minimal: MinimalLowerThird,
  bold: BoldLowerThird,
  news: NewsLowerThird,
  social: SocialLowerThird,
  cinematic: CinematicLowerThird,
};

export function LowerThirdOverlay({ configs }: LowerThirdOverlayProps) {
  const currentTime = usePlaybackStore((s) => s.currentTime);

  const active = configs.filter(
    (c) => currentTime >= c.startTime && currentTime <= c.endTime,
  );

  if (active.length === 0) return null;

  return (
    <>
      {active.map((config) => {
        const Renderer = RENDERERS[config.style] || MinimalLowerThird;
        return <Renderer key={config.id} config={config} />;
      })}
    </>
  );
}
