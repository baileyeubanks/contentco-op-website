import { C } from '../../theme/colors';
import { Icons } from '../../theme/icons';
import { PROPERTIES_PANEL_WIDTH, FONT_FAMILIES } from '../../theme/tokens';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { NumberInput } from '../ui/NumberInput';
import { ColorInput } from '../ui/ColorInput';
import { Divider } from '../ui/Divider';
import { SectionLabel } from '../ui/SectionLabel';
import { ColorGradePanel } from '../colorgrade/ColorGradePanel';
import { useElementStore } from '../../store/elementStore';
import { useUIStore } from '../../store/uiStore';
import { usePlaybackStore } from '../../store/playbackStore';
import { clamp } from '../../utils/math';
import { ANIMATIONS, BLEND_MODES, EASING_TYPES } from '../../types';
import type { Element } from '../../types';

export function PropertiesPanel() {
  const elements = useElementStore((s) => s.elements);
  const selectedIds = useElementStore((s) => s.selectedIds);
  const updateElement = useElementStore((s) => s.updateElement);
  const deleteElements = useElementStore((s) => s.deleteElements);
  const duplicateElements = useElementStore((s) => s.duplicateElements);
  const moveLayer = useElementStore((s) => s.moveLayer);
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const setCurrentTime = usePlaybackStore((s) => s.setCurrentTime);
  const play = usePlaybackStore((s) => s.play);
  const duration = usePlaybackStore((s) => s.duration);

  const selectedId = [...selectedIds][0];
  const selected: Element | undefined = elements.find((e) => e.id === selectedId);

  if (!selected) {
    return (
      <div
        style={{
          width: PROPERTIES_PANEL_WIDTH,
          background: C.surface,
          borderLeft: `1px solid ${C.border}`,
          flexShrink: 0,
        }}
      >
        <div style={{ padding: 20, color: C.textDim, fontSize: 12, textAlign: 'center' }}>
          <Icon
            d={Icons.move}
            size={32}
            color={C.border2}
            style={{ display: 'block', margin: '20px auto 12px' }}
          />
          Select an element to edit
        </div>
      </div>
    );
  }

  const upd = (patch: Partial<Element>) => updateElement(selected.id, patch);

  return (
    <div
      style={{
        width: PROPERTIES_PANEL_WIDTH,
        background: C.surface,
        borderLeft: `1px solid ${C.border}`,
        overflowY: 'auto',
        flexShrink: 0,
      }}
    >
      <div style={{ padding: 12, fontSize: 11 }}>
        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {(['properties', 'animate', 'filters'] as const).map((tab) => (
            <Button key={tab} small active={activeTab === tab} onClick={() => setActiveTab(tab)}>
              {tab === 'properties' ? 'Props' : tab === 'animate' ? 'Animate' : 'Color'}
            </Button>
          ))}
        </div>

        {activeTab === 'properties' && (
          <>
            <SectionLabel>Transform</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
              <NumberInput label="X" value={selected.x} onChange={(v) => upd({ x: v })} />
              <NumberInput label="Y" value={selected.y} onChange={(v) => upd({ y: v })} />
              <NumberInput label="W" value={selected.width} onChange={(v) => upd({ width: v })} min={10} />
              <NumberInput label="H" value={selected.height} onChange={(v) => upd({ height: v })} min={10} />
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <NumberInput
                label="↻"
                value={selected.rotation}
                onChange={(v) => upd({ rotation: v })}
                min={-360}
                max={360}
                unit="°"
              />
              <NumberInput
                label="α"
                value={Math.round(selected.opacity * 100)}
                onChange={(v) => upd({ opacity: v / 100 })}
                min={0}
                max={100}
                unit="%"
              />
            </div>
            <NumberInput
              label="R"
              value={selected.borderRadius}
              onChange={(v) => upd({ borderRadius: v })}
              min={0}
              max={999}
              unit="px"
            />
            <Divider />

            {/* Type-specific properties */}
            {selected.type === 'text' && (
              <>
                <SectionLabel>Text</SectionLabel>
                <textarea
                  value={selected.content}
                  onChange={(e) => upd({ content: e.target.value })}
                  rows={2}
                  style={{
                    width: '100%',
                    background: C.surface2,
                    color: C.text,
                    border: `1px solid ${C.border}`,
                    borderRadius: 5,
                    padding: 8,
                    fontSize: 12,
                    fontFamily: "'JetBrains Mono', monospace",
                    resize: 'vertical',
                    outline: 'none',
                    marginBottom: 8,
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                  <Select
                    value={selected.fontFamily}
                    onChange={(v) => upd({ fontFamily: v })}
                    options={[...FONT_FAMILIES]}
                  />
                  <NumberInput value={selected.fontSize} onChange={(v) => upd({ fontSize: v })} min={8} max={200} unit="px" />
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                  <ColorInput value={selected.color} onChange={(v) => upd({ color: v })} />
                  <Select
                    value={selected.fontWeight}
                    onChange={(v) => upd({ fontWeight: v })}
                    options={['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900']}
                  />
                  <Select
                    value={selected.textAlign}
                    onChange={(v) => upd({ textAlign: v as 'left' | 'center' | 'right' })}
                    options={['left', 'center', 'right']}
                  />
                </div>
              </>
            )}

            {(selected.type === 'shape' || selected.type === 'circle') && (
              <>
                <SectionLabel>Style</SectionLabel>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: C.textDim }}>Fill</span>
                  <ColorInput value={selected.fill} onChange={(v) => upd({ fill: v })} />
                  <span style={{ fontSize: 10, color: C.textDim }}>Stroke</span>
                  <ColorInput
                    value={selected.stroke === 'none' ? '#ffffff' : selected.stroke}
                    onChange={(v) => upd({ stroke: v })}
                  />
                  <NumberInput
                    value={selected.strokeWidth}
                    onChange={(v) => upd({ strokeWidth: v })}
                    min={0}
                    max={20}
                    unit="px"
                  />
                </div>
              </>
            )}

            {selected.type === 'image' && (
              <>
                <SectionLabel>Image</SectionLabel>
                <input
                  type="text"
                  placeholder="Paste image URL or drag file..."
                  value={selected.src || ''}
                  onChange={(e) => upd({ src: e.target.value })}
                  style={{
                    width: '100%',
                    background: C.surface2,
                    color: C.text,
                    border: `1px solid ${C.border}`,
                    borderRadius: 5,
                    padding: '6px 8px',
                    fontSize: 11,
                    fontFamily: "'JetBrains Mono', monospace",
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </>
            )}

            {selected.type === 'video' && (
              <>
                <SectionLabel>Video</SectionLabel>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <NumberInput
                    label="In"
                    value={selected.trimIn}
                    onChange={(v) => upd({ trimIn: v })}
                    min={0}
                    step={0.1}
                    unit="s"
                  />
                  <NumberInput
                    label="Out"
                    value={selected.trimOut}
                    onChange={(v) => upd({ trimOut: v })}
                    min={0}
                    step={0.1}
                    unit="s"
                  />
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <NumberInput
                    label="Vol"
                    value={Math.round(selected.volume * 100)}
                    onChange={(v) => upd({ volume: v / 100 })}
                    min={0}
                    max={200}
                    unit="%"
                  />
                  <NumberInput
                    label="Speed"
                    value={selected.playbackRate}
                    onChange={(v) => upd({ playbackRate: v })}
                    min={0.1}
                    max={4}
                    step={0.1}
                    unit="x"
                  />
                </div>
              </>
            )}

            <Divider />
            <SectionLabel>Layer</SectionLabel>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <Button small onClick={() => upd({ visible: !selected.visible })}>
                <Icon d={selected.visible ? Icons.eye : Icons.eyeOff} size={12} color={selected.visible ? C.text : C.textDim} />
                {selected.visible ? 'Vis' : 'Hid'}
              </Button>
              <Button small onClick={() => upd({ locked: !selected.locked })}>
                <Icon d={selected.locked ? Icons.lock : Icons.unlock} size={12} color={selected.locked ? C.orange : C.textDim} />
                {selected.locked ? 'Lck' : 'Ulk'}
              </Button>
              <Button small onClick={() => upd({ shadow: !selected.shadow })}>
                Shd {selected.shadow ? '✓' : ''}
              </Button>
              <Button small onClick={() => moveLayer(selected.id, 'up')}>↑</Button>
              <Button small onClick={() => moveLayer(selected.id, 'down')}>↓</Button>
              <Button small onClick={() => duplicateElements([selected.id])}>
                <Icon d={Icons.copy} size={12} />
              </Button>
              <Button small danger onClick={() => deleteElements([selected.id])}>
                <Icon d={Icons.trash} size={12} color={C.red} />
              </Button>
            </div>
          </>
        )}

        {activeTab === 'animate' && (
          <>
            <SectionLabel>Entry Animation</SectionLabel>
            <Select
              value={selected.animation}
              onChange={(v) => upd({ animation: v as Element['animation'] })}
              options={ANIMATIONS}
              style={{ width: '100%', marginBottom: 8 }}
            />
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <NumberInput
                label="Dur"
                value={selected.animDuration}
                onChange={(v) => upd({ animDuration: v })}
                min={0.1}
                max={5}
                step={0.1}
                unit="s"
              />
            </div>
            <Select
              value={selected.easing}
              onChange={(v) => upd({ easing: v as Element['easing'] })}
              options={EASING_TYPES.map((e) => ({ label: e, value: e }))}
              style={{ width: '100%', marginBottom: 8 }}
            />
            <Divider />
            <SectionLabel>Exit Animation</SectionLabel>
            <Select
              value={selected.animationExit}
              onChange={(v) => upd({ animationExit: v as Element['animationExit'] })}
              options={ANIMATIONS}
              style={{ width: '100%', marginBottom: 8 }}
            />
            <NumberInput
              label="Dur"
              value={selected.animExitDuration}
              onChange={(v) => upd({ animExitDuration: v })}
              min={0.1}
              max={5}
              step={0.1}
              unit="s"
            />
            <Divider />
            <SectionLabel>Timing</SectionLabel>
            <div style={{ display: 'flex', gap: 6 }}>
              <NumberInput
                label="In"
                value={selected.startTime}
                onChange={(v) => upd({ startTime: clamp(v, 0, duration) })}
                min={0}
                max={duration}
                step={0.1}
                unit="s"
              />
              <NumberInput
                label="Dur"
                value={selected.duration}
                onChange={(v) => upd({ duration: clamp(v, 0.1, duration) })}
                min={0.1}
                max={duration}
                step={0.1}
                unit="s"
              />
            </div>
            <Divider />
            <Button
              small
              accent
              onClick={() => {
                setCurrentTime(selected.startTime);
                play();
              }}
            >
              <Icon d={Icons.play} size={12} color={C.green} /> Preview Animation
            </Button>
          </>
        )}

        {activeTab === 'filters' && (
          <>
            <ColorGradePanel />
            <Divider />
            <SectionLabel>Blend Mode</SectionLabel>
            <Select
              value={selected.blendMode}
              onChange={(v) => upd({ blendMode: v as Element['blendMode'] })}
              options={BLEND_MODES.map((b) => ({ label: b, value: b }))}
              style={{ width: '100%' }}
            />
          </>
        )}
      </div>
    </div>
  );
}
