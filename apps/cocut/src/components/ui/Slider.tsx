import { C } from '../../theme/colors';

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
}

export function Slider({ value, onChange, min = 0, max = 100, step = 1, label }: SliderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
      {label && (
        <span style={{ fontSize: 10, color: C.textDim, minWidth: 40 }}>{label}</span>
      )}
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, accentColor: C.accent }}
      />
      <span style={{ fontSize: 10, color: C.textDim, minWidth: 30, textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}
