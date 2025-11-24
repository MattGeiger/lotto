import { ReadOnlyDisplay } from "@/components/readonly-display";
import { ThemeSwitcher } from "@/components/theme-switcher";

export default function DisplayPage() {
  return (
    <div className="relative">
      <div className="absolute right-4 top-4 z-50 sm:right-6 sm:top-6 lg:right-8 lg:top-8">
        <ThemeSwitcher />
      </div>
      <ReadOnlyDisplay />
    </div>
  );
}
