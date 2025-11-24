import type { Language } from "@/contexts/language-context";

const localeMap: Record<Language, string> = {
  en: "en-US",
  zh: "zh-CN",
  es: "es-ES",
  ru: "ru-RU",
  uk: "uk-UA",
};

export function formatDate(language: Language): string {
  const now = new Date();
  const locale = localeMap[language];

  const weekday = now.toLocaleString(locale, { weekday: "long" });
  const day = now.getDate();
  const month = now.toLocaleString(locale, { month: "long" });
  const year = now.getFullYear();

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
