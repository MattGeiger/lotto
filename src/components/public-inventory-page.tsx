// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

"use client";

import * as React from "react";
import {
  AlertTriangle,
  Carrot,
  ChevronDown,
  MoonStar,
  Sprout,
  Star,
  Tag,
  UtensilsCrossed,
  Vegan,
  WheatOff,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BottomTabBar } from "@/components/navigation/bottom-tab-bar";
import { TicketCalledCelebration } from "@/components/ticket-called-celebration";
import { ScrambleOnLanguageChange, T } from "@/components/core/scramble-text";
import { AnimateIcon } from "@/components/animate-ui/icons/icon";
import { PackageCheck } from "@/components/animate-ui/icons/package-check";
import { Search } from "@/components/animate-ui/icons/search";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { useBrand } from "@/contexts/brand-context";
import { useLanguage } from "@/contexts/language-context";
import { isRTL } from "@/lib/rtl-utils";
import {
  fetchFeedPublicInventory,
  getFeedDisplayName,
  type FeedInventoryCategory,
  type FeedInventoryItem,
  type FeedPublicInventory,
} from "@/lib/feed-public-inventory";
import { cn } from "@/lib/utils";
import type { RealtimeCanaryClientConfig } from "@/lib/realtime/client-canary-config";

type DietaryFlagKey = keyof FeedInventoryItem["dietaryFlags"];

const dietaryFlags: Array<{
  key: DietaryFlagKey;
  labelKey: string;
  icon: LucideIcon;
}> = [
  { key: "glutenFree", labelKey: "inventoryDietaryGlutenFree", icon: WheatOff },
  { key: "vegan", labelKey: "inventoryDietaryVegan", icon: Vegan },
  { key: "vegetarian", labelKey: "inventoryDietaryVegetarian", icon: Carrot },
  { key: "halal", labelKey: "inventoryDietaryHalal", icon: MoonStar },
  { key: "kosher", labelKey: "inventoryDietaryKosher", icon: Star },
  { key: "organic", labelKey: "inventoryDietaryOrganic", icon: Sprout },
  { key: "readyToEat", labelKey: "inventoryDietaryReadyToEat", icon: UtensilsCrossed },
];

function formatInventoryFreshness(input: string, language: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  const locale = language === "zh" ? "zh-CN" : language === "fa" ? "fa-IR" : language === "ar" ? "ar" : language;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

type InventoryNameResolver = (
  entity: { name: string; translations: Record<string, string> },
) => string;

// Resolve a category/item display name: FEED's own translation (authoritative
// for FEED-enabled languages) → LOTTO's DB translation (dynamic languages) →
// English. `getFeedDisplayName` returns the English `name` when FEED has no
// translation, which is how we detect the fall-through to the LOTTO pack.
function makeInventoryNameResolver(
  language: ReturnType<typeof useLanguage>["language"],
  translateInventory: (name: string) => string | null,
): InventoryNameResolver {
  return (entity) => {
    const feedName = getFeedDisplayName(entity, language);
    if (feedName !== entity.name) return feedName;
    return translateInventory(entity.name) ?? entity.name;
  };
}

function matchesInventorySearch(
  category: FeedInventoryCategory,
  item: FeedInventoryItem,
  resolveName: InventoryNameResolver,
  query: string,
): boolean {
  if (!query) return true;
  const normalizedQuery = query.toLocaleLowerCase();
  return [resolveName(category), category.name, resolveName(item), item.name]
    .join(" ")
    .toLocaleLowerCase()
    .includes(normalizedQuery);
}

function getFilteredCategories(
  inventory: FeedPublicInventory,
  resolveName: InventoryNameResolver,
  query: string,
  selectedDietaryFlags: DietaryFlagKey[],
): FeedInventoryCategory[] {
  const trimmedQuery = query.trim();
  return inventory.categories
    .map((category) => ({
      ...category,
      items: category.items.filter((item) => {
        const matchesSearch = matchesInventorySearch(category, item, resolveName, trimmedQuery);
        const matchesDietaryFlags = selectedDietaryFlags.every((flag) => item.dietaryFlags[flag]);
        return matchesSearch && matchesDietaryFlags;
      }),
    }))
    .filter((category) => category.items.length > 0);
}

function getInventoryLastUpdatedAt(inventory: FeedPublicInventory): string {
  const latestItemUpdatedAt = inventory.categories
    .flatMap((category) => category.items)
    .map((item) => new Date(item.updatedAt).getTime())
    .filter((time) => Number.isFinite(time))
    .reduce((latest, time) => Math.max(latest, time), 0);

  return latestItemUpdatedAt > 0 ? new Date(latestItemUpdatedAt).toISOString() : inventory.generatedAt;
}

function InventoryIconChip({
  label,
  icon: Icon,
  variant,
  iconClassName,
}: {
  label: string;
  icon: LucideIcon;
  variant: React.ComponentProps<typeof Badge>["variant"];
  iconClassName?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge asChild variant={variant}>
          <button type="button" aria-label={label} className="cursor-pointer">
            <Icon className={cn("size-3", iconClassName)} aria-hidden="true" />
            <span className="sr-only">{label}</span>
          </button>
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-auto px-3 py-2 text-sm font-medium bg-popover/[45%] backdrop-blur-[6px]" side="top" role="tooltip">
        <T text={label} />
      </PopoverContent>
    </Popover>
  );
}

function InventoryStatusBadges({ item }: { item: FeedInventoryItem }) {
  const { t } = useLanguage();
  if (!item.statusTags.limited && !item.statusTags.clearance) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {item.statusTags.limited ? (
        <InventoryIconChip label={t("inventoryStatusLimited")} icon={AlertTriangle} variant="warning" />
      ) : null}
      {item.statusTags.clearance ? (
        <InventoryIconChip label={t("inventoryStatusClearance")} icon={Tag} variant="danger" />
      ) : null}
    </div>
  );
}

