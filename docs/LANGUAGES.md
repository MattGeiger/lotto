# Multi-Language Support Implementation Plan

## Overview
Add language selection for display page with support for: English, Mandarin Chinese (简体中文), Spanish (Español), Russian (Русский), Ukrainian (Українська), Vietnamese (Tiếng Việt), Farsi (فارسی), and Arabic (العربية).

## Translation Dictionary

### Display Page Main Content

| Key | English | 中文 (Mandarin) | Español | Русский | Українська | Tiếng Việt | فارسی | العربية |
|-----|---------|----------------|---------|---------|-----------|------------|-------|---------|
| `nowServing` | Now Serving | 正在叫号 | Turno Actual | Вызывается номер | Викликається номер | Đang gọi số | در حال فراخوانی شماره | الرقم الحالي |
| `waiting` | Waiting | 请等候 | En espera | Ожидайте | Очікуйте | Vui lòng chờ | لطفاً صبر کنید | يرجى الانتظار |
| `foodPantryServiceFor` | Food Pantry Service For | 食品发放服务 | Servicio del Banco de Alimentos | Раздача продуктов | Роздача продуктів | Phát thực phẩm ngày | توزیع مواد غذایی برای | توزيع المواد الغذائية ليوم |
| `ticketsIssuedToday` | Ticket Numbers Issued Today | 今日号码范围 | Boletos emitidos hoy | Выданные сегодня номера | Видані сьогодні номери | Số vé phát hôm nay | بلیط‌های صادر شده امروز | التذاكر الصادرة اليوم |
| `totalTicketsIssued` | Total Tickets Issued | 已发号码总数 | Total de boletos emitidos | Всего выдано билетов | Всього видано квитків | Tổng số vé đã phát | مجموع بلیط‌های صادر شده | إجمالي التذاكر الصادرة |
| `drawingOrder` | Drawing Order | 叫号顺序 | Orden de llamado | Порядок вызова | Порядок виклику | Thứ tự bốc thăm | ترتیب قرعه‌کشی | ترتيب السحب |
| `updated` | Updated | 更新时间 | Actualizado | Обновлено | Оновлено | Cập nhật | به‌روزرسانی | تم التحديث |
| `welcome` | Welcome! | 欢迎！ | ¡Bienvenidos! | Добро пожаловать! | Ласкаво просимо! | Chào mừng! | خوش آمدید! | أهلاً وسهلاً! |
| `raffleNotStarted` | The raffle has not yet started. | 抽签尚未开始。 | El sorteo aún no ha comenzado. | Розыгрыш еще не начался. | Розіграш ще не розпочався. | Chưa bắt đầu bốc thăm. | قرعه‌کشی هنوز شروع نشده است. | لم تبدأ القرعة بعد. |
| `checkBackSoon` | Check back soon for updates. | 请稍后再查看更新。 | Vuelva pronto para ver actualizaciones. | Загляните позже. | Завітайте пізніше. | Vui lòng quay lại sau. | لطفاً بعداً مراجعه کنید. | يرجى العودة لاحقاً. |

### Status Messages

| Key | English | 中文 (Mandarin) | Español | Русский | Українська | Tiếng Việt | فارسی | العربية |
|-----|---------|----------------|---------|---------|-----------|------------|-------|---------|
| `pollingState` | Polling for latest state… | 正在获取最新状态… | Consultando el estado más reciente… | Опрос последнего состояния… | Опитування останнього стану… | Đang tải trạng thái mới nhất… | در حال دریافت آخرین وضعیت… | جارٍ تحميل أحدث البيانات… |
| `refreshing` | Refreshing… | 刷新中… | Actualizando… | Обновление… | Оновлення… | Đang làm mới… | در حال به‌روزرسانی… | جارٍ التحديث… |
| `lastChecked` | Last checked | 最后检查时间 | Última verificación | Последняя проверка | Остання перевірка | Kiểm tra lần cuối | آخرین بررسی | آخر فحص |
| `errorLoadingState` | Error loading state | 加载状态错误 | Error al cargar el estado | Ошибка загрузки состояния | Помилка завантаження стану | Lỗi tải trạng thái | خطا در بارگذاری وضعیت | خطأ في تحميل الحالة |
| `unknownError` | Unknown error | 未知错误 | Error desconocido | Неизвестная ошибка | Невідома помилка | Lỗi không xác định | خطای ناشناخته | خطأ غير معروف |

