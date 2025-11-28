import type { Language } from "@/contexts/language-context";

export function formatWaitTime(minutes: number, language: Language): string {
  if (minutes < 60) {
    return formatMinutes(minutes, language);
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (mins === 0) {
    return formatHours(hours, language);
  }

  return `${formatHours(hours, language)}, ${formatMinutes(mins, language)}`;
}

function formatMinutes(n: number, lang: Language): string {
  switch (lang) {
    case "zh":
      return `${n}分钟`;
    case "vi":
      return `${n} phút`;
    case "es":
      return `${n} ${n === 1 ? "minuto" : "minutos"}`;
    case "ru":
      return `${n} ${getRussianMinutePlural(n)}`;
    case "uk":
      return `${n} ${getUkrainianMinutePlural(n)}`;
    case "fa":
      return `${n} دقیقه`;
    case "ar":
      return `${n} ${n === 1 ? "دقيقة" : "دقائق"}`;
    default:
      return `${n} minute${n === 1 ? "" : "s"}`;
  }
}

function formatHours(n: number, lang: Language): string {
  switch (lang) {
    case "zh":
      return `${n}小时`;
    case "vi":
      return `${n} giờ`;
    case "es":
      return `${n} ${n === 1 ? "hora" : "horas"}`;
    case "ru":
      return `${n} ${getRussianHourPlural(n)}`;
    case "uk":
      return `${n} ${getUkrainianHourPlural(n)}`;
    case "fa":
      return `${n} ساعت`;
    case "ar":
      return `${n} ${n === 1 ? "ساعة" : "ساعات"}`;
    default:
      return `${n} hour${n === 1 ? "" : "s"}`;
  }
}

function getRussianMinutePlural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "минута";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "минуты";
  return "минут";
}

function getRussianHourPlural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "час";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "часа";
  return "часов";
}

function getUkrainianMinutePlural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "хвилина";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "хвилини";
  return "хвилин";
}

function getUkrainianHourPlural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "година";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "години";
  return "годин";
}
