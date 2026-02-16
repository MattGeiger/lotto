"use client";

import * as React from "react";

import { useLanguage } from "@/contexts/language-context";

export function ArcadeShell({
  fontClasses,
  children,
}: {
  fontClasses: string;
  children: React.ReactNode;
}) {
  const { language } = useLanguage();

  return (
    <div className={`${fontClasses} arcade-scope`} data-arcade-lang={language}>
      {children}
    </div>
  );
}