### Ticket Detail Dialog

| Key | English | 中文 (Mandarin) | Español | Русский | Українська | Tiếng Việt | فارسی | العربية |
|-----|---------|----------------|---------|---------|-----------|------------|-------|---------|
| `ticket` | Ticket | 号码 | Boleto | Билет | Квиток | Vé | بلیط | تذكرة |
| `queuePosition` | Queue Position | 排队位置 | Posición en la Fila | Место в очереди | Місце в черзі | Vị trí trong hàng | جایگاه در صف | الموقع في الطابور |
| `ticketsAhead` | Tickets Ahead | 前面等待人数 | Personas delante | Человек впереди | Людей попереду | Số người phía trước | نفر جلوتر | أشخاص أمامك |
| `estimatedWait` | Estimated Wait | 预计等待时间 | Espera Estimada | Ориентировочное время ожидания | Орієнтовний час очікування | Thời gian chờ dự kiến | زمان انتظار تقریبی | وقت الانتظار المتوقع |
| `close` | Close | 关闭 | Cerrar | Закрыть | Закрити | Đóng | بستن | إغلاق |

### Time Units

| Key | English (singular) | English (plural) | 中文 | Español (singular) | Español (plural) | Русский (singular) | Русский (2-4) | Русский (5+) | Українська (singular) | Українська (2-4) | Українська (5+) | Tiếng Việt | فارسی | العربية (singular) | العربية (plural) |
|-----|-------------------|------------------|------|-------------------|------------------|-------------------|---------------|-------------|---------------------|-----------------|---------------|------------|-------|---------------------|-------------------|
| `minute` | minute | minutes | 分钟 | minuto | minutos | минута | минуты | минут | хвилина | хвилини | хвилин | phút | دقیقه | دقيقة | دقائق |
| `hour` | hour | hours | 小时 | hora | horas | час | часа | часов | година | години | годин | giờ | ساعت | ساعة | ساعات |

### Date Formatting

Date locales to use with `toLocaleString`:
- **English**: `en-US`
- **中文**: `zh-CN`
- **Español**: `es-ES`
- **Русский**: `ru-RU`
- **Українська**: `uk-UA`
- **Tiếng Việt**: `vi-VN`
- **فارسی**: `fa-IR`
- **العربية**: `ar`

### RTL Note

Arabic (`ar`) and Farsi (`fa`) are right-to-left languages. For correct display, set `dir="rtl"` and appropriate `lang` attributes when these languages are active, and verify layout alignment (grids, text alignment, padding/margins) in the UI.

## Implementation Architecture

### 1. Language Context Provider

**Create:** `/Users/russbook/lotto/src/contexts/language-context.tsx`

