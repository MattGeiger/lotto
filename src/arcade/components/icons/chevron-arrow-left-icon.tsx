import type { ComponentPropsWithoutRef } from "react";

const PIXELS = [
  [24, 0],
  [28, 0],
  [20, 4],
  [24, 4],
  [28, 4],
  [32, 4],
  [16, 8],
  [20, 8],
  [24, 8],
  [28, 8],
  [32, 8],
  [12, 12],
  [16, 12],
  [20, 12],
  [24, 12],
  [28, 12],
  [8, 16],
  [12, 16],
  [16, 16],
  [20, 16],
  [24, 16],
  [4, 20],
  [8, 20],
  [12, 20],
  [16, 20],
  [20, 20],
  [0, 24],
  [4, 24],
  [8, 24],
  [12, 24],
  [16, 24],
  [0, 28],
  [4, 28],
  [8, 28],
  [12, 28],
  [16, 28],
  [4, 32],
  [8, 32],
  [12, 32],
  [16, 32],
  [20, 32],
  [8, 36],
  [12, 36],
  [16, 36],
  [20, 36],
  [24, 36],
  [12, 40],
  [16, 40],
  [20, 40],
  [24, 40],
  [28, 40],
  [16, 44],
  [20, 44],
  [24, 44],
  [28, 44],
  [32, 44],
  [20, 48],
  [24, 48],
  [28, 48],
  [32, 48],
  [24, 52],
  [28, 52],
] as const;

type ChevronArrowLeftIconProps = ComponentPropsWithoutRef<"svg">;

export function ChevronArrowLeftIcon({
  className,
  ...props
}: ChevronArrowLeftIconProps) {
  return (
    <svg
      viewBox="0 0 36 56"
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {PIXELS.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="4" height="4" />
      ))}
    </svg>
  );
}
