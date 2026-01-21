import { ReadOnlyDisplay } from "@/components/readonly-display";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Search } from "lucide-react";

export default function DisplayPage() {
  return (
    <div className="relative">
      <div className="absolute left-8 right-8 top-4 z-50 flex items-center gap-3 py-2 sm:left-10 sm:right-10 lg:left-12 lg:right-12">
        <LanguageSwitcher />
        <div className="min-w-0 flex-1 max-w-[260px]">
          <label htmlFor="ticket-search" className="sr-only">
            Search ticket number
          </label>
          <InputGroup className="w-full">
            <InputGroupAddon align="inline-start">
              <Search className="text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              id="ticket-search"
              placeholder="Search ticket #"
              aria-label="Search ticket number"
            />
          </InputGroup>
        </div>
        <ThemeSwitcher />
      </div>
      <ReadOnlyDisplay />
    </div>
  );
}