```tsx
"use client"

import React from "react"

export type Language = "en" | "zh" | "es" | "ru" | "uk" | "vi" | "fa" | "ar"

type LanguageContextType = {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = React.createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = React.useState<Language>("en")

  React.useEffect(() => {
    // Load from localStorage on mount
    const stored = typeof window !== "undefined" ? localStorage.getItem("display-language") : null
    if (stored && ["en", "zh", "es", "ru", "uk", "vi", "fa", "ar"].includes(stored)) {
      setLanguageState(stored as Language)
    }
  }, [])

  const setLanguage = React.useCallback((lang: Language) => {
    setLanguageState(lang)
    if (typeof window !== "undefined") {
      localStorage.setItem("display-language", lang)
    }
  }, [])

  const t = React.useCallback((key: string) => {
    return translations[language]?.[key] || translations.en[key] || key
  }, [language])

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = React.useContext(LanguageContext)
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider")
  }
  return context
}

// Translation object (flattened structure)
const translations: Record<Language, Record<string, string>> = {
  en: {
    nowServing: "Now Serving",
    waiting: "Waiting",
    foodPantryServiceFor: "Food Pantry Service For",
    ticketsIssuedToday: "Ticket Numbers Issued Today",
    totalTicketsIssued: "Total Tickets Issued",
    drawingOrder: "Drawing Order",
    updated: "Updated",
    welcome: "Welcome!",
    raffleNotStarted: "The raffle has not yet started.",
    checkBackSoon: "Check back soon for updates.",
    pollingState: "Polling for latest state…",
    refreshing: "Refreshing…",
    lastChecked: "Last checked",
    errorLoadingState: "Error loading state",
    unknownError: "Unknown error",
    ticket: "Ticket",
    queuePosition: "Queue Position",
    ticketsAhead: "Tickets Ahead",
    estimatedWait: "Estimated Wait",
    close: "Close",
  },
  zh: {
    nowServing: "正在叫号",
    waiting: "请等候",
    foodPantryServiceFor: "食品发放服务",
    ticketsIssuedToday: "今日号码范围",
    totalTicketsIssued: "已发号码总数",
    drawingOrder: "叫号顺序",
    updated: "更新时间",
    welcome: "欢迎！",
    raffleNotStarted: "抽签尚未开始。",
    checkBackSoon: "请稍后再查看更新。",
    pollingState: "正在获取最新状态…",
    refreshing: "刷新中…",
    lastChecked: "最后检查时间",
    errorLoadingState: "加载状态错误",
    unknownError: "未知错误",
    ticket: "号码",
    queuePosition: "排队位置",
    ticketsAhead: "前面等待人数",
    estimatedWait: "预计等待时间",
    close: "关闭",
  },
  es: {
    nowServing: "Turno Actual",
    waiting: "En espera",
    foodPantryServiceFor: "Servicio del Banco de Alimentos",
    ticketsIssuedToday: "Boletos emitidos hoy",
    totalTicketsIssued: "Total de boletos emitidos",
    drawingOrder: "Orden de llamado",
    updated: "Actualizado",
    welcome: "¡Bienvenidos!",
    raffleNotStarted: "El sorteo aún no ha comenzado.",
    checkBackSoon: "Vuelva pronto para ver actualizaciones.",
    pollingState: "Consultando el estado más reciente…",
    refreshing: "Actualizando…",
    lastChecked: "Última verificación",
    errorLoadingState: "Error al cargar el estado",
    unknownError: "Error desconocido",
    ticket: "Boleto",
    queuePosition: "Posición en la Fila",
    ticketsAhead: "Personas delante",
    estimatedWait: "Espera Estimada",
    close: "Cerrar",
  },
  ru: {
    nowServing: "Вызывается номер",
    waiting: "Ожидайте",
    foodPantryServiceFor: "Раздача продуктов",
    ticketsIssuedToday: "Выданные сегодня номера",
    totalTicketsIssued: "Всего выдано билетов",
    drawingOrder: "Порядок вызова",
    updated: "Обновлено",
    welcome: "Добро пожаловать!",
    raffleNotStarted: "Розыгрыш еще не начался.",
    checkBackSoon: "Загляните позже.",
    pollingState: "Опрос последнего состояния…",
    refreshing: "Обновление…",
    lastChecked: "Последняя проверка",
    errorLoadingState: "Ошибка загрузки состояния",
    unknownError: "Неизвестная ошибка",
    ticket: "Билет",
    queuePosition: "Место в очереди",
    ticketsAhead: "Человек впереди",
    estimatedWait: "Ориентировочное время ожидания",
    close: "Закрыть",
  },
  uk: {
    nowServing: "Викликається номер",
    waiting: "Очікуйте",
    foodPantryServiceFor: "Роздача продуктів",
    ticketsIssuedToday: "Видані сьогодні номери",
    totalTicketsIssued: "Всього видано квитків",
    drawingOrder: "Порядок виклику",
    updated: "Оновлено",
    welcome: "Ласкаво просимо!",
    raffleNotStarted: "Розіграш ще не розпочався.",
    checkBackSoon: "Завітайте пізніше.",
    pollingState: "Опитування останнього стану…",
    refreshing: "Оновлення…",
    lastChecked: "Остання перевірка",
    errorLoadingState: "Помилка завантаження стану",
    unknownError: "Невідома помилка",
    ticket: "Квиток",
    queuePosition: "Місце в черзі",
    ticketsAhead: "Людей попереду",
    estimatedWait: "Орієнтовний час очікування",
    close: "Закрити",
  },
  vi: {
    nowServing: "Đang gọi số",
    waiting: "Vui lòng chờ",
    foodPantryServiceFor: "Phát thực phẩm ngày",
    ticketsIssuedToday: "Số vé phát hôm nay",
    totalTicketsIssued: "Tổng số vé đã phát",
    drawingOrder: "Thứ tự bốc thăm",
    updated: "Cập nhật",
    welcome: "Chào mừng!",
    raffleNotStarted: "Chưa bắt đầu bốc thăm.",
    checkBackSoon: "Vui lòng quay lại sau.",
    pollingState: "Đang tải trạng thái mới nhất…",
    refreshing: "Đang làm mới…",
    lastChecked: "Kiểm tra lần cuối",
    errorLoadingState: "Lỗi tải trạng thái",
    unknownError: "Lỗi không xác định",
    ticket: "Vé",
    queuePosition: "Vị trí trong hàng",
    ticketsAhead: "Số người phía trước",
    estimatedWait: "Thời gian chờ dự kiến",
    close: "Đóng",
  },
  fa: {
    nowServing: "در حال فراخوانی شماره",
    waiting: "لطفاً صبر کنید",
    foodPantryServiceFor: "توزیع مواد غذایی برای",
    ticketsIssuedToday: "بلیط‌های صادر شده امروز",
    totalTicketsIssued: "مجموع بلیط‌های صادر شده",
    drawingOrder: "ترتیب قرعه‌کشی",
    updated: "به‌روزرسانی",
    welcome: "خوش آمدید!",
    raffleNotStarted: "قرعه‌کشی هنوز شروع نشده است.",
    checkBackSoon: "لطفاً بعداً مراجعه کنید.",
    pollingState: "در حال دریافت آخرین وضعیت…",
    refreshing: "در حال به‌روزرسانی…",
    lastChecked: "آخرین بررسی",
    errorLoadingState: "خطا در بارگذاری وضعیت",
    unknownError: "خطای ناشناخته",
    ticket: "بلیط",
    queuePosition: "جایگاه در صف",
    ticketsAhead: "نفر جلوتر",
    estimatedWait: "زمان انتظار تقریبی",
    close: "بستن",
  },
  ar: {
    nowServing: "الرقم الحالي",
    waiting: "يرجى الانتظار",
    foodPantryServiceFor: "توزيع المواد الغذائية ليوم",
    ticketsIssuedToday: "التذاكر الصادرة اليوم",
    totalTicketsIssued: "إجمالي التذاكر الصادرة",
    drawingOrder: "ترتيب السحب",
    updated: "تم التحديث",
    welcome: "أهلاً وسهلاً!",
    raffleNotStarted: "لم تبدأ القرعة بعد.",
    checkBackSoon: "يرجى العودة لاحقاً.",
    pollingState: "جارٍ تحميل أحدث البيانات…",
    refreshing: "جارٍ التحديث…",
    lastChecked: "آخر فحص",
    errorLoadingState: "خطأ في تحميل الحالة",
    unknownError: "خطأ غير معروف",
    ticket: "تذكرة",
    queuePosition: "الموقع في الطابور",
    ticketsAhead: "أشخاص أمامك",
    estimatedWait: "وقت الانتظار المتوقع",
    close: "إغلاق",
  },
}
```

