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
};
