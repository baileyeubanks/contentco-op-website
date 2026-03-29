import { C } from '../../theme/colors';

interface IconProps extends React.SVGAttributes<SVGSVGElement> {
  d: string;
  size?: number;
  color?: string;
}

export function Icon({ d, size = 16, color = C.textDim, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d={d} />
    </svg>
  );
}
