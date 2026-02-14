import Link from "next/link";

import { ChevronArrowLeftIcon } from "@/arcade/components/icons/chevron-arrow-left-icon";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/arcade/ui/8bit";

export default function SnakePage() {
  return (
    <div className="arcade-pixel-grid mx-auto min-h-[calc(100vh-4.5rem)] max-w-6xl px-4 pb-12 pt-8 sm:px-6 sm:pt-10">
      <div className="mb-4 flex justify-start">
        <Button asChild size="sm" className="px-3">
          <Link href="/arcade" className="inline-flex items-center gap-2">
            <ChevronArrowLeftIcon className="pixelated inline-block h-3.5 w-auto shrink-0" />
            <span>BACK</span>
          </Link>
        </Button>
      </div>

      <Card className="mx-auto w-full max-w-3xl">
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl text-[var(--arcade-dot)] sm:text-2xl">
            Snake
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="arcade-ui list-none space-y-2 text-xs text-[var(--arcade-text)]/90 sm:text-sm">
            <li>* USE ARROWS TO MOVE SNAKE</li>
            <li>* AVOID WALLS AND YOUR BODY</li>
            <li>* EAT PELLETS TO GROW LONGER</li>
            <li>* EAT PELLETS TO SCORE POINTS</li>
            <li>* CRASHING ENDS THE GAME</li>
          </ul>
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-center">
        <Button type="button" size="lg">
          PLAY NOW
        </Button>
      </div>
    </div>
  );
}
