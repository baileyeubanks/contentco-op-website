import { useState } from 'react';
import { C } from '../../theme/colors';
import { FONT_FAMILY, FONT_FAMILY_BRAND } from '../../theme/tokens';
import { Icons } from '../../theme/icons';
import { Icon } from './Icon';
import { Button } from './Button';
import { useUIStore, COMPOSITION_PRESETS } from '../../store/uiStore';
import { useElementStore } from '../../store/elementStore';
import { createTextElement, createShapeElement } from '../../utils/elementFactory';
import type { Element } from '../../types';

interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  preset: number; // index into COMPOSITION_PRESETS
  elements: () => Element[];
}

const TEMPLATES: Template[] = [
  {
    id: 'blank',
    name: 'Blank Canvas',
    description: 'Start from scratch',
    icon: Icons.square,
    preset: 0,
    elements: () => [],
  },
  {
    id: 'youtube-intro',
    name: 'YouTube Intro',
    description: '16:9 title card with animated text',
    icon: Icons.film,
    preset: 0,
    elements: () => [
      createShapeElement('shape', {
        name: 'BG Gradient',
        x: 0, y: 0, width: 1920, height: 1080,
        fill: '#0f172a',
        borderRadius: 0,
      }),
      createShapeElement('shape', {
        name: 'Accent Bar',
        x: 760, y: 520, width: 400, height: 4,
        fill: '#2563eb',
        animation: 'slideLeft',
        animDuration: 0.6,
        startTime: 0.3,
      }),
      createTextElement({
        name: 'Channel Name',
        x: 460, y: 400, width: 1000, height: 100,
        content: 'YOUR CHANNEL',
        fontSize: 72, fontFamily: 'Arial Black', color: '#ffffff',
        textAlign: 'center',
        animation: 'fadeIn', animDuration: 0.8,
      }),
      createTextElement({
        name: 'Episode Title',
        x: 460, y: 550, width: 1000, height: 60,
        content: 'Episode Title Here',
        fontSize: 28, fontFamily: 'Inter', color: '#94a3b8',
        fontWeight: 'normal', textAlign: 'center',
        animation: 'fadeIn', animDuration: 0.6, startTime: 0.5,
      }),
    ],
  },
  {
    id: 'tiktok-vertical',
    name: 'TikTok / Reels',
    description: '9:16 vertical with bold captions',
    icon: Icons.film,
    preset: 1,
    elements: () => [
      createShapeElement('shape', {
        name: 'BG',
        x: 0, y: 0, width: 1080, height: 1920,
        fill: '#000000', borderRadius: 0,
      }),
      createTextElement({
        name: 'Hook Text',
        x: 90, y: 200, width: 900, height: 200,
        content: 'YOUR HOOK HERE',
        fontSize: 64, fontFamily: 'Arial Black', color: '#ffffff',
        textAlign: 'center',
        animation: 'scaleUp', animDuration: 0.4,
      }),
      createTextElement({
        name: 'CTA',
        x: 240, y: 1700, width: 600, height: 60,
        content: 'Follow for more',
        fontSize: 24, fontFamily: 'Inter', color: '#94a3b8',
        fontWeight: 'normal', textAlign: 'center',
        animation: 'fadeIn', startTime: 1.0,
      }),
    ],
  },
  {
    id: 'lower-third',
    name: 'Lower Third',
    description: '16:9 with name/title overlay',
    icon: Icons.text,
    preset: 0,
    elements: () => [
      createShapeElement('shape', {
        name: 'L3 Bar',
        x: 80, y: 820, width: 500, height: 70,
        fill: '#2563eb', borderRadius: 4,
        animation: 'slideLeft', animDuration: 0.4,
      }),
      createShapeElement('shape', {
        name: 'L3 Accent',
        x: 80, y: 890, width: 360, height: 40,
        fill: 'rgba(37,99,235,0.5)', borderRadius: 4,
        animation: 'slideLeft', animDuration: 0.4, startTime: 0.1,
      }),
      createTextElement({
        name: 'Name',
        x: 100, y: 828, width: 460, height: 50,
        content: 'Speaker Name',
        fontSize: 28, fontFamily: 'Inter', color: '#ffffff',
        fontWeight: 'bold', textAlign: 'left',
        animation: 'fadeIn', startTime: 0.2,
      }),
      createTextElement({
        name: 'Title',
        x: 100, y: 893, width: 340, height: 30,
        content: 'Job Title / Role',
        fontSize: 16, fontFamily: 'Inter', color: '#e2e8f0',
        fontWeight: 'normal', textAlign: 'left',
        animation: 'fadeIn', startTime: 0.3,
      }),
    ],
  },
  {
    id: 'instagram-square',
    name: 'Instagram Post',
    description: '1:1 square with quote layout',
    icon: Icons.image,
    preset: 2,
    elements: () => [
      createShapeElement('shape', {
        name: 'BG',
        x: 0, y: 0, width: 1080, height: 1080,
        fill: '#1e293b', borderRadius: 0,
      }),
      createShapeElement('shape', {
        name: 'Quote Box',
        x: 90, y: 240, width: 900, height: 600,
        fill: 'rgba(255,255,255,0.05)', borderRadius: 24,
      }),
      createTextElement({
        name: 'Quote',
        x: 140, y: 340, width: 800, height: 300,
        content: '"Your quote or message goes here."',
        fontSize: 42, fontFamily: 'Georgia', color: '#ffffff',
        textAlign: 'center',
        animation: 'fadeIn', animDuration: 0.8,
      }),
      createTextElement({
        name: 'Author',
        x: 140, y: 700, width: 800, height: 40,
        content: '— Your Name',
        fontSize: 20, fontFamily: 'Inter', color: '#94a3b8',
        fontWeight: 'normal', textAlign: 'center',
        animation: 'fadeIn', startTime: 0.5,
      }),
    ],
  },
];

