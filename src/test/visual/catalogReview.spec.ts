import { expect, test } from "@playwright/test";
import { visualCatalogId } from "./catalogFixtures";
import filterOptions from "../fixtures/catalogs-http/filters/options.json" with { type: "json" };

for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  for (const filters of [false, true]) test(`Catalog lifecycle ${filters ? "Filters" : "Manual"} ${language} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const label = (es: string, en: string) => language === "es" ? es : en;
    await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen: "/catalogos/" + visualCatalogId,
      lang: language, scenario: filters ? "catalogs-filters" : "catalogs-manage" }));
    const deactivate = page.getByRole("button", { name: label("Dar de baja", "Deactivate"), exact: true });
    await deactivate.waitFor(); await page.evaluate(() => document.fonts.ready);
    await deactivate.click();
    await page.getByRole("dialog").getByRole("button", { name: label("Dar de baja", "Deactivate"), exact: true }).click();
    await expect(page.getByRole("button", { name: label("Guardar", "Save"), exact: true })).toBeEnabled();
    await page.getByRole("button", { name: label("Guardar", "Save"), exact: true }).click();
    await expect(page.getByText(label("Cambios sin guardar", "Unsaved changes"), { exact: true })).toHaveCount(0);
    await expect(page.locator("header").filter({ has: page.getByRole("heading", { level: 1 }) }).getByText(label("Dado de baja", "Inactive"), { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath("catalog-inactive.png"), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.getByRole("button", { name: label("Reactivar", "Reactivate"), exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: label("Reactivar", "Reactivate"), exact: true }).click();
    if (filters) {
      await page.getByRole("combobox", { name: label("Como si lo recibiera", "As if received by"), exact: true }).click();
      await page.getByRole("option", { name: filterOptions.sampleUsers.items[0]!.name, exact: true }).click();
    }
    await page.getByRole("button", { name: label("Guardar", "Save"), exact: true }).click();
    await expect(page.getByText(label("Cambios sin guardar", "Unsaved changes"), { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: label("Dar de baja", "Deactivate"), exact: true })).toBeVisible();
    const writes = await page.evaluate(() => (globalThis as unknown as { catalogsFixture: { writes: { body: { expectedRevision: number; isActive: boolean } }[] } }).catalogsFixture.writes.map(write => write.body));
    expect(writes).toMatchObject([{ expectedRevision: 1, isActive: false }, { expectedRevision: 2, isActive: true }]);
    await page.screenshot({ path: info.outputPath("catalog-active.png"), fullPage: true });
  });
  test(`Catalog search retains filters ${language} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const label = (es: string, en: string) => language === "es" ? es : en;
    await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen: "/catalogos/" + visualCatalogId, lang: language, scenario: "catalogs-filters" }));
    const text = page.getByRole("combobox", { name: label("Texto de cada opción", "Option text"), exact: true });
    await text.waitFor();
    const sample = page.getByRole("combobox", { name: label("Como si lo recibiera", "As if received by"), exact: true });
    await sample.fill("Persona");
    await expect(sample).toBeFocused();
    await expect(text).toBeVisible();
    await expect.poll(async () => page.evaluate(() => (globalThis as unknown as { catalogsFixture: { reads: string[] } }).catalogsFixture.reads.filter(read => read.includes("search=Persona")).length)).toBe(1);
    await expect(text).toBeVisible(); await expect(sample).toBeFocused();
    await page.screenshot({ path: info.outputPath("catalog-search.png"), fullPage: true });
  });
}
