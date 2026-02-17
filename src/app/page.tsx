"use client";

import * as React from "react";
import Image from "next/image";
import { ReadOnlyDisplay } from "@/components/readonly-display";
import { LanguageMorphText } from "@/components/language-morph-text";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { useLanguage, type Language } from "@/contexts/language-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const languageOptions: Array<{ code: Language; label: string }> = [
  { code: "en", label: "English" },
  { code: "zh", label: "中文" },
  { code: "es", label: "Español" },
  { code: "ru", label: "Русский" },
  { code: "uk", label: "Українська" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "fa", label: "فارسی" },
  { code: "ar", label: "العربية" },
];

const languageTitleCycle = [
  "Choose your language",
  "Elige tu idioma",
  "选择你的语言",
  "Выберите язык",
  "Оберіть мову",
  "Chọn ngôn ngữ",
  "زبان خود را انتخاب کنید",
  "اختر لغتك",
];

export default function DisplayPage() {
  const { setLanguage } = useLanguage();
  const [isLanguageModalOpen, setIsLanguageModalOpen] = React.useState(true);

  const handleLanguageSelect = React.useCallback(
    (language: Language) => {
      setLanguage(language);
      setIsLanguageModalOpen(false);
    },
    [setLanguage],
  );

  return (
    <div className="relative">
      <div className="absolute left-6 right-6 top-4 z-50 flex items-center justify-between gap-5 py-2 sm:left-8 sm:right-8 lg:left-10 lg:right-10">
        <LanguageSwitcher />
        <div className="flex-1 flex justify-center px-2">
          <div className="w-full max-w-[220px]">
            <Image
              src="/wth-logo-horizontal.png"
              alt="William Temple House"
              width={2314}
              height={606}
              className="block h-auto w-full dark:hidden"
            />
            <Image
              src="/wth-logo-horizontal-reverse.png"
              alt="William Temple House"
              width={2333}
              height={641}
              className="hidden h-auto w-full dark:block"
            />
          </div>
        </div>
        <ThemeSwitcher />
      </div>
      <ReadOnlyDisplay showQrCode={false} showHeaderLogo={false} />
      <Dialog open={isLanguageModalOpen}>
        <DialogContent
          className="max-w-md"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <DialogHeader className="mb-5">
            <DialogTitle className="text-center text-2xl">
              <LanguageMorphText
                text={languageTitleCycle}
                loop
                holdDelay={5000}
                wordWrap="word"
                characterStagger={0.03}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              />
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {languageOptions.map((option) => (
              <Button
                key={option.code}
                type="button"
                variant="outline"
                className="h-12 text-base"
                onClick={() => handleLanguageSelect(option.code)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
