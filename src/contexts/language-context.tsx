"use client";

import React from "react";

export type Language = "en" | "zh" | "es" | "ru" | "uk";

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
};

const LanguageContext = React.createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = React.useState<Language>("en");

  React.useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("display-language") : null;
    if (stored && ["en", "zh", "es", "ru", "uk"].includes(stored)) {
      setLanguageState(stored as Language);
    }
  }, []);

  const setLanguage = React.useCallback((lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem("display-language", lang);
    }
  }, []);

  const t = React.useCallback(
    (key: string) => translations[language]?.[key] ?? translations.en[key] ?? key,
    [language],
  );

  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = React.useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}

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
    nowServing: "现在服务",
    waiting: "等待中",
    foodPantryServiceFor: "食品储藏室服务日期",
    ticketsIssuedToday: "今日发放的票号",
    totalTicketsIssued: "发放票号总数",
    drawingOrder: "抽签顺序",
    updated: "更新时间",
    welcome: "欢迎！",
    raffleNotStarted: "抽签尚未开始。",
    checkBackSoon: "请稍后再查看更新。",
    pollingState: "正在获取最新状态…",
    refreshing: "刷新中…",
    lastChecked: "最后检查时间",
    errorLoadingState: "加载状态错误",
    unknownError: "未知错误",
    ticket: "票号",
    queuePosition: "队列位置",
    ticketsAhead: "前面的票号",
    estimatedWait: "预计等待时间",
    close: "关闭",
  },
  es: {
    nowServing: "Ahora Sirviendo",
    waiting: "Esperando",
    foodPantryServiceFor: "Servicio de Despensa de Alimentos Para",
    ticketsIssuedToday: "Boletos Emitidos Hoy",
    totalTicketsIssued: "Total de Boletos Emitidos",
    drawingOrder: "Orden de Sorteo",
    updated: "Actualizado",
    welcome: "¡Bienvenido!",
    raffleNotStarted: "El sorteo aún no ha comenzado.",
    checkBackSoon: "Vuelva pronto para ver actualizaciones.",
    pollingState: "Consultando el estado más reciente…",
    refreshing: "Actualizando…",
    lastChecked: "Última verificación",
    errorLoadingState: "Error al cargar el estado",
    unknownError: "Error desconocido",
    ticket: "Boleto",
    queuePosition: "Posición en la Fila",
    ticketsAhead: "Boletos Adelante",
    estimatedWait: "Espera Estimada",
    close: "Cerrar",
  },
  ru: {
    nowServing: "Сейчас обслуживается",
    waiting: "Ожидание",
    foodPantryServiceFor: "Обслуживание продовольственной кладовой на",
    ticketsIssuedToday: "Билеты выданы сегодня",
    totalTicketsIssued: "Всего выдано билетов",
    drawingOrder: "Порядок розыгрыша",
    updated: "Обновлено",
    welcome: "Добро пожаловать!",
    raffleNotStarted: "Розыгрыш еще не начался.",
    checkBackSoon: "Проверьте обновления позже.",
    pollingState: "Опрос последнего состояния…",
    refreshing: "Обновление…",
    lastChecked: "Последняя проверка",
    errorLoadingState: "Ошибка загрузки состояния",
    unknownError: "Неизвестная ошибка",
    ticket: "Билет",
    queuePosition: "Позиция в очереди",
    ticketsAhead: "Билетов впереди",
    estimatedWait: "Ориентировочное время ожидания",
    close: "Закрыть",
  },
  uk: {
    nowServing: "Зараз обслуговується",
    waiting: "Очікування",
    foodPantryServiceFor: "Обслуговування продовольчої комори на",
    ticketsIssuedToday: "Квитки видані сьогодні",
    totalTicketsIssued: "Всього видано квитків",
    drawingOrder: "Порядок розіграшу",
    updated: "Оновлено",
    welcome: "Ласкаво просимо!",
    raffleNotStarted: "Розіграш ще не розпочався.",
    checkBackSoon: "Перевірте оновлення пізніше.",
    pollingState: "Опитування останнього стану…",
    refreshing: "Оновлення…",
    lastChecked: "Остання перевірка",
    errorLoadingState: "Помилка завантаження стану",
    unknownError: "Невідома помилка",
    ticket: "Квиток",
    queuePosition: "Позиція в черзі",
    ticketsAhead: "Квитків попереду",
    estimatedWait: "Орієнтовний час очікування",
    close: "Закрити",
  },
};
