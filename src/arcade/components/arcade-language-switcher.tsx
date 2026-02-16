"use client";

import * as React from "react";

import { Button } from "@/arcade/ui/8bit";
import { useLanguage, type Language } from "@/contexts/language-context";

const languageNames: Record<Language, string> = {
  en: "English",
  zh: "中文",
  es: "Español",
  ru: "Русский",
  uk: "Українська",
  vi: "Tiếng Việt",
  fa: "فارسی",
  ar: "العربية",
};

export function ArcadeLanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const isRtlLanguage = language === "ar" || language === "fa";

  React.useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="arcade-ui px-2 text-sm"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {languageNames[language]}
      </Button>

      {open ? (
        <ul
          role="listbox"
          aria-label={t("language")}
          className="absolute left-0 top-full z-50 mt-1 min-w-[10rem] border-2 border-[var(--arcade-wall)] bg-[var(--arcade-panel)] p-1 shadow-lg"
        >
          {(Object.entries(languageNames) as [Language, string][]).map(([code, name]) => (
            <li key={code} role="option" aria-selected={code === language}>
              <button
                type="button"
                className={`arcade-ui block w-full px-3 py-2 text-base transition-colors ${
                  code === language
                    ? "bg-[var(--arcade-wall)]/30 text-[var(--arcade-dot)]"
                    : "text-[var(--arcade-text)] hover:bg-[var(--arcade-wall)]/20 hover:text-[var(--arcade-dot)]"
                } ${isRtlLanguage ? "text-right" : "text-left"}`}
                onClick={() => {
                  setLanguage(code);
                  setOpen(false);
                }}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