function InventoryDietaryFlags({ item }: { item: FeedInventoryItem }) {
  const { t } = useLanguage();
  const activeFlags = dietaryFlags.filter(({ key }) => item.dietaryFlags[key]);
  if (activeFlags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {activeFlags.map(({ key, labelKey, icon }) => (
        <InventoryIconChip key={key} label={t(labelKey)} icon={icon} variant="outline" iconClassName="!size-4" />
      ))}
    </div>
  );
}

function InventoryLegend({
  selectedDietaryFlags,
  onToggleDietaryFlag,
  onClearDietaryFlags,
}: {
  selectedDietaryFlags: DietaryFlagKey[];
  onToggleDietaryFlag: (flag: DietaryFlagKey) => void;
  onClearDietaryFlags: () => void;
}) {
  const { t } = useLanguage();
  const selectedCount = selectedDietaryFlags.length;

  return (
    <div className="flex flex-col items-center gap-5 px-1 py-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-11 gap-2 rounded-full px-4 text-base">
            <AnimateIcon
              animateOnView="path"
              animateOnHover="path"
              animateOnTap="path"
              completeOnStop
              className="inline-flex"
            >
              <PackageCheck size={20} />
            </AnimateIcon>
            <T text={t("inventoryDietaryFilterLabel")} />
            {selectedCount > 0 ? (
              <Badge variant="secondary" className="ml-0.5 px-1.5">
                {selectedCount}
              </Badge>
            ) : null}
            <ChevronDown className="size-4 opacity-60" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-60 bg-popover/[45%] backdrop-blur-[6px]">
          <DropdownMenuLabel><T text={t("inventoryDietaryFilterLabel")} /></DropdownMenuLabel>
          <DropdownMenuSeparator />
          {dietaryFlags.map(({ key, labelKey, icon: Icon }) => (
            <DropdownMenuCheckboxItem
              key={key}
              checked={selectedDietaryFlags.includes(key)}
              onCheckedChange={() => onToggleDietaryFlag(key)}
              onSelect={(event) => event.preventDefault()}
              className="text-base"
            >
              <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
              <T text={t(labelKey)} />
            </DropdownMenuCheckboxItem>
          ))}
          {selectedCount > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onClearDietaryFlags}>
                <T text={t("inventoryClearFilters")} />
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex items-center justify-center gap-6 text-base font-medium text-muted-foreground sm:text-lg">
        <div className="inline-flex items-center gap-2">
          <AlertTriangle className="size-5 text-[var(--status-warning-text)]" aria-hidden="true" />
          <span aria-hidden="true">=</span>
          <T text={t("inventoryStatusLimited")} />
        </div>
        <div className="inline-flex items-center gap-2">
          <Tag className="size-5 text-[var(--status-danger-text)]" aria-hidden="true" />
          <span aria-hidden="true">=</span>
          <T text={t("inventoryStatusClearance")} />
        </div>
      </div>
    </div>
  );
}