### 2. Language Switcher Component

**Create:** `/Users/russbook/lotto/src/components/language-switcher.tsx`

```tsx
"use client"

import * as React from "react"
import { Languages } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useLanguage, type Language } from "@/contexts/language-context"

const languageNames: Record<Language, string> = {
  en: "English",
  zh: "中文",
  es: "Español",
  ru: "Русский",
  uk: "Українська",
  vi: "Tiếng Việt",
  fa: "فارسی",
  ar: "العربية",
}

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Languages className="h-5 w-5" />
          <span className="sr-only">Change language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={language} onValueChange={(val) => setLanguage(val as Language)}>
          {Object.entries(languageNames).map(([code, name]) => (
            <DropdownMenuRadioItem key={code} value={code}>
              {name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

### 3. Time Formatting Utility

**Create:** `/Users/russbook/lotto/src/lib/time-format.ts`

```tsx
import type { Language } from "@/contexts/language-context"

export function formatWaitTime(minutes: number, language: Language): string {
  if (minutes < 60) {
    return formatMinutes(minutes, language)
  }
  
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  
  if (mins === 0) {
    return formatHours(hours, language)
  }
  
  return `${formatHours(hours, language)}, ${formatMinutes(mins, language)}`
}

function formatMinutes(n: number, lang: Language): string {
  switch (lang) {
    case "zh":
      return `${n}分钟`
    case "vi":
      return `${n} phút`
    case "es":
      return `${n} ${n === 1 ? "minuto" : "minutos"}`
    case "ru":
      return `${n} ${getRussianMinutePlural(n)}`
    case "uk":
      return `${n} ${getUkrainianMinutePlural(n)}`
    case "fa":
      return `${n} دقیقه`
    case "ar":
      return `${n} ${n === 1 ? "دقيقة" : "دقائق"}`
    default:
      return `${n} minute${n === 1 ? "" : "s"}`
  }
}

