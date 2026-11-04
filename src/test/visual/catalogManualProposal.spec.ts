import { test, expect } from "@playwright/test";

// IA2 (2026-11-04): the band «Propuesta del asistente» on a Manual catalog the Home assistant proposed.
const catalogId = "01990000-0000-7000-8000-000000000080";
for (const language of ["es", "en"] as const)
  for (const width of [1440, 390, 320])
    test(`Manual catalog proposal ${language} ${width}`, async ({ page }) => {
      const es = language === "es";
      await page.setViewportSize({ width, height: 1000 });
      await page.clock.install({ time: new Date("2026-11-04T15:00:00Z") });
      await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen: "/catalogos/" + catalogId, lang: language, scenario: "catalogs-manual-proposal" }));
      await expect(page.getByRole("button", { name: es ? "Aprobar y activar" : "Approve and activate", exact: true })).toBeVisible();
      await expect(page.getByText(es ? /La pidió Ana Pérez en el chat de Inicio/ : /Requested by Ana Pérez in the Home chat/)).toBeVisible();
      await expect(page.getByRole("button", { name: es ? "Reactivar" : "Reactivate", exact: true })).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page).toHaveScreenshot(`catalog-manual-proposal-${language}-${width}.png`, { fullPage: true });
    });
