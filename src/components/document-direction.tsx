"use client";

import { useEffect } from "react";

import { useLanguage } from "@/contexts/language-context";
import { isRTL } from "@/lib/rtl-utils";

export function DocumentDirection() {
  const { language } = useLanguage();

  useEffect(() => {
    document.documentElement.dir = isRTL(language) ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [language]);

  return null;
}
