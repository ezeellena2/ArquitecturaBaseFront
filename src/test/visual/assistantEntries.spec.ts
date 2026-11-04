import { test, expect, type Page } from "@playwright/test";

// IA4 (2026-11-04): «Armar con la IA» before «Nuevo formulario», «Nuevo catálogo» and the «Crear formulario» of each missing
// topic opens a new Home conversation with the request begun, unsent; empty Home adds the module's suggestion and text.
// Evidence without golden in test-results, to compare with the IA4 board.
const entries = [
  { scenario: "forms-assistant-entry", screen: "/formularios", draft: { es: "Armame un formulario para ", en: "Build me a form for " } },
  { scenario: "catalogs-assistant-entry", screen: "/catalogos", draft: { es: "Armame un catálogo de ", en: "Build me a catalog of " } },
  { scenario: "forms-missing-assistant-entry", screen: "/formularios/faltantes", draft: { es: /^Armame un formulario para registrar \S/, en: /^Build me a form to record \S/ } },
] as const;
const route = (page: Page) => page.evaluate(() => (window as unknown as { visualRouterLocation: { pathname: string; search: string } }).visualRouterLocation);
for (const language of ["es", "en"] as const)
  for (const width of [1440, 390, 320]) {
    for (const entry of entries)
      test(`assistant entry ${entry.scenario} ${language} ${width}`, async ({ page }) => {
        const es = language === "es";
        await page.setViewportSize({ width, height: 1000 });
        await page.clock.install({ time: new Date("2026-11-04T15:00:00Z") });
        await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen: entry.screen, lang: language, scenario: entry.scenario }));
        const link = page.getByRole("link", { name: es ? /^Armar con la IA/ : /^Build with AI/ }).first();
        await expect(link).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: `test-results/ia4-${entry.scenario}-${language}-${width}.png`, fullPage: true });
        await link.click();
        await expect(page.getByRole("textbox", { name: es ? "Tu pregunta" : "Your question", exact: true })).toHaveValue(entry.draft[language]);
        expect(await route(page)).toEqual({ pathname: "/", search: "" });
      });
    test(`empty Home with the forms suggestion ${language} ${width}`, async ({ page }) => {
      const es = language === "es";
      await page.setViewportSize({ width, height: 1000 });
      await page.clock.install({ time: new Date("2026-11-04T15:00:00Z") });
      await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen: "/", lang: language, scenario: "assistant-entries" }));
      const composer = page.getByRole("textbox", { name: es ? "Tu pregunta" : "Your question", exact: true });
      await expect(composer).toHaveAttribute("placeholder", es ? "Preguntale al sistema o pedile que arme un formulario…" : "Ask the system or have it build a form…");
      const suggestion = page.getByRole("button", { name: es ? "Armame un formulario para…" : "Build me a form for…", exact: true });
      await expect(suggestion).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results/ia4-home-empty-${language}-${width}.png`, fullPage: true });
      await suggestion.click();
      await expect(composer).toHaveValue(es ? "Armame un formulario para " : "Build me a form for ");
    });
  }
