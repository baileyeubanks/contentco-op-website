import { C } from '../../theme/colors';
import { FONT_FAMILY } from '../../theme/tokens';

interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: (string | SelectOption)[];
  style?: React.CSSProperties;
}

export function Select({ value, onChange, options, style }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: C.surface2,
        color: C.text,
        border: `1px solid ${C.border}`,
        borderRadius: 5,
        padding: '4px 8px',
        fontSize: 11,
        fontFamily: FONT_FAMILY,
        cursor: 'pointer',
        outline: 'none',
        ...style,
      }}
    >
      {options.map((o) => {
        const val = typeof o === 'string' ? o : o.value;
        const label = typeof o === 'string' ? o : o.label;
        return (
          <option key={val} value={val}>
            {label}
          </option>
        );
      })}
    </select>
  );
}
