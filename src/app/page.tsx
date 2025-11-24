import { ReadOnlyDisplay } from "@/components/readonly-display";
import { ThemeSwitcher } from "@/components/theme-switcher";

export default function DisplayPage() {
  return (
    <div className="relative">
      <div className="absolute right-4 top-12 z-50 sm:right-6 sm:top-8 lg:right-8 lg:top-10">
        <ThemeSwitcher />
      </div>
      <ReadOnlyDisplay />
    </div>
  );
}
