import { expect, test, type Locator, type Page } from "@playwright/test";
import { catalogExtraFieldFixtureIds } from "./catalogExtraFieldsFixtures";

async function open(page: Page, language: "es" | "en", scenario = "catalogs-extra-fields") {
  await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen: "/catalogos/" + catalogExtraFieldFixtureIds.catalog, scenario, lang: language }));
  await expect(page.getByRole("heading", { name: language === "es" ? "Proveedores" : "Suppliers", exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
async function contained(page: Page, locator: Locator, width: number) {
  const bounds = (await locator.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
}
// «Agregar campos», with the count, in the header of «Opciones» opens the modal with every field (C, 2026-10-27).
async function openFields(page: Page, es: boolean) {
  await page.getByRole("button", { name: new RegExp("^" + (es ? "Agregar campos" : "Add fields") + " · \\d+$") }).click();
  const fields = page.getByRole("dialog", { name: es ? "Campos de «Proveedores»" : "Fields of “Suppliers”", exact: true });
  await expect(fields).toBeVisible();
  return fields;
}
async function noWrites(page: Page) {
  expect(await page.evaluate(() => (globalThis as unknown as { catalogExtraFieldsFixture: { writes: unknown[] } }).catalogExtraFieldsFixture.writes)).toEqual([]);
}
for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test("CE1 fields in a modal from the options and an optional unsaved column " + language + " " + width, async ({ page }, info) => {
    const es = language === "es", desktop = width >= 640;
    await page.setViewportSize({ width, height: 900 }); await open(page, language);
    // There is no «Campos» section: the modal opens from the header of «Opciones».
    await expect(page.getByRole("heading", { name: es ? "Campos" : "Fields", exact: true })).toHaveCount(0);
    const fields = await openFields(page, es);
    const choose = (name: string) => fields.getByRole("button", { name: (es ? "Editar " : "Edit ") + name, exact: true }).click();
    // On the phone the chosen field goes back to the list; on desktop the list stays beside it.
    const back = async () => { if (!desktop) await fields.getByRole("button", { name: es ? "Volver a la lista" : "Back to the list", exact: true }).click(); };
    const name = fields.getByRole("textbox", { name: es ? "Nombre" : "Name", exact: true });
    if (desktop) await expect(name).toHaveValue("CUIT");
    else { await expect(name).toHaveCount(0); await choose("CUIT"); }
    await expect(fields.getByRole("spinbutton", { name: es ? "Máximo de caracteres" : "Maximum characters", exact: true })).toHaveValue("13");
    await contained(page, fields, width);
    await page.screenshot({ path: info.outputPath("ce1-fields-modal.png"), fullPage: true });
    await back(); await choose(es ? "Zona" : "Zone");
    await expect(fields.getByRole("combobox", { name: es ? "Catálogo" : "Catalog", exact: true })).toHaveValue(es ? "Zonas" : "Zones");
    await back(); await choose(es ? "Plazo de pago (días)" : "Payment term (days)");
    await expect(fields.getByRole("textbox", { name: es ? "Mínimo" : "Minimum", exact: true })).toHaveValue("0");
    await expect(fields.getByRole("textbox", { name: es ? "Máximo" : "Maximum", exact: true })).toHaveValue("180");
    await back();
    await fields.getByRole("button", { name: es ? "Agregar campo" : "Add field", exact: true }).click();
    await expect(name).toBeFocused();
    // One name in the menu language: in English it is the optional translation of this Spanish catalog.
    await expect(fields.getByRole("textbox", { name: es ? "Nombre en inglés" : "Name in English", exact: true })).toHaveCount(0);
    if (!es) await expect(name).toHaveAttribute("placeholder", "Untranslated");
    await name.fill("Teléfono");
    await fields.getByRole("textbox", { name: es ? "Clave" : "Key", exact: true }).fill("phone");
    await expect(fields.getByRole("checkbox", { name: es ? "Obligatorio" : "Required", exact: true })).toBeDisabled();
    await contained(page, name, width);
    await page.screenshot({ path: info.outputPath("ce1-new-optional-field.png"), fullPage: true });
    // «Listo» leaves it in the catalog, without saving.
    await back();
    await fields.getByRole("button", { name: es ? "Listo" : "Done", exact: true }).click();
    await expect(fields).toHaveCount(0);
    const edit = page.getByRole("button", { name: es ? "Editar Frío Sur S.A." : "Edit Frío Sur S.A.", exact: true });
    if (width < 640) await edit.click();
    const value = page.getByRole("textbox", { name: width < 640 ? "Teléfono" : (es ? "Fila 1 · Teléfono" : "Row 1 · Teléfono"), exact: true });
    await expect(value).toBeDisabled(); await value.scrollIntoViewIfNeeded();
    await contained(page, value, width);
    // Why it is disabled is the help of its cell, on hover or with the focus, and its description: no text under it.
    const savedFirst = es ? "Guardá para cargar valores" : "Save to enter values";
    await expect(value).toHaveAccessibleDescription(savedFirst);
    // On the phone the unsaved field keeps the width of the option's other fields.
    if (width < 640) expect(Math.abs((await value.boundingBox())!.width - (await page.getByRole("textbox", { name: "CUIT", exact: true }).boundingBox())!.width)).toBeLessThanOrEqual(1);
    await value.locator("..").hover();
    await expect(page.getByRole("tooltip")).toHaveText(savedFirst);
    await page.screenshot({ path: info.outputPath("ce1-column-before-save.png"), fullPage: true });
    await noWrites(page);
  });
  test("CE2 typed values columns and contained scrolling " + language + " " + width, async ({ page }, info) => {
    const es = language === "es", term = es ? "Plazo de pago (días)" : "Payment term (days)";
    await page.setViewportSize({ width, height: 900 }); await open(page, language);
    const region = page.locator(`[data-slot="table-container"][role="region"][aria-label="${es ? "Opciones" : "Options"}"]`);
    await contained(page, region, width);
    const more = page.getByText(es ? "La tabla se desplaza de costado: hay más columnas a la derecha." : "The table scrolls sideways: there are more columns to the right.", { exact: true });
    if (width >= 1024) {
      // At the 75 % desktop scale every column fits at 1440: a table that fits has no hint.
      expect(await region.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(false);
      await expect(more).toHaveCount(0);
    } else {
      expect(await region.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
      // Columns left to see on the right are announced above the table; at its end the text hides without moving the table.
      await expect(more).toBeVisible(); await contained(page, more, width);
      const top = (await region.boundingBox())!.y;
      await region.evaluate(node => { node.scrollLeft = node.scrollWidth; });
      expect(await region.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
      await expect(more).toBeHidden();
      expect((await region.boundingBox())!.y).toBe(top);
      await region.evaluate(node => { node.scrollLeft = 0; });
      await expect(more).toBeVisible();
    }
    const menu = page.getByRole("button", { name: es ? "Columnas" : "Columns", exact: true });
    await menu.click(); await page.getByRole("menuitemcheckbox", { name: "CUIT", exact: true }).click();
    await expect(page.getByRole("columnheader", { name: "CUIT", exact: true })).toHaveCount(0);
    await page.getByRole("menuitemcheckbox", { name: "CUIT", exact: true }).click(); await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();
    await expect(page.getByRole("columnheader", { name: "CUIT", exact: true })).toBeVisible();
    const edit = page.getByRole("button", { name: es ? "Editar Frío Sur S.A." : "Edit Frío Sur S.A.", exact: true });
    if (width < 640) await edit.click();
    const payment = page.getByRole("textbox", { name: width < 640 ? term : (es ? "Fila 1 · " : "Row 1 · ") + term, exact: true });
    // On the phone the option editor gives each typed field its type and range.
    if (width < 640) await expect(payment).toHaveAccessibleDescription(es ? "Entero, de 0 a 180." : "Whole number, from 0 to 180.");
    await payment.fill(es ? "treinta" : "thirty"); await expect(payment).toHaveAttribute("aria-invalid", "true");
    // Beside the title goes only the catalog's state, never «Cambios sin guardar»: an enabled Save says there are changes.
    const header = page.locator("header").filter({ has: page.getByRole("heading", { level: 1 }) });
    await expect(header).toContainText(es ? "Activo" : "Active");
    await expect(header).not.toContainText(es ? "Cambios sin guardar" : "Unsaved changes");
    // The value and its reason; in the table, on a line under the row that names the row and the field. On the phone the
    // read-only table above also marks its cell, so the editor's control is what says it.
    const problem = es ? "«treinta» no es un número entero." : "“thirty” is not a whole number.";
    if (width < 640) await expect(payment).toHaveAccessibleDescription(problem);
    else await expect(page.getByText((es ? "Fila 1 · " : "Row 1 · ") + term + ": " + problem, { exact: true })).toBeVisible();
    await payment.scrollIntoViewIfNeeded(); await contained(page, payment, width);
    await page.screenshot({ path: info.outputPath("ce2-invalid-typed-value.png"), fullPage: true });
    // Save stays enabled: trying it writes nothing, keeps the mark and opens the option (on 640 and wider, under its row).
    await page.getByRole("button", { name: es ? "Guardar" : "Save", exact: true }).click();
    await noWrites(page); await expect(payment).toHaveAttribute("aria-invalid", "true");
    await payment.fill("45"); await expect(payment).not.toHaveAttribute("aria-invalid", "true");
    await page.getByRole("button", { name: es ? "Listo" : "Done", exact: true }).click(); await expect(edit).toBeFocused();
    await page.screenshot({ path: info.outputPath("ce2-table-contained.png"), fullPage: true });
    await noWrites(page);
  });
  test("CE2 catalog cell list is not clipped by the wide table " + language + " " + width, async ({ page }, info) => {
    const es = language === "es", north = es ? "Norte" : "North";
    await page.setViewportSize({ width, height: 900 }); await open(page, language);
    const region = page.locator(`[data-slot="table-container"][role="region"][aria-label="${es ? "Opciones" : "Options"}"]`);
    if (width < 640) await page.getByRole("button", { name: es ? "Editar Compresores Unidos" : "Edit Compresores Unidos", exact: true }).click();
    const zone = page.getByRole("combobox", { name: width < 640 ? (es ? "Zona" : "Zone") : (es ? "Fila 6 · Zona" : "Row 6 · Zone"), exact: true });
    await zone.scrollIntoViewIfNeeded(); await zone.click();
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
    // Each field is chosen in the modal, and «Quitar campo» opens the confirmation over it.
    const fields = await openFields(page, es);
    const remove = async (name: string) => {
      await fields.getByRole("button", { name: (es ? "Editar " : "Edit ") + name, exact: true }).click();
      await fields.getByRole("button", { name: es ? "Quitar campo" : "Remove this field", exact: true }).click();
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
    // «Quitar campo» was clicked where the confirmation now shows its link: the pointer leaves so the link is drawn at rest.
    await page.mouse.move(0, 0);
    await page.screenshot({ path: info.outputPath("ce1-field-in-use.png"), fullPage: true });
    await expect(zone).toHaveScreenshot(`catalog-field-in-use-${language}-${width}.png`);
    // Esc closes only the confirmation; on the phone the field goes back to the list.
    const close = async () => {
      await page.keyboard.press("Escape");
      if (width < 640) await fields.getByRole("button", { name: es ? "Volver a la lista" : "Back to the list", exact: true }).click();
    };
    await close();
    // A use left only in the active version says so.
    const term = await remove(es ? "Plazo de pago (días)" : "Payment term (days)");
    await expect(term.getByRole("listitem")).toContainText(es ? `«${question}» en ${form}, en la versión activa` : `“${question}” in ${form}, in the active version`);
    await expect(term.getByRole("listitem")).not.toContainText(es ? "borrador" : "draft");
    await close();
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
