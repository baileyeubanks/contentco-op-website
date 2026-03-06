import { useState } from 'react';
import { C } from '../../theme/colors';
import { FONT_FAMILY } from '../../theme/tokens';
import { Icons } from '../../theme/icons';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
// Slider available for future use
import { useElementStore } from '../../store/elementStore';
import {
  type ColorGradeSettings,
  DEFAULT_GRADE,
  gradeToCSSFilter,
  isGradeModified,
} from '../../services/colorGrade';

type Section = 'basic' | 'creative' | 'vignette';

export function ColorGradePanel() {
  const selectedIds = useElementStore((s) => s.selectedIds);
  const elements = useElementStore((s) => s.elements);
  const updateElement = useElementStore((s) => s.updateElement);
  const [openSection, setOpenSection] = useState<Section>('basic');

  const selectedEl = elements.find((el) => selectedIds.has(el.id));
  if (!selectedEl) {
    return (
      <div style={{ padding: 16, color: C.textDim, fontSize: 11, textAlign: 'center' }}>
        Select an element to adjust color grading.
      </div>
    );
  }

  // Store grade in element's metadata or use a dedicated field
  // For now, we generate CSS filter from grade settings stored as JSON in filter field
  const grade: ColorGradeSettings = (selectedEl as any)._colorGrade || { ...DEFAULT_GRADE };

  const updateGrade = (patch: Partial<ColorGradeSettings>) => {
    const newGrade = { ...grade, ...patch };
    const cssFilter = gradeToCSSFilter(newGrade);
    // Store both the grade settings and the generated CSS filter
    updateElement(selectedEl.id, {
      filter: cssFilter,
      _colorGrade: newGrade,
    } as any);
  };

  const resetGrade = () => {
    updateElement(selectedEl.id, {
      filter: 'none',
      _colorGrade: { ...DEFAULT_GRADE },
    } as any);
  };

  const modified = isGradeModified(grade);

  const renderSlider = (
    label: string,
    value: number,
    key: keyof ColorGradeSettings,
    min = -100,
    max = 100,
  ) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      <span style={{ fontSize: 9, color: C.textDim, minWidth: 65, textAlign: 'right' }}>
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => updateGrade({ [key]: Number(e.target.value) } as any)}
        style={{
          flex: 1,
          height: 3,
          appearance: 'none',
          background: `linear-gradient(to right, ${C.accent}44, ${C.accent})`,
          borderRadius: 2,
          outline: 'none',
          cursor: 'pointer',
        }}
      />
      <span
        style={{
          fontSize: 9,
          color: value !== 0 ? C.accent2 : C.textMuted,
          minWidth: 28,
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value > 0 ? `+${value}` : value}
      </span>
    </div>
  );

  const SectionHeader = ({ section, label }: { section: Section; label: string }) => (
    <div
      onClick={() => setOpenSection(openSection === section ? section : section)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '6px 0',
        cursor: 'pointer',
        borderBottom: `1px solid ${C.border}`,
        marginBottom: 6,
      }}
    >
      <Icon
        d={openSection === section ? Icons.chevDown : Icons.chevRight}
        size={10}
        color={C.textDim}
      />
      <span style={{ fontSize: 9, fontWeight: 600, color: C.text, marginLeft: 4, letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
  );

  return (
    <div style={{ fontFamily: FONT_FAMILY, padding: '8px 12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 6 }}>
        <Icon d={Icons.wand} size={13} color={C.accent} />
        <span style={{ fontSize: 10, fontWeight: 600, color: C.text, flex: 1 }}>
          Color Grade
        </span>
        {modified && (
          <Button small onClick={resetGrade} title="Reset to default">
            Reset
          </Button>
        )}
      </div>

      {/* Basic Corrections */}
      <SectionHeader section="basic" label="Basic" />
      {openSection === 'basic' && (
        <div style={{ marginBottom: 8 }}>
          {renderSlider('Exposure', grade.exposure, 'exposure')}
          {renderSlider('Contrast', grade.contrast, 'contrast')}
          {renderSlider('Highlights', grade.highlights, 'highlights')}
          {renderSlider('Shadows', grade.shadows, 'shadows')}
          {renderSlider('Temperature', grade.temperature, 'temperature')}
          {renderSlider('Tint', grade.tint, 'tint')}
          {renderSlider('Saturation', grade.saturation, 'saturation')}
          {renderSlider('Vibrance', grade.vibrance, 'vibrance')}
        </div>
      )}

      {/* Creative / Lift-Gamma-Gain */}
      <SectionHeader section="creative" label="Creative" />
      {openSection === 'creative' && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 8, color: C.textMuted, marginBottom: 4 }}>
            Lift / Gamma / Gain — full control via WebGL (Phase 3)
          </div>
          <div style={{ opacity: 0.5, fontSize: 9, color: C.textDim, textAlign: 'center', padding: 12 }}>
            Color wheels coming with WebGL renderer
          </div>
        </div>
      )}

      {/* Vignette */}
      <SectionHeader section="vignette" label="Vignette" />
      {openSection === 'vignette' && (
        <div style={{ marginBottom: 8 }}>
          {renderSlider('Amount', grade.vignetteAmount, 'vignetteAmount', 0, 100)}
          {renderSlider('Size', grade.vignetteSize, 'vignetteSize', 0, 100)}
        </div>
      )}

      {/* LUT section placeholder */}
      <div
        style={{
          marginTop: 8,
          padding: '10px 12px',
          background: C.surface2,
          borderRadius: 6,
          border: `1px solid ${C.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 9, fontWeight: 600, color: C.text }}>LUT</span>
          <span style={{ fontSize: 8, color: C.textMuted }}>.cube file support</span>
        </div>
        <Button small onClick={() => {}} title="Import .cube LUT file">
          <Icon d={Icons.upload} size={10} /> Import LUT
        </Button>
      </div>
    </div>
  );
}