export function NewProjectDialog() {
  const showDialog = useUIStore((s) => s.showNewProjectDialog);
  const setShowDialog = useUIStore((s) => s.setShowNewProjectDialog);
  const setCanvasSize = useUIStore((s) => s.setCanvasSize);
  const addElements = useElementStore((s) => s.addElements);
  const clearAll = useElementStore((s) => s.clearAll);
  const [selectedTemplate, setSelectedTemplate] = useState(0);
  const [selectedPreset, setSelectedPreset] = useState(0);

  if (!showDialog) return null;

  const template = TEMPLATES[selectedTemplate];
  const preset = COMPOSITION_PRESETS[selectedPreset];

  const handleCreate = () => {
    clearAll();
    setCanvasSize(preset.width, preset.height);
    const els = template.elements();
    if (els.length > 0) addElements(els);
    setShowDialog(false);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 6000, fontFamily: FONT_FAMILY,
      }}
      onClick={() => setShowDialog(false)}
    >
      <div
        style={{
          width: 640, maxHeight: '80vh',
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 16, boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: 2,
            background: C.accent, boxShadow: `0 0 10px ${C.accentGlow}`,
          }} />
          <span style={{ fontFamily: FONT_FAMILY_BRAND, fontSize: 16, fontWeight: 700 }}>
            New Project
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 16, color: C.textDim, cursor: 'pointer' }} onClick={() => setShowDialog(false)}>
            ✕
          </span>
        </div>

        {/* Composition Presets */}
        <div style={{ padding: '16px 24px 8px' }}>
          <div style={{ fontSize: 10, color: C.textDim, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
            Canvas Size
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {COMPOSITION_PRESETS.map((p, i) => (
              <div
                key={i}
                onClick={() => {
                  setSelectedPreset(i);
                  // Auto-update template preset if template was using default
                  const t = TEMPLATES[selectedTemplate];
                  if (t.id === 'blank') return;
                }}
                style={{
                  padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                  border: `1px solid ${i === selectedPreset ? C.accent : C.border}`,
                  background: i === selectedPreset ? `${C.accent}15` : 'transparent',
                  fontSize: 10, color: i === selectedPreset ? C.accent2 : C.text,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{p.label}</div>
                <div style={{ fontSize: 9, color: C.textDim }}>{p.platform}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Templates */}
        <div style={{ padding: '12px 24px' }}>
          <div style={{ fontSize: 10, color: C.textDim, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
            Start From Template
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {TEMPLATES.map((t, i) => {
              const tPreset = COMPOSITION_PRESETS[t.preset];
              const aspectW = tPreset.width / Math.max(tPreset.width, tPreset.height);
              const aspectH = tPreset.height / Math.max(tPreset.width, tPreset.height);
              return (
                <div
                  key={t.id}
                  onClick={() => {
                    setSelectedTemplate(i);
                    setSelectedPreset(t.preset);
                  }}
                  style={{
                    padding: 12, borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${i === selectedTemplate ? C.accent : C.border}`,
                    background: i === selectedTemplate ? `${C.accent}10` : C.surface2,
                    transition: 'all 0.15s',
                    textAlign: 'center',
                  }}
                >
                  <div style={{
                    width: aspectW * 80, height: aspectH * 80,
                    margin: '0 auto 8px', borderRadius: 4,
                    background: C.surface3, border: `1px solid ${C.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon d={t.icon} size={20} color={i === selectedTemplate ? C.accent : C.textDim} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 2 }}>{t.name}</div>
                  <div style={{ fontSize: 9, color: C.textDim }}>{t.description}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 10, color: C.textDim }}>
            {preset.width} × {preset.height} • {preset.platform}
          </span>
          <Button
            onClick={handleCreate}
            style={{
              padding: '8px 24px', background: C.accent, color: '#fff',
              fontWeight: 600, fontSize: 12, border: 'none', borderRadius: 8,
            }}
          >
            <Icon d={Icons.zap} size={13} color="#fff" /> Create Project
          </Button>
        </div>
      </div>
    </div>
  );
}
