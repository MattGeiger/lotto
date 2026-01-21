import { ReadOnlyDisplay } from "@/components/readonly-display";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";

export default function DisplayPage() {
  return (
    <div className="relative">
      <div className="absolute left-8 right-8 top-4 z-50 flex justify-between py-2 sm:left-10 sm:right-10 lg:left-12 lg:right-12">
        <LanguageSwitcher />
        <ThemeSwitcher />
      </div>
      <ReadOnlyDisplay />
    </div>
  );
}
