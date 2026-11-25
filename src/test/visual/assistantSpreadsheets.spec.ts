import { test, expect } from "@playwright/test";
import { assistantFixtureConversationId } from "./assistantFixtures";

// IA1-A and IA4 (Stage 2): the catalog proposed from a spreadsheet, with each column, three sample rows and how many more, and
// the import into a catalog that exists, with «Revisar la importación». The sample scrolls inside the card on the phone. A
// catalog of one column names its only column «Código y opción» (TC1-B).
const cards = {
  sheet: { es: "Catálogo: Contratistas", en: "Catalog: Contractors", rows: 86 },
  import: { es: "Importación: Contratistas", en: "Import: Contractors", rows: 86 },
  single: { es: "Catálogo: Tipos de tarea", en: "Catalog: Task types", rows: 12 },
};
for (const scene of ["sheet", "import", "single"] as const)
  for (const lang of ["es", "en"] as const)
    for (const width of [1440, 390, 320])
      test(`assistant proposal ${scene} ${lang} ${width}`, async ({ page }) => {
        const es = lang === "es";
        await page.setViewportSize({ width, height: 1000 });
        await page.clock.install({ time: new Date("2026-11-04T15:00:00Z") });
        await page.goto(`/src/test/visual/index.html?${new URLSearchParams({ screen: `/?conversacion=${assistantFixtureConversationId}`, lang, scenario: `assistant-proposal-${scene}` })}`);
        const card = page.getByRole("region", { name: cards[scene][lang] });
        const action = scene === "import" ? (es ? "Revisar la importación" : "Review the import") : (es ? "Crear catálogo" : "Create catalog");
        await expect(card.getByRole("button", { name: action, exact: true })).toBeVisible();
        const rows = cards[scene].rows;
        await expect(card.getByText(es ? `Primeras 3 de ${rows} filas` : `First 3 of ${rows} rows`, { exact: true })).toBeVisible();
        await expect(card.getByRole("table")).toBeVisible();
        if (scene === "single")
          await expect(card.getByRole("columnheader", { name: es ? "Código y opción" : "Code and option", exact: true })).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await expect(page).toHaveScreenshot(`assistant-proposal-${scene}-${lang}-${width}.png`, { fullPage: true });
      });
