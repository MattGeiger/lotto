import Link from "next/link";

import { ChevronArrowLeftIcon } from "@/arcade/components/icons/chevron-arrow-left-icon";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/arcade/ui/8bit";

const launchGames = [
  {
    id: "snake",
    title: "Snake",
    href: "/arcade/snake",
  },
  {
    id: "more",
    title: "More Games Coming Soon",
    comingSoon: true,
  },
];

export default function ArcadeHomePage() {
  return (
    <div className="arcade-pixel-grid mx-auto min-h-[calc(100vh-4.5rem)] max-w-6xl px-4 pb-12 pt-8 sm:px-6 sm:pt-10">
      <section className="mb-4 text-center">
        <h1 className="arcade-retro text-[1.35rem] leading-tight text-[var(--arcade-dot)] sm:text-[2rem]">
          Arcade Games
        </h1>
      </section>

      <div className="mb-10 flex justify-start">
        <Button asChild size="sm" className="px-3">
          <Link href="/" className="inline-flex items-center gap-2">
            <ChevronArrowLeftIcon className="pixelated inline-block h-3.5 w-auto shrink-0" />
            <span>BACK</span>
          </Link>
        </Button>
      </div>

      <Card className="mx-auto w-full max-w-5xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg text-[var(--arcade-ghost)] sm:text-xl">
            Select Game
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid gap-5 md:grid-cols-2">
            {launchGames.map((game) => {
              const isComingSoon = Boolean(game.comingSoon);
              return (
                <article
                  key={game.id}
                  className="relative flex h-full flex-col justify-between gap-4 border-2 border-[var(--arcade-wall)] bg-[rgba(7,12,25,0.88)] p-4 shadow-[0_0_0_2px_rgba(255,215,92,0.4)]"
                >
                  {isComingSoon ? (
                    <div className="flex h-full items-center justify-center text-center">
                      <h2 className="arcade-retro text-center text-sm text-[var(--arcade-dot)] sm:text-base">
                        {game.title}
                      </h2>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        <h2 className="arcade-retro text-center text-sm text-[var(--arcade-dot)] sm:text-base">
                          {game.title}
                        </h2>
                      </div>

                      {!isComingSoon ? (
                        <Button asChild variant="default" size="lg" className="w-full justify-center">
                          <Link href="/arcade/snake">PLAY SNAKE</Link>
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