function InventoryCategoryTable({ category }: { category: FeedInventoryCategory }) {
  const { language, t, translateInventory } = useLanguage();
  const resolveName = React.useMemo(
    () => makeInventoryNameResolver(language, translateInventory),
    [language, translateInventory],
  );
  const categoryName = resolveName(category);
  // Mirrors the sentinel logic in `formatFeedLimit` (lib): null/non-finite/≤0
  // and the ≥100 "no-limit" sentinel all render as empty.
  const formatLimit = (
    limit: number | null | undefined,
    limitType: FeedInventoryItem["limitType"],
  ): string => {
    if (limit == null || !Number.isFinite(limit) || limit <= 0 || limit >= 100) return "";
    if (limitType === "person") return t("inventoryLimitPerPerson").replace("{count}", String(limit));
    if (limitType === "household") return t("inventoryLimitPerHousehold").replace("{count}", String(limit));
    return "";
  };
  const categoryLimit = formatLimit(category.limit, category.limitType);

  return (
    <Card className="gap-4 overflow-hidden rounded-lg py-0">
      <CardHeader className="border-b px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-xl leading-tight"><T text={categoryName} /></CardTitle>
            {categoryLimit ? <p className="mt-1 text-sm text-muted-foreground"><T text={categoryLimit} /></p> : null}
          </div>
          <Badge variant="outline">{category.items.length} <T text={t("inventoryItemsLabel")} /></Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="hidden sm:block">
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-semibold uppercase text-muted-foreground">
                <th className="w-[40%] px-4 py-2"><T text={t("inventoryColumnItem")} /></th>
                <th className="w-[20%] px-4 py-2"><T text={t("inventoryColumnLimit")} /></th>
                <th className="px-4 py-2"><T text={t("inventoryColumnDietary")} /></th>
              </tr>
            </thead>
            <tbody>
              {category.items.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      <InventoryStatusBadges item={item} />
                      <T text={resolveName(item)} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground"><T text={formatLimit(item.limit, item.limitType)} /></td>
                  <td className="px-4 py-3">
                    <InventoryDietaryFlags item={item} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="divide-y sm:hidden">
          {category.items.map((item) => (
            <div key={item.id} className="space-y-2 px-4 py-4">
              <div className="flex items-center gap-2 font-medium">
                <InventoryStatusBadges item={item} />
                <T text={resolveName(item)} />
              </div>
              {formatLimit(item.limit, item.limitType) ? (
                <div className="text-sm text-muted-foreground"><T text={formatLimit(item.limit, item.limitType)} /></div>
              ) : null}
              <InventoryDietaryFlags item={item} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function PublicInventoryPage({
  realtimeCanary = null,
  realtimeSourceCanary = null,
}: {
  realtimeCanary?: RealtimeCanaryClientConfig | null;
  realtimeSourceCanary?: RealtimeCanaryClientConfig | null;
}) {
  const { language, t, translateInventory } = useLanguage();
  const inventoryUrl = useBrand().inventory.url;
  const [inventory, setInventory] = React.useState<FeedPublicInventory | null>(null);
  const [query, setQuery] = React.useState("");
  const [selectedDietaryFlags, setSelectedDietaryFlags] = React.useState<DietaryFlagKey[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const loadInventory = React.useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setInventory(await fetchFeedPublicInventory(inventoryUrl));
    } catch {
      setError("Current inventory could not be loaded. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [inventoryUrl]);

  React.useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const resolveName = React.useMemo(
    () => makeInventoryNameResolver(language, translateInventory),
    [language, translateInventory],
  );
  const filteredCategories = React.useMemo(
    () => (inventory ? getFilteredCategories(inventory, resolveName, query, selectedDietaryFlags) : []),
    [inventory, resolveName, query, selectedDietaryFlags],
  );
  const freshness = inventory ? formatInventoryFreshness(getInventoryLastUpdatedAt(inventory), language) : "";
  const handleToggleDietaryFlag = React.useCallback((flag: DietaryFlagKey) => {
    setSelectedDietaryFlags((current) =>
      current.includes(flag) ? current.filter((selected) => selected !== flag) : [...current, flag],
    );
  }, []);

  return (
    <ScrambleOnLanguageChange>
    <main dir={isRTL(language) ? "rtl" : "ltr"} lang={language} className="relative h-screen overflow-hidden bg-background text-foreground">
      <div dir="ltr" className="absolute left-6 right-6 top-4 z-30 flex items-center justify-between gap-5 py-2 sm:left-8 sm:right-8 lg:left-10 lg:right-10">
        <LanguageSwitcher enableHaptics />
        <div className="flex flex-1 justify-center px-2">
          <div className="min-w-0 flex-1 max-w-[360px]">
            <label htmlFor="inventory-search" className="sr-only">
              {t("inventorySearchPlaceholder")}
            </label>
            <div className="flex w-full items-center gap-0 rounded-full bg-card/80 px-0 py-0.5 shadow-sm">
              <InputGroup className="flex-1 border-0 bg-transparent shadow-none !bg-transparent dark:bg-transparent !dark:bg-transparent">
                <InputGroupInput
                  id="inventory-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("inventorySearchPlaceholder")}
                  aria-label={t("inventorySearchPlaceholder")}
                  enterKeyHint="search"
                />
              </InputGroup>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="!h-[3.375rem] !w-[3.375rem] !rounded-full !border-0 bg-card/80 shadow-[var(--base-shadow-lg)] hover:bg-accent hover:text-accent-foreground [&_svg]:!size-[1.8rem]"
                onClick={() => document.getElementById("inventory-search")?.focus()}
              >
                <AnimateIcon
                  animateOnView="path"
                  animateOnHover="find"
                  animateOnTap="default"
                  completeOnStop
                  className="inline-flex"
                >
                  <Search size={29} />
                </AnimateIcon>
                <span className="sr-only">{t("inventorySearchPlaceholder")}</span>
              </Button>
            </div>
          </div>
        </div>
        <ThemeSwitcher enableHaptics />
      </div>
      <div className="mx-auto flex h-screen min-h-0 w-full max-w-6xl flex-col px-4 pb-5 pt-24 sm:px-6 lg:px-8">
        <section className="mt-6 flex shrink-0 flex-col gap-5 sm:mt-8">
          <div className="flex flex-col items-center gap-1 text-center">
            <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl"><T text={t("inventoryPageTitle")} /></h1>
            {freshness ? (
              <p className="text-sm text-muted-foreground"><T text={`${t("inventoryUpdatedLabel")} ${freshness}`} /></p>
            ) : null}
          </div>
        </section>

        {!isLoading && inventory && inventory.categories.length > 0 ? (
          <div className="mt-4 shrink-0">
            <InventoryLegend
              selectedDietaryFlags={selectedDietaryFlags}
              onToggleDietaryFlag={handleToggleDietaryFlag}
              onClearDietaryFlags={() => setSelectedDietaryFlags([])}
            />
          </div>
        ) : null}

        <ScrollArea
          role="region"
          aria-label={t("inventoryResultsLabel")}
          className="mt-4 min-h-0 flex-1"
        >
          <section className="flex flex-col gap-4 px-1 pt-1 pb-28 sm:pb-32">
            {isLoading && !inventory ? (
              <Card className="rounded-lg">
                <CardContent className="py-8 text-center text-muted-foreground">Loading current inventory...</CardContent>
              </Card>
            ) : null}

            {error ? (
              <Card className="rounded-lg border-destructive/40">
                <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
                  <p className="text-sm text-muted-foreground">{error}</p>
                  <Button type="button" onClick={loadInventory}>
                    Try again
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {!isLoading && inventory && inventory.categories.length === 0 ? (
              <Card className="rounded-lg">
                <CardContent className="py-8 text-center text-muted-foreground">
                  No pantry inventory is currently listed as available.
                </CardContent>
              </Card>
            ) : null}

            {!isLoading && inventory && inventory.categories.length > 0 && filteredCategories.length === 0 ? (
              <Card className="rounded-lg">
                <CardContent className="py-8 text-center text-muted-foreground">
                  No available items match your search.
                </CardContent>
              </Card>
            ) : null}

            {filteredCategories.map((category) => (
              <InventoryCategoryTable key={category.id} category={category} />
            ))}
          </section>
        </ScrollArea>
      </div>
      <BottomTabBar />
      <TicketCalledCelebration
        poll
        realtimeCanary={realtimeCanary}
        realtimeSourceCanary={realtimeSourceCanary}
      />
    </main>
    </ScrambleOnLanguageChange>
  );
}
