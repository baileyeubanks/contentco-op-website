import { C } from '../../theme/colors';
import { FONT_FAMILY } from '../../theme/tokens';

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  unit?: string;
}

export function NumberInput({ value, onChange, min, max, step = 1, label, unit }: NumberInputProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {label && (
        <span style={{ fontSize: 10, color: C.textDim, minWidth: 20 }}>{label}</span>
      )}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        style={{
          background: C.surface2,
          color: C.text,
          border: `1px solid ${C.border}`,
          borderRadius: 4,
          padding: '3px 6px',
          fontSize: 11,
          width: 52,
          fontFamily: FONT_FAMILY,
          outline: 'none',
        }}
      />
      {unit && <span style={{ fontSize: 9, color: C.textDim }}>{unit}</span>}
    </div>
  );
}
