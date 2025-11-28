# Multi-Language Support Implementation Plan

## Overview
Add language selection for display page with support for: English, Mandarin Chinese (简体中文), Spanish (Español), Russian (Русский), and Ukrainian (Українська).

## Translation Dictionary

### Display Page Main Content

| Key | English | 中文 (Mandarin) | Español | Русский | Українська |
|-----|---------|----------------|---------|---------|-----------|
| `nowServing` | Now Serving | 正在叫号 | Turno Actual | Вызывается номер | Викликається номер |
| `waiting` | Waiting | 请等候 | En espera | Ожидайте | Очікуйте |
| `foodPantryServiceFor` | Food Pantry Service For | 食品发放服务 | Servicio del Banco de Alimentos | Раздача продуктов | Роздача продуктів |
| `ticketsIssuedToday` | Tickets Issued Today | 今日号码范围 | Turnos emitidos hoy | Выданные сегодня номера | Видані сьогодні номери |
| `totalTicketsIssued` | Total Tickets Issued | 已发号码总数 | Total de turnos emitidos | Всего выдано талонов | Всього видано талонів |
| `drawingOrder` | Drawing Order | 叫号顺序 | Orden de llamado | Порядок вызова | Порядок виклику |
| `updated` | Updated | 更新时间 | Actualizado | Обновлено | Оновлено |
| `welcome` | Welcome! | 欢迎！ | ¡Bienvenidos! | Добро пожаловать! | Ласкаво просимо! |
| `raffleNotStarted` | The raffle has not yet started. | 抽签尚未开始。 | El sorteo aún no ha comenzado. | Розыгрыш еще не начался. | Розіграш ще не розпочався. |
| `checkBackSoon` | Check back soon for updates. | 请稍后再查看更新。 | Vuelva pronto para ver actualizaciones. | Загляните позже. | Завітайте пізніше. |

### Status Messages

| Key | English | 中文 (Mandarin) | Español | Русский | Українська |
|-----|---------|----------------|---------|---------|-----------|
| `pollingState` | Polling for latest state… | 正在获取最新状态… | Consultando el estado más reciente… | Опрос последнего состояния… | Опитування останнього стану… |
| `refreshing` | Refreshing… | 刷新中… | Actualizando… | Обновление… | Оновлення… |
| `lastChecked` | Last checked | 最后检查时间 | Última verificación | Последняя проверка | Остання перевірка |
| `errorLoadingState` | Error loading state | 加载状态错误 | Error al cargar el estado | Ошибка загрузки состояния | Помилка завантаження стану |
| `unknownError` | Unknown error | 未知错误 | Error desconocido | Неизвестная ошибка | Невідома помилка |

### Ticket Detail Dialog

| Key | English | 中文 (Mandarin) | Español | Русский | Українська |
|-----|---------|----------------|---------|---------|-----------|
| `ticket` | Ticket | 号码 | Turno | Талон | Талон |
| `queuePosition` | Queue Position | 排队位置 | Posición en la Fila | Место в очереди | Місце в черзі |
| `ticketsAhead` | Tickets Ahead | 前面等待人数 | Personas delante | Человек впереди | Людей попереду |
| `estimatedWait` | Estimated Wait | 预计等待时间 | Espera Estimada | Ориентировочное время ожидания | Орієнтовний час очікування |
| `close` | Close | 关闭 | Cerrar | Закрыть | Закрити |

### Time Units

| Key | English (singular) | English (plural) | 中文 | Español (singular) | Español (plural) | Русский (singular) | Русский (2-4) | Русский (5+) | Українська (singular) | Українська (2-4) | Українська (5+) |
|-----|-------------------|------------------|------|-------------------|------------------|-------------------|---------------|-------------|---------------------|-----------------|---------------|
| `minute` | minute | minutes | 分钟 | minuto | minutos | минута | минуты | минут | хвилина | хвилини | хвилин |
| `hour` | hour | hours | 小时 | hora | horas | час | часа | часов | година | години | годин |

### Date Formatting

Date locales to use with `toLocaleString`:
- **English**: `en-US`
- **中文**: `zh-CN`
- **Español**: `es-ES`
- **Русский**: `ru-RU`
- **Українська**: `uk-UA`

## Implementation Architecture

### 1. Language Context Provider

**Create:** `/Users/russbook/lotto/src/contexts/language-context.tsx`

```tsx
"use client"

import React from "react"

export type Language = "en" | "zh" | "es" | "ru" | "uk"

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
    const stored = localStorage.getItem("display-language")
    if (stored && ["en", "zh", "es", "ru", "uk"].includes(stored)) {
      setLanguageState(stored as Language)
    }
  }, [])

  const setLanguage = React.useCallback((lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem("display-language", lang)
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
    ticketsIssuedToday: "Tickets Issued Today",
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
    ticketsIssuedToday: "Turnos emitidos hoy",
    totalTicketsIssued: "Total de turnos emitidos",
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
    ticket: "Turno",
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
    totalTicketsIssued: "Всего выдано талонов",
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
    ticket: "Талон",
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
    totalTicketsIssued: "Всього видано талонів",
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
    ticket: "Талон",
    queuePosition: "Місце в черзі",
    ticketsAhead: "Людей попереду",
    estimatedWait: "Орієнтовний час очікування",
    close: "Закрити",
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
    case "es":
      return `${n} ${n === 1 ? "minuto" : "minutos"}`
    case "ru":
      return `${n} ${getRussianMinutePlural(n)}`
    case "uk":
      return `${n} ${getUkrainianMinutePlural(n)}`
    default:
      return `${n} minute${n === 1 ? "" : "s"}`
  }
}

function formatHours(n: number, lang: Language): string {
  switch (lang) {
    case "zh":
      return `${n}小时`
    case "es":
      return `${n} ${n === 1 ? "hora" : "horas"}`
    case "ru":
      return `${n} ${getRussianHourPlural(n)}`
    case "uk":
      return `${n} ${getUkrainianHourPlural(n)}`
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
