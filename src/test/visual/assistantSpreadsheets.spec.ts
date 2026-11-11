import { test, expect } from "@playwright/test";
import { assistantFixtureConversationId } from "./assistantFixtures";

// IA1-A and IA4 (Stage 2): the catalog proposed from a spreadsheet, with each column, three sample rows and how many more, and
// the import into a catalog that exists, with «Revisar la importación». The sample scrolls inside the card on the phone.
for (const scene of ["sheet", "import"] as const)
  for (const lang of ["es", "en"] as const)
    for (const width of [1440, 390, 320])
      test(`assistant proposal ${scene} ${lang} ${width}`, async ({ page }) => {
        const es = lang === "es";
        await page.setViewportSize({ width, height: 1000 });
        await page.clock.install({ time: new Date("2026-11-04T15:00:00Z") });
        await page.goto(`/src/test/visual/index.html?${new URLSearchParams({ screen: `/?conversacion=${assistantFixtureConversationId}`, lang, scenario: `assistant-proposal-${scene}` })}`);
        const card = page.getByRole("region", { name: scene === "sheet" ? (es ? "Catálogo: Contratistas" : "Catalog: Contractors") : (es ? "Importación: Contratistas" : "Import: Contractors") });
        const action = scene === "sheet" ? (es ? "Crear catálogo" : "Create catalog") : (es ? "Revisar la importación" : "Review the import");
        await expect(card.getByRole("button", { name: action, exact: true })).toBeVisible();
        await expect(card.getByText(es ? "y 83 filas más" : "and 83 more rows", { exact: true })).toBeVisible();
        await expect(card.getByRole("table")).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await expect(page).toHaveScreenshot(`assistant-proposal-${scene}-${lang}-${width}.png`, { fullPage: true });
      });
