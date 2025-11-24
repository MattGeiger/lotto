import { ReadOnlyDisplay } from "@/components/readonly-display";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";

export default function DisplayPage() {
  return (
    <div className="relative">
      <div className="absolute left-4 right-4 top-4 z-50 flex justify-between sm:left-6 sm:right-6 lg:left-8 lg:right-8">
        <LanguageSwitcher />
        <ThemeSwitcher />
      </div>
      <ReadOnlyDisplay />
    </div>
  );
}
