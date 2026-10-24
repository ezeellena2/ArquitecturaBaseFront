import { expect, test, type Locator, type Page } from "@playwright/test";
import { catalogExtraFieldFixtureIds } from "./catalogExtraFieldsFixtures";

async function open(page: Page, language: "es" | "en", scenario = "catalogs-extra-fields") {
  await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen: "/catalogos/" + catalogExtraFieldFixtureIds.catalog, scenario, lang: language }));
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
    if (width >= 640) {
      // The table numbers the fields and gives each type its detail: the length, the source with its options, the range.
      const table = page.getByRole("table").filter({ has: page.getByRole("columnheader", { name: es ? "Clave" : "Key", exact: true }) });
      await expect(table.getByRole("columnheader").first()).toHaveText("#");
      await expect(table.getByRole("row").nth(1).getByRole("cell").first()).toHaveText("1");
      for (const detail of es ? ["13 caracteres", "Zonas · 3 opciones", "De 0 a 180"] : ["13 characters", "Zones · 3 options", "From 0 to 180"]) await expect(table.getByText(detail, { exact: true })).toBeVisible();
    }
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
    const region = page.locator(`[data-slot="table-container"][role="region"][aria-label="${es ? "Opciones" : "Options"}"]`);
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
    // The value and its reason; in the table, on a line under the row that names the row and the field.
    const problem = es ? "«treinta» no es un número entero." : "“thirty” is not a whole number.";
    await expect(page.getByText(width < 640 ? problem : (es ? "Fila 1 · " : "Row 1 · ") + term + ": " + problem, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: es ? "Guardar" : "Save", exact: true })).toBeDisabled();
    await payment.scrollIntoViewIfNeeded(); await contained(page, payment, width);
    await page.screenshot({ path: info.outputPath("ce2-invalid-typed-value.png"), fullPage: true });
    await payment.fill("45");
    if (width < 640) { await page.getByRole("button", { name: es ? "Listo" : "Done", exact: true }).click(); await expect(edit).toBeFocused(); }
    await expect(page.getByRole("button", { name: es ? "Guardar" : "Save", exact: true })).toBeEnabled();
    await page.screenshot({ path: info.outputPath("ce2-table-contained.png"), fullPage: true });
    await noWrites(page);
  });
  test("CE2 catalog cell list is not clipped by the wide table " + language + " " + width, async ({ page }, info) => {
    const es = language === "es", north = es ? "Norte" : "North";
    await page.setViewportSize({ width, height: 900 }); await open(page, language);
    const region = page.locator(`[data-slot="table-container"][role="region"][aria-label="${es ? "Opciones" : "Options"}"]`);
    if (width < 640) await page.getByRole("button", { name: es ? "Editar Compresores Unidos" : "Edit Compresores Unidos", exact: true }).click();
    const zone = page.getByRole("combobox", { name: width < 640 ? (es ? "Zona" : "Zone") : (es ? "Fila 6 · Zona" : "Row 6 · Zone"), exact: true });
    await zone.scrollIntoViewIfNeeded(); await zone.focus();
    await expect(page.getByRole("listbox")).toBeVisible();
    if (width >= 640) {
      await expect(region.getByRole("listbox")).toHaveCount(0);
      expect(await region.evaluate(node => node.scrollHeight - node.clientHeight)).toBeLessThanOrEqual(1);
    }
    const option = page.getByRole("option", { name: north, exact: true });
    const bounds = (await option.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1); expect(bounds.y + bounds.height).toBeLessThanOrEqual(900);
    expect(await option.evaluate(node => { const box = node.getBoundingClientRect(); return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === node; })).toBe(true);
    await page.screenshot({ path: info.outputPath("ce2-catalog-cell-list.png") });
    await option.click();
    await expect(zone).toHaveValue(north); await expect(zone).toBeFocused();
    await noWrites(page);
  });
}
for (const language of ["es", "en"] as const) for (const width of [1440, 390]) {
  test("CE1 field in use names its stage and links to the question " + language + " " + width, async ({ page }, info) => {
    const es = language === "es", form = es ? "Pedir repuesto" : "Request a spare part", question = es ? "Proveedores a consultar" : "Suppliers to ask";
    await page.setViewportSize({ width, height: 900 }); await open(page, language, "catalogs-extra-fields-in-use");
    await page.getByRole("button", { name: es ? "Editar campos" : "Edit fields", exact: true }).click();
    const remove = async (name: string) => {
      await page.getByRole("button", { name: (es ? "Quitar " : "Remove ") + name, exact: true }).click();
      const dialog = page.getByRole("dialog", { name: es ? `Quitar «${name}»` : `Remove “${name}”`, exact: true });
      await expect(dialog).toBeVisible();
      return dialog;
    };
    // One line for the question used by the active version and the draft, its link and no removal.
    const zone = await remove(es ? "Zona" : "Zone");
    await expect(zone.getByRole("listitem")).toHaveCount(1);
    await expect(zone.getByRole("listitem")).toContainText(es ? `«${question}» en ${form}, en la versión activa y en el borrador` : `“${question}” in ${form}, in the active version and the draft`);
    const link = zone.getByRole("link", { name: es ? `Ir a la pregunta «${question}» de ${form}` : `Go to the question “${question}” in ${form}`, exact: true });
    await expect(link).toHaveText(es ? "Ir a la pregunta" : "Go to the question");
    await expect(link).toHaveAttribute("href", "/formularios/" + catalogExtraFieldFixtureIds.form);
    await expect(zone.getByRole("button", { name: es ? "Quitar el campo" : "Remove field", exact: true })).toHaveCount(0);
    await contained(page, zone, width);
    await page.screenshot({ path: info.outputPath("ce1-field-in-use.png"), fullPage: true });
    await expect(zone).toHaveScreenshot(`catalog-field-in-use-${language}-${width}.png`);
    await page.keyboard.press("Escape");
    // A use left only in the active version says so.
    const term = await remove(es ? "Plazo de pago (días)" : "Payment term (days)");
    await expect(term.getByRole("listitem")).toContainText(es ? `«${question}» en ${form}, en la versión activa` : `“${question}” in ${form}, in the active version`);
    await expect(term.getByRole("listitem")).not.toContainText(es ? "borrador" : "draft");
    await page.keyboard.press("Escape");
    // The catalog's own «En WhatsApp» is part of this catalog, not a form: it does not block and is not named.
    const cuit = await remove("CUIT");
    await expect(cuit.getByText(es ? "También se saca de «En WhatsApp» de este catálogo." : "It's also removed from this catalog's “In WhatsApp”.", { exact: true })).toBeVisible();
    await expect(cuit.getByText(es ? "Proveedores" : "Suppliers", { exact: true })).toHaveCount(0);
    await expect(cuit.getByRole("listitem")).toHaveCount(0);
    await expect(cuit.getByRole("checkbox", { name: es ? "Sí, quitar el campo y sus 6 valores" : "Yes, remove the field and its 6 values", exact: true })).toBeVisible();
    await expect(cuit.getByRole("button", { name: es ? "Quitar el campo" : "Remove field", exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath("ce1-field-own-presentation.png"), fullPage: true });
    await page.keyboard.press("Escape");
    await noWrites(page);
  });
}
