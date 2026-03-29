import { useState } from 'react';
import { C } from '../../theme/colors';
import { FONT_FAMILY } from '../../theme/tokens';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  accent?: boolean;
  small?: boolean;
  danger?: boolean;
}

export function Button({ children, active, accent, small, danger, style, ...props }: ButtonProps) {
  const [hovered, setHovered] = useState(false);

  const bg = active
    ? C.accent
    : danger
      ? hovered ? C.red + '33' : 'transparent'
      : hovered
        ? C.surface3
        : accent
          ? C.surface3
          : 'transparent';

  return (
    <button
      style={{
        background: bg,
        color: active ? '#fff' : danger ? C.red : C.text,
        border: `1px solid ${active ? C.accent : danger ? C.red + '44' : C.border}`,
        borderRadius: 6,
        padding: small ? '3px 8px' : '6px 12px',
        fontSize: small ? 11 : 12,
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        transition: 'all 0.15s',
        fontFamily: FONT_FAMILY,
        opacity: props.disabled ? 0.4 : 1,
        ...style,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...props}
    >
      {children}
    </button>
  );
}
