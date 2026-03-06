import * as React from "react";

type HapticsStatusIconProps = {
  enabled: boolean;
  className?: string;
};

export function HapticsStatusIcon({ enabled, className }: HapticsStatusIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="9" y="4.5" width="6" height="15" rx="1.5" />
      <path d="M11 7.5h2" />
      <path d="M11.5 16.5h1" />
      <path d="M6 8c-1.2 1.1-1.8 2.4-1.8 4s.6 2.9 1.8 4" />
      <path d="M18 8c1.2 1.1 1.8 2.4 1.8 4s-.6 2.9-1.8 4" />
      {enabled ? null : <path d="M4 20L20 4" />}
    </svg>
  );
}
