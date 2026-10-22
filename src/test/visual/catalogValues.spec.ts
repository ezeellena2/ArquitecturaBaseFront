import { expect, test } from "@playwright/test";
import { visualCatalogId } from "./catalogFixtures";

// CA3 production editor with an explicitly synthetic typed catalog; no raw producer bodies or goldens.
for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test("Typed catalog CA3 " + language + " " + width, async ({ page }, info) => {
    const english = language === "en";
    const label = (es: string, en: string) => english ? en : es;
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen: "/catalogos/" + visualCatalogId, lang: language, scenario: "catalogs-typed" }));
    await expect(page.getByRole("heading", { name: label("Recargo por zona", "Zone surcharge"), exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const type = page.getByRole("textbox", { name: label("Tipo de valor", "Value type"), exact: true });
    await expect(type).toHaveValue("Decimal"); await expect(type).toHaveAttribute("readonly", "");
    await expect(page.getByRole("columnheader", { name: label("Valor", "Value"), exact: true })).toBeVisible();
    await page.getByRole("button", { name: label("Editar Interior", "Edit Inland"), exact: true }).click();
    const value = page.getByRole("textbox", { name: label("Valor · Decimal", "Value · Decimal"), exact: true });
    await value.fill("mil");
    await expect(value).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("button", { name: label("Guardar", "Save"), exact: true })).toBeDisabled();
    await value.scrollIntoViewIfNeeded();
    const bounds = await value.boundingBox(); expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: info.outputPath("catalog-typed-invalid.png"), fullPage: true });
    await value.fill(english ? "3,200.00" : "3.200,00");
    await expect(page.getByRole("button", { name: label("Guardar", "Save"), exact: true })).toBeEnabled();
    await page.screenshot({ path: info.outputPath("catalog-typed-valid.png"), fullPage: true });
    expect(await page.evaluate(() => (globalThis as unknown as { catalogsFixture: { writes: unknown[] } }).catalogsFixture.writes)).toEqual([]);
  });
}
