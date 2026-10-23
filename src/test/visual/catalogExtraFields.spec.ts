import { expect, test, type Locator, type Page } from "@playwright/test";
import { catalogExtraFieldFixtureIds } from "./catalogExtraFieldsFixtures";

async function open(page: Page, language: "es" | "en") {
  await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen: "/catalogos/" + catalogExtraFieldFixtureIds.catalog, scenario: "catalogs-extra-fields", lang: language }));
  await expect(page.getByRole("heading", { name: language === "es" ? "Proveedores" : "Suppliers", exact: true })).toBeVisible();
  if (language === "en") await page.getByRole("button", { name: "English", exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
}
async function contained(page: Page, locator: Locator, width: number) {
  const bounds = (await locator.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
}
async function noWrites(page: Page) {
  expect(await page.evaluate(() => (globalThis as unknown as { catalogExtraFieldsFixture: { writes: unknown[] } }).catalogExtraFieldsFixture.writes)).toEqual([]);
}
for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test("CE1 fields and an optional unsaved column " + language + " " + width, async ({ page }, info) => {
    const es = language === "es";
    await page.setViewportSize({ width, height: 900 }); await open(page, language);
    await page.getByRole("button", { name: es ? "Editar campos" : "Edit fields", exact: true }).click();
    await expect(page.getByRole("button", { name: es ? "Editar CUIT" : "Edit CUIT", exact: true })).toBeVisible();
    const add = page.getByRole("button", { name: es ? "Agregar campo" : "Add field", exact: true });
    await add.click();
    const name = page.getByRole("textbox", { name: es ? "Nombre" : "Name", exact: true }).last();
    await expect(name).toBeFocused(); await name.fill("Teléfono");
    await page.getByRole("textbox", { name: es ? "Clave" : "Key", exact: true }).fill("phone");
    await expect(page.getByRole("checkbox", { name: es ? "Obligatorio" : "Required", exact: true })).toBeDisabled();
    await contained(page, name, width);
    await name.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("ce1-new-optional-field.png"), fullPage: true });
    await page.getByRole("button", { name: es ? "Listo" : "Done", exact: true }).click();
    const edit = page.getByRole("button", { name: es ? "Editar Frío Sur S.A." : "Edit Frío Sur S.A.", exact: true });
    if (width < 640) await edit.click();
    const value = page.getByRole("textbox", { name: width < 640 ? "Teléfono" : (es ? "Fila 1 · Teléfono" : "Row 1 · Teléfono"), exact: true });
    await expect(value).toBeDisabled(); await value.scrollIntoViewIfNeeded();
    await contained(page, value, width);
    await page.screenshot({ path: info.outputPath("ce1-column-before-save.png"), fullPage: true });
    await noWrites(page);
  });
  test("CE2 typed values columns and contained scrolling " + language + " " + width, async ({ page }, info) => {
    const es = language === "es", term = es ? "Plazo de pago (días)" : "Payment term (days)";
    await page.setViewportSize({ width, height: 900 }); await open(page, language);
    const region = page.getByRole("region", { name: es ? "Opciones" : "Options", exact: true });
    await contained(page, region, width);
    expect(await region.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
    await region.evaluate(node => { node.scrollLeft = node.scrollWidth; });
    expect(await region.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
    await region.evaluate(node => { node.scrollLeft = 0; });
    const menu = page.getByRole("button", { name: es ? "Campos" : "Fields", exact: true });
    await menu.click(); await page.getByRole("menuitemcheckbox", { name: "CUIT", exact: true }).click();
    await expect(page.getByRole("columnheader", { name: "CUIT", exact: true })).toHaveCount(0);
    await page.getByRole("menuitemcheckbox", { name: "CUIT", exact: true }).click(); await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();
    await expect(page.getByRole("columnheader", { name: "CUIT", exact: true })).toBeVisible();
    const edit = page.getByRole("button", { name: es ? "Editar Frío Sur S.A." : "Edit Frío Sur S.A.", exact: true });
    if (width < 640) await edit.click();
    const payment = page.getByRole("textbox", { name: width < 640 ? term : (es ? "Fila 1 · " : "Row 1 · ") + term, exact: true });
    await payment.fill(es ? "treinta" : "thirty"); await expect(payment).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("button", { name: es ? "Guardar" : "Save", exact: true })).toBeDisabled();
    await payment.scrollIntoViewIfNeeded(); await contained(page, payment, width);
    await page.screenshot({ path: info.outputPath("ce2-invalid-typed-value.png"), fullPage: true });
    await payment.fill("45");
    if (width < 640) { await page.getByRole("button", { name: es ? "Listo" : "Done", exact: true }).click(); await expect(edit).toBeFocused(); }
    await expect(page.getByRole("button", { name: es ? "Guardar" : "Save", exact: true })).toBeEnabled();
    await page.screenshot({ path: info.outputPath("ce2-table-contained.png"), fullPage: true });
    await noWrites(page);
  });
}
