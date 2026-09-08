// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

import type { Language } from "@/contexts/language-context";

const localeMap: Record<Language, string> = {
  en: "en-US",
  zh: "zh-CN",
  es: "es-ES",
  ru: "ru-RU",
  uk: "uk-UA",
  vi: "vi-VN",
  fa: "fa-IR",
  ar: "ar",
};

export function formatDate(
  language: Language,
  input?: Date | number,
  timeZone?: string,
): string {
  const now = input instanceof Date ? input : typeof input === "number" ? new Date(input) : new Date();
  // Core languages use their mapped locale; dynamic catalog languages pass their
  // BCP-47 code straight to Intl (e.g. "bs" → Bosnian month/weekday names).
  const locale = localeMap[language] ?? language;

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      calendar: "gregory",
      timeZone,
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  // Preserve LOTTO's established ASCII day/year output even when the selected
  // locale uses another numeral system; only the weekday and month are
  // localized here.
  const numericParts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US-u-nu-latn", {
      day: "numeric",
      year: "numeric",
      calendar: "gregory",
      timeZone,
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  const weekday = parts.weekday;
  const day = Number(numericParts.day);
  const month = parts.month;
  const year = numericParts.year;

  if (language === "en") {
    const suffix = getOrdinalSuffix(day);
    return `${weekday}, ${month} ${day}${suffix}, ${year}`;
  }

  return `${weekday}, ${day} ${month} ${year}`;
}

function getOrdinalSuffix(day: number): string {
  const remainder = day % 100;
  if (remainder >= 11 && remainder <= 13) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}
