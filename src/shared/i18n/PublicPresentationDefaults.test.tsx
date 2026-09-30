import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { PublicPresentationDefaults } from "./PublicPresentationDefaults";
import i18n, { languageStorageKey, publicLanguageStorageKey } from "./index";

afterEach(async () => { localStorage.clear(); await i18n.changeLanguage("es"); });
describe("public language defaults", () => {
  it("uses the general default instead of a previous profile preference", async () => {
    localStorage.setItem(languageStorageKey, "en");
    await i18n.changeLanguage("en");
    renderWithProviders(<PublicPresentationDefaults />);
    await waitFor(() => expect(i18n.language).toBe("es"));
  });
  it("retains the explicit public language selection", async () => {
    localStorage.setItem(publicLanguageStorageKey, "en");
    await i18n.changeLanguage("es");
    renderWithProviders(<PublicPresentationDefaults />);
    await waitFor(() => expect(i18n.language).toBe("en"));
  });
});
