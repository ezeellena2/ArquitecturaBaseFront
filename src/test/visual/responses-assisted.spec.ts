import { expect, test } from "@playwright/test";
import { responseFormId, responseRecordId } from "../responseFixtures";

for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test(`captured s4 origin and proposed values remain inside D2 in ${language} at ${width}px`, async ({ page }) => {
    const en = language === "en";
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install({ time: new Date("2026-10-17T14:00:00Z") });
    await page.goto(`/src/test/visual/index.html?screen=/formularios/${responseFormId}/respuestas/${responseRecordId}&scenario=responses-assisted&lang=${language}`);
    const panel = page.getByRole("region", { name: en ? "Response details" : "Detalle de la respuesta", exact: true });
    await expect(panel.getByRole("heading", { name: "TEST-000002", exact: true })).toBeVisible();
    await expect(page.getByRole("table")).toBeAttached();
    await expect(panel.getByText(en ? "From Delivery" : "De Entrega", { exact: true })).toBeVisible();
    await expect(panel.getByText(en ? "Corrected when completing" : "Corregido al completar", { exact: true })).toBeVisible();
    const origin = panel.getByRole("region", { name: en ? "How it started" : "Cómo empezó", exact: true });
    await expect(origin).toBeVisible();
    await origin.scrollIntoViewIfNeeded();
    await expect(origin.getByText("Ana Operadora", { exact: true })).toBeVisible();
    await expect(origin.getByText(en ? "Always ask · No AI" : "Preguntar siempre · Sin IA", { exact: true })).toBeVisible();
    const source = origin.getByRole("link", { name: en ? "ENT-000014 · Delivery" : "ENT-000014 · Entrega", exact: true });
    await expect(source).toHaveAttribute("href", "/formularios/0199a0c0-0000-7000-8000-000000000151/respuestas/0199a0c0-0000-7000-8000-000000000150");
    await expect(origin.locator('[aria-current="page"]')).toHaveText(en ? "TEST-000002 · Invoice" : "TEST-000002 · Factura");
    const show = origin.getByRole("button", { name: en ? "View proposed data" : "Ver datos propuestos", exact: true });
    await expect(show).toHaveAttribute("aria-expanded", "false");
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    await page.screenshot({ path: `test-results/visual/responses-s4-origin-${language}-${width}.png`, fullPage: true });
    await show.click();
    const proposed = origin.getByRole("region", { name: en ? "Proposed data" : "Datos propuestos", exact: true });
    await expect(proposed.getByText("ENT-000014", { exact: true })).toBeVisible();
    await expect(proposed.getByText(en ? "Corrected when completing" : "Corregido al completar", { exact: true })).toBeVisible();
    await expect(source).toBeAttached();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    await page.screenshot({ path: `test-results/visual/responses-s4-proposed-${language}-${width}.png`, fullPage: true });
  });
}
