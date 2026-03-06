interface ColorInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function ColorInput({ value, onChange }: ColorInputProps) {
  return (
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: 28,
        height: 22,
        border: 'none',
        borderRadius: 3,
        cursor: 'pointer',
        background: 'none',
      }}
    />
  );
}
