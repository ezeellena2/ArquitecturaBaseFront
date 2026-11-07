import { expect, test } from "@playwright/test";
import { responseFormId, responseRecordId } from "../responseFixtures";

const root = `/formularios/${responseFormId}/respuestas`;
// Board RG4-A: the block in the sheet («3 · …»), «Filtros» by any item, the quick view (D2) and the full page (DC1).
for (const language of ["es", "en"] as const)
  for (const width of [1440, 390, 320]) {
    test(`block of rows in the sheet, filters and the full page ${language} at ${width}px`, async ({ page }) => {
      const en = language === "en";
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/src/test/visual/index.html?screen=${root}&scenario=responses-rows&lang=${language}`);
      await expect(page.getByText("GLIFOSATO 64%, ATRAZINA 50%, UREA GRANULADA")).toBeAttached();
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await expect(page).toHaveScreenshot(`responses-rows-sheet-${language}-${width}.png`, { fullPage: true });

      await page.getByRole("button", { name: en ? /^Filters/ : /^Filtros/ }).click();
      await page.getByRole("button", { name: en ? "Quantity" : "Cantidad" }).click();
      await expect(page.getByText(en ? "In any item of Items" : "En algún ítem de Artículos")).toBeVisible();
      await expect(page).toHaveScreenshot(`responses-rows-filters-${language}-${width}.png`);
      await page.keyboard.press("Escape");

      await page.goto(`/src/test/visual/index.html?screen=${root}/${responseRecordId}/completa&scenario=responses-rows&lang=${language}`);
      await expect(page.getByRole("region", { name: en ? "Items" : "Artículos" })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await expect(page).toHaveScreenshot(`responses-rows-full-${language}-${width}.png`, { fullPage: true });
    });
  }
