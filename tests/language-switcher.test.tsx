import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LanguageProvider } from "@/contexts/language-context";
import {
  LanguageSwitcher,
  LANGUAGE_SWITCHER_TRIGGER_ID,
} from "@/components/language-switcher";

describe("LanguageSwitcher", () => {
  it("uses a deterministic trigger id for hydration stability", () => {
    render(
      <LanguageProvider>
        <LanguageSwitcher />
      </LanguageProvider>,
    );

    expect(
      screen.getByRole("button", { name: /change language/i }),
    ).toHaveAttribute("id", LANGUAGE_SWITCHER_TRIGGER_ID);
  });
});
