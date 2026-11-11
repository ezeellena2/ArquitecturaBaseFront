import { expect, test } from "@playwright/test";
import { assistantFixtureConversationId } from "./assistantFixtures";

// IA4 (Stage 2): the clip, the file chosen in the composer with its X and the file of a message with its rows, in the UI catalog;
// and in Home, a spreadsheet sent without text with the question that came back, the clip left of the arrow and, after choosing
// an old Excel, the file in the composer with its reason under it. es/en at 1440, 390 and 320 px.
for (const lang of ["es", "en"] as const)
  for (const width of [1440, 390, 320]) {
    test(`assistant attachment pieces ${lang} ${width}`, async ({ page }) => {
      const es = lang === "es";
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/src/test/visual/index.html?screen=/catalogo&scenario=assistant-attachment&lang=${lang}`);
      const region = page.getByRole("region", { name: es ? "Adjuntar" : "Attach", exact: true });
      await region.scrollIntoViewIfNeeded();
      await expect(region.getByRole("button", { name: es ? "Adjuntar una planilla" : "Attach a spreadsheet", exact: true })).toBeVisible();
      await expect(region.getByText(es ? "Excel · 86 filas · 24 KB" : "Excel · 86 rows · 24 KB", { exact: true })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(region).toHaveScreenshot(`assistant-attachment-pieces-${lang}-${width}.png`);
    });

    test(`assistant attachment ${lang} ${width}`, async ({ page }) => {
      const es = lang === "es";
      await page.setViewportSize({ width, height: 1000 });
      await page.clock.install({ time: new Date("2026-11-11T15:00:00Z") });
      await page.goto(`/src/test/visual/index.html?${new URLSearchParams({ screen: `/?conversacion=${assistantFixtureConversationId}`, lang,
        scenario: "assistant-attachment" })}`);
      await expect(page.getByText(es ? "Excel · 86 filas · 24 KB" : "Excel · 86 rows · 24 KB", { exact: true })).toBeVisible();
      const clip = page.getByRole("button", { name: es ? "Adjuntar una planilla" : "Attach a spreadsheet", exact: true });
      await expect(clip).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page).toHaveScreenshot(`assistant-attachment-${lang}-${width}.png`, { fullPage: true });

      // An old Excel stays in the composer with its reason under it, and the clip waits until it is removed.
      await page.locator("input[type=file]").setInputFiles({ name: "clientes.xls", mimeType: "application/vnd.ms-excel", buffer: Buffer.from("xls") });
      await expect(page.getByText(es ? "No se puede leer un Excel viejo (.xls). Guardalo como .xlsx o .csv."
        : "An old Excel file (.xls) cannot be read. Save it as .xlsx or .csv.", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: es ? "Quitar clientes.xls" : "Remove clientes.xls", exact: true })).toBeVisible();
      await expect(clip).toBeHidden();
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page).toHaveScreenshot(`assistant-attachment-chosen-${lang}-${width}.png`, { fullPage: true });
    });
  }
