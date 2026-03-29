import { C } from '../../theme/colors';

interface SectionLabelProps {
  children: React.ReactNode;
}

export function SectionLabel({ children }: SectionLabelProps) {
  return (
    <div
      style={{
        fontSize: 9,
        color: C.textDim,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginBottom: 6,
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}