function formatHours(n: number, lang: Language): string {
  switch (lang) {
    case "zh":
      return `${n}小时`
    case "vi":
      return `${n} giờ`
    case "es":
      return `${n} ${n === 1 ? "hora" : "horas"}`
    case "ru":
      return `${n} ${getRussianHourPlural(n)}`
    case "uk":
      return `${n} ${getUkrainianHourPlural(n)}`
    case "fa":
      return `${n} ساعت`
    case "ar":
      return `${n} ${n === 1 ? "ساعة" : "ساعات"}`
    default:
      return `${n} hour${n === 1 ? "" : "s"}`
  }
}

// Russian pluralization rules
function getRussianMinutePlural(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return "минута"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "минуты"
  return "минут"
}

function getRussianHourPlural(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return "час"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "часа"
  return "часов"
}

// Ukrainian pluralization rules
function getUkrainianMinutePlural(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return "хвилина"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "хвилини"
  return "хвилин"
}

function getUkrainianHourPlural(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return "година"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "години"
  return "годин"
}
```

### 4. Date Formatting Utility

**Create:** `/Users/russbook/lotto/src/lib/date-format.ts`

```tsx
import type { Language } from "@/contexts/language-context"

const localeMap: Record<Language, string> = {
  en: "en-US",
  zh: "zh-CN",
  es: "es-ES",
  ru: "ru-RU",
  uk: "uk-UA",
  vi: "vi-VN",
  fa: "fa-IR",
  ar: "ar",
}

export function formatDate(language: Language): string {
  const now = new Date()
  const locale = localeMap[language]
  
  const weekday = now.toLocaleString(locale, { weekday: "long" })
  const day = now.getDate()
  const month = now.toLocaleString(locale, { month: "long" })
  const year = now.getFullYear()
  
  // English uses ordinal suffixes
  if (language === "en") {
    const suffix = getOrdinalSuffix(day)
    return `${weekday}, ${month} ${day}${suffix}, ${year}`
  }
  
  // Other languages use standard date format
  return `${weekday}, ${day} ${month} ${year}`
}

function getOrdinalSuffix(day: number): string {
  const remainder = day % 100
  if (remainder >= 11 && remainder <= 13) return "th"
  switch (day % 10) {
    case 1:
      return "st"
    case 2:
      return "nd"
    case 3:
      return "rd"
    default:
      return "th"
  }
}
```

## Integration Steps

### Step 1: Add LanguageProvider to Layout

**Update:** `/Users/russbook/lotto/src/app/layout.tsx`

Wrap with LanguageProvider alongside ThemeProvider.

### Step 2: Update Display Page

**Update:** `/Users/russbook/lotto/src/app/page.tsx`

Add both LanguageSwitcher and ThemeSwitcher buttons in top-right corner.

### Step 3: Update ReadOnlyDisplay Component

**Update:** `/Users/russbook/lotto/src/components/readonly-display.tsx`

- Replace all hard-coded strings with `t(key)` calls
- Replace `formatDate()` with `formatDate(language)`
- Pass language to dialog

### Step 4: Update TicketDetailDialog Component

**Update:** `/Users/russbook/lotto/src/components/ticket-detail-dialog.tsx`

- Add language prop
- Replace hard-coded strings with translations
- Use `formatWaitTime(minutes, language)` utility

## Testing Checklist

- [ ] All text switches between languages
- [ ] Date formats correctly for each locale
- [ ] Time pluralization works (Russian/Ukrainian edge cases)
- [ ] Selected language persists in localStorage
- [ ] Language selector appears left of theme toggle
- [ ] Both light and dark mode work with all languages
- [ ] Dialog closes properly with translated "Close" button
- [ ] Status messages update in selected language

## Future Enhancements

- Auto-detect browser language on first visit
- Add more languages based on community needs
- Translation validation with native speakers
- RTL support if Arabic/Hebrew added
