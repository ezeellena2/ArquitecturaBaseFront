import { expect, test } from "@playwright/test";

// SP1-B (2026-11-24, lienzo «Sin permiso»): without the permission the screen stays inside the shell, in its address and with
// its name in the band, and the standard empty state offers «Volver al inicio». The 404 takes the form of the route error.
for (const language of ["es", "en"] as const)
  for (const width of [1440, 390, 320]) {
    test(`a screen without permission keeps the shell and its name in ${language} at ${width}px`, async ({ page }) => {
      const es = language === "es";
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/src/test/visual/index.html?screen=/configuracion/negocio&scenario=business-denied&lang=${language}`);
      await expect(page.getByRole("heading", { level: 3, name: es ? "No tenés permiso" : "You don't have permission" })).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: es ? "Información del negocio" : "Business information" })).toBeVisible();
      await expect(page.getByRole("link", { name: es ? "Volver al inicio" : "Back to home" })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await expect(page).toHaveScreenshot(`forbidden-${language}-${width}.png`);
    });
  }

for (const width of [1440, 390])
  test(`the page that does not exist keeps the shell at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/src/test/visual/index.html?screen=/no-existe&lang=es");
    await expect(page.getByRole("heading", { level: 1, name: "No encontramos esta página" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Volver al inicio" })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page).toHaveScreenshot(`not-found-es-${width}.png`);
  });
