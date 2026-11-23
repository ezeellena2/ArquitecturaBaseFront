import { test, expect } from "@playwright/test";

// RC4-A: Configuración › Formularios (board CF1), with today's values and with a number out of its range.
for (const language of ["es", "en"] as const) {
  const open = (page: import("@playwright/test").Page) => page.goto(`/src/test/visual/index.html?screen=/configuracion/formularios&lang=${language}&scenario=form-settings`);
  for (const width of [1440, 390, 320]) {
    test(`forms settings ${language} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await open(page);
      await expect(page.getByRole("heading", { level: 1, name: language === "es" ? "Formularios" : "Forms", exact: true })).toBeVisible();
      await expect(page.getByRole("spinbutton", { name: language === "es" ? /Tamaño máximo por archivo/ : /Maximum size per file/ })).toHaveValue("25");
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page).toHaveScreenshot(`form-settings-${language}-${width}.png`, { fullPage: true });
    });
  }
  test(`forms settings with a number out of its range ${language}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await open(page);
    const similar = page.getByRole("spinbutton", { name: language === "es" ? /Sugerir armar un formulario desde/ : /Suggest building a form from/ });
    await similar.fill("1");
    await page.getByRole("button", { name: language === "es" ? "Guardar cambios" : "Save changes", exact: true }).click();
    await expect(page.getByText(language === "es" ? "Elegí un número entre 2 y 20." : "Choose a number between 2 and 20.")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`form-settings-range-${language}.png`, { fullPage: true });
  });
}
