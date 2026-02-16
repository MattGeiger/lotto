import type { ComponentPropsWithoutRef } from "react";

type PixelChevronIconProps = ComponentPropsWithoutRef<"svg">;
type PixelChevronBaseProps = PixelChevronIconProps & {
  pixels: readonly (readonly [number, number])[];
  viewBox: string;
};

const LEFT_PIXELS = [
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

const RIGHT_PIXELS = [
  [4, 0],
  [8, 0],
  [0, 4],
  [4, 4],
  [8, 4],
  [12, 4],
  [0, 8],
  [4, 8],
  [8, 8],
  [12, 8],
  [16, 8],
  [4, 12],
  [8, 12],
  [12, 12],
  [16, 12],
  [20, 12],
  [8, 16],
  [12, 16],
  [16, 16],
  [20, 16],
  [24, 16],
  [12, 20],
  [16, 20],
  [20, 20],
  [24, 20],
  [28, 20],
  [16, 24],
  [20, 24],
  [24, 24],
  [28, 24],
  [32, 24],
  [16, 28],
  [20, 28],
  [24, 28],
  [28, 28],
  [32, 28],
  [12, 32],
  [16, 32],
  [20, 32],
  [24, 32],
  [28, 32],
  [8, 36],
  [12, 36],
  [16, 36],
  [20, 36],
  [24, 36],
  [4, 40],
  [8, 40],
  [12, 40],
  [16, 40],
  [20, 40],
  [0, 44],
  [4, 44],
  [8, 44],
  [12, 44],
  [16, 44],
  [0, 48],
  [4, 48],
  [8, 48],
  [12, 48],
  [4, 52],
  [8, 52],
] as const;

const UP_PIXELS = [
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
  [36, 8],
  [12, 12],
  [16, 12],
  [20, 12],
  [24, 12],
  [28, 12],
  [32, 12],
  [36, 12],
  [40, 12],
  [8, 16],
  [12, 16],
  [16, 16],
  [20, 16],
  [24, 16],
  [28, 16],
  [32, 16],
  [36, 16],
  [40, 16],
  [44, 16],
  [4, 20],
  [8, 20],
  [12, 20],
  [16, 20],
  [20, 20],
  [32, 20],
  [36, 20],
  [40, 20],
  [44, 20],
  [48, 20],
  [0, 24],
  [4, 24],
  [8, 24],
  [12, 24],
  [16, 24],
  [36, 24],
  [40, 24],
  [44, 24],
  [48, 24],
  [52, 24],
  [0, 28],
  [4, 28],
  [8, 28],
  [12, 28],
  [40, 28],
  [44, 28],
  [48, 28],
  [52, 28],
  [4, 32],
  [8, 32],
  [44, 32],
  [48, 32],
] as const;

const DOWN_PIXELS = [
  [4, 0],
  [8, 0],
  [44, 0],
  [48, 0],
  [0, 4],
  [4, 4],
  [8, 4],
  [12, 4],
  [40, 4],
  [44, 4],
  [48, 4],
  [52, 4],
  [0, 8],
  [4, 8],
  [8, 8],
  [12, 8],
  [16, 8],
  [36, 8],
  [40, 8],
  [44, 8],
  [48, 8],
  [52, 8],
  [4, 12],
  [8, 12],
  [12, 12],
  [16, 12],
  [20, 12],
  [32, 12],
  [36, 12],
  [40, 12],
  [44, 12],
  [48, 12],
  [8, 16],
  [12, 16],
  [16, 16],
  [20, 16],
  [24, 16],
  [28, 16],
  [32, 16],
  [36, 16],
  [40, 16],
  [44, 16],
  [12, 20],
  [16, 20],
  [20, 20],
  [24, 20],
  [28, 20],
  [32, 20],
  [36, 20],
  [40, 20],
  [16, 24],
  [20, 24],
  [24, 24],
  [28, 24],
  [32, 24],
  [36, 24],
  [20, 28],
  [24, 28],
  [28, 28],
  [32, 28],
  [24, 32],
  [28, 32],
] as const;

function PixelChevronIcon({
  pixels,
  viewBox,
  className,
  ...props
}: PixelChevronBaseProps) {
  return (
    <svg
      viewBox={viewBox}
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {pixels.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="4" height="4" />
      ))}
    </svg>
  );
}

export function ChevronArrowLeftIcon({
  className,
  ...props
}: PixelChevronIconProps) {
  return (
    <PixelChevronIcon pixels={LEFT_PIXELS} viewBox="0 0 36 56" className={className} {...props} />
  );
}

export function ChevronArrowRightIcon({
  className,
  ...props
}: PixelChevronIconProps) {
  return (
    <PixelChevronIcon pixels={RIGHT_PIXELS} viewBox="0 0 36 56" className={className} {...props} />
  );
}

export function ChevronArrowUpIcon({
  className,
  ...props
}: PixelChevronIconProps) {
  return (
    <PixelChevronIcon pixels={UP_PIXELS} viewBox="0 0 56 36" className={className} {...props} />
  );
}

export function ChevronArrowDownIcon({
  className,
  ...props
}: PixelChevronIconProps) {
  return (
    <PixelChevronIcon pixels={DOWN_PIXELS} viewBox="0 0 56 36" className={className} {...props} />
  );
}
