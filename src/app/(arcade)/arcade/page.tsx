"use client";

import Link from "next/link";

import { ChevronArrowLeftIcon } from "@/arcade/components/icons/chevron-arrow-left-icon";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/arcade/ui/8bit";
import { useLanguage } from "@/contexts/language-context";

export default function ArcadeHomePage() {
  const { t } = useLanguage();

  const launchGames: Array<{
    id: string;
    title: string;
    href?: string;
    ctaLabel?: string;
    comingSoon?: boolean;
  }> = [
    {
      id: "snake",
      title: t("snakeTitle"),
      href: "/arcade/snake",
      ctaLabel: "PLAY",
    },
    {
      id: "brick-mayhem",
      title: "BRICK MAYHEM",
      href: "/arcade/snake",
      ctaLabel: "PLAY",
    },
    {
      id: "more",
      title: t("moreGamesComing"),
      comingSoon: true,
    },
  ];

  return (
    <div className="arcade-pixel-grid mx-auto min-h-[calc(100vh-4.5rem)] max-w-6xl px-4 pb-12 pt-8 sm:px-6 sm:pt-10">
      <section className="mb-4 text-center">
        <h1 className="arcade-retro text-[2rem] leading-tight text-[var(--arcade-dot)] sm:text-[3rem]">
          {t("arcadeGames")}
        </h1>
      </section>

      <div className="mb-10 flex justify-start">
        <Button asChild size="sm" className="px-3">
          <Link href="/" className="inline-flex items-center gap-2">
            <ChevronArrowLeftIcon className="pixelated inline-block h-3.5 w-auto shrink-0" />
            <span>{t("back")}</span>
          </Link>
        </Button>
      </div>

      <Card className="mx-auto w-full max-w-5xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-3xl text-[var(--arcade-ghost)] sm:text-4xl">
            {t("selectGame")}
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid gap-5 md:grid-cols-2">
            {launchGames.map((game) => {
              const isComingSoon = Boolean(game.comingSoon);
              return (
                <article
                  key={game.id}
                  className={`relative flex h-full w-full flex-col justify-between gap-4 border-2 border-[var(--arcade-wall)] bg-[var(--arcade-menu-card-bg)] p-4 shadow-[0_0_0_2px_rgba(255,215,92,0.4)] ${isComingSoon ? "md:col-span-2 md:mx-auto md:max-w-[calc((100%-1.25rem)/2)]" : ""}`}
                >
                  {isComingSoon ? (
                    <div className="flex h-full items-center justify-center text-center">
                      <h2 className="arcade-retro text-center text-xl text-[var(--arcade-dot)] sm:text-2xl">
                        {game.title}
                      </h2>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        <h2 className="arcade-retro text-center text-xl text-[var(--arcade-dot)] sm:text-2xl">
                          {game.title}
                        </h2>
                      </div>

                      {!isComingSoon ? (
                        <Button
                          asChild
                          variant="default"
                          size="lg"
                          className="h-auto min-h-12 w-full justify-center whitespace-normal px-4 py-3 text-center"
                        >
                          <Link
                            href={game.href ?? "/arcade"}
                            className="block w-full whitespace-normal text-center leading-tight"
                          >
                            {game.ctaLabel ?? "PLAY"}
                          </Link>
                        </Button>
                      ) : null}
                    </>
                  )}
                </article>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
