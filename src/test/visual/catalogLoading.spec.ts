import { expect, test, type Page } from "@playwright/test";
import { visualCatalogId } from "./catalogFixtures";

const fixture = (page: Page) => page.evaluate(() => (window as typeof window & {
  catalogsFixture: { writes: unknown[]; previews: { mode: string; expectedRevision: number; bytes: number }[]; applies: unknown[] };
}).catalogsFixture);
async function enter(page: Page, language: "es" | "en", scenario: string, query = "") {
  await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen: "/catalogos/" + visualCatalogId + query, lang: language, scenario }));
  const typed = scenario === "catalogs-import-typed";
  await expect(page.getByRole("heading", { name: typed ? language === "en" ? "Zone surcharge" : "Recargo por zona" : language === "en" ? "Customers" : "Clientes", exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
async function contained(page: Page, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}
async function importAction(page: Page, en: boolean, width: number, source: "file" | "paste") {
  const name = source === "file" ? en ? "Import" : "Importar" : en ? "Paste from Excel" : "Pegar desde Excel";
  if (width < 640) {
    await page.getByRole("button", { name: en ? "More option actions" : "Más acciones de opciones", exact: true }).click();
    await page.getByRole("menuitem", { name, exact: true }).click();
  } else await page.getByRole("button", { name, exact: true }).click();
}

// Evidence scenes only: real routes/components with an explicit simulated HTTP transport, no goldens.
for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test("CA1 inline options and page selection " + language + " " + width, async ({ page }, info) => {
    const en = language === "en", label = (es: string, english: string) => en ? english : es;
    await page.setViewportSize({ width, height: 900 });
    await enter(page, language, "catalogs-manage");
    const table = page.locator('[data-slot="table-container"]').first();
    const tableBox = (await table.boundingBox())!;
    expect(tableBox.x).toBeGreaterThanOrEqual(0); expect(tableBox.x + tableBox.width).toBeLessThanOrEqual(width);
    // The texts are edited in the menu language: with the menu in English, the Spanish options have no translation yet and
    // their original is the reference, never copied.
    if (width >= 640) {
      await expect(page.getByRole("textbox", { name: label("Texto de la opción 1", "Option 1 text"), exact: true })).toHaveValue(en ? "" : "Pérez");
      if (en) await expect(page.getByRole("textbox", { name: "Option 1 text", exact: true })).toHaveAttribute("placeholder", "Pérez");
      await expect(page.getByRole("textbox", { name: label("Código de la opción 1", "Option 1 code"), exact: true })).toHaveValue("C1");
      await expect(page.getByText(en ? "0/30" : "5/30", { exact: true }).first()).toBeVisible();
    } else {
      expect(await table.evaluate(node => node.scrollWidth)).toBeGreaterThan(await table.evaluate(node => node.clientWidth));
      await page.getByRole("button", { name: label("Editar Pérez", "Edit Pérez"), exact: true }).click();
      const text = page.getByRole("textbox", { name: label("Texto", "Text"), exact: true });
      await expect(text).toHaveValue(en ? "" : "Pérez"); await text.scrollIntoViewIfNeeded();
      if (en) await expect(text).toHaveAccessibleDescription("Original (Spanish): Pérez");
      const box = (await text.boundingBox())!; expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width);
      await page.getByRole("button", { name: label("Listo", "Done"), exact: true }).click();
      await expect(page.getByRole("button", { name: label("Editar Pérez", "Edit Pérez"), exact: true })).toBeFocused();
    }
    await contained(page, width);
    await page.screenshot({ path: info.outputPath("catalog-options-editor.png"), fullPage: true });
    // The preview is in the menu language; an option without a translation shows its original.
    const preview = page.getByRole("region", { name: label("Así lo ve el empleado", "How the employee sees it"), exact: true });
    await expect(preview.getByRole("radio")).toHaveCount(0);
    await preview.getByRole("button", { name: label("Elegí una opción", "Choose an option"), exact: true }).click();
    await expect(preview.getByRole("radio")).toHaveCount(3);
    await preview.getByRole("radio", { name: "Pérez", exact: true }).click();
    await expect(preview.getByRole("radio")).toHaveCount(0);
    await expect(preview.getByRole("button", { name: "Pérez", exact: true })).toBeVisible();
    await preview.getByRole("button", { name: label("Varias", "Multiple"), exact: true }).click();
    await expect(preview.getByText(label("Elegí hasta 3", "Choose up to 3"), { exact: true })).toBeVisible();
    for (const name of ["Pérez", "López", "Ríos"]) await preview.getByText(name, { exact: true }).click();
    await expect(preview.getByRole("checkbox", { checked: true })).toHaveCount(3);
    await preview.scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath("catalog-options-preview.png"), fullPage: true });
    expect((await fixture(page)).writes).toEqual([]);
    await enter(page, language, "catalogs-manage", "?pageSize=1");
    await page.getByRole("checkbox", { name: label("Seleccionar opciones de esta página", "Select options on this page"), exact: true }).check();
    const selected = page.getByText(label("1 seleccionada de esta página", "1 selected on this page"), { exact: true });
    await expect(selected).toBeVisible();
    await expect(selected.locator("..").getByRole("button", { name: label("Dar de baja", "Deactivate"), exact: true })).toBeEnabled();
    await page.getByRole("button", { name: label("Página siguiente", "Next page"), exact: true }).click();
    await expect(page.getByRole("checkbox", { name: label("Seleccionar López", "Select López"), exact: true })).not.toBeChecked();
    await expect(selected).toHaveCount(0);
    expect((await fixture(page)).writes).toEqual([]);
    await contained(page, width);
  });

  for (const source of ["file", "paste"] as const) test("CA2 import review " + source + " " + language + " " + width, async ({ page }, info) => {
    const en = language === "en", label = (es: string, english: string) => en ? english : es;
    await page.setViewportSize({ width, height: 900 }); await enter(page, language, "catalogs-import-review");
    await importAction(page, en, width, source);
    const dialog = page.getByRole("dialog", { name: label("Importar opciones a «Clientes»", "Import options into “Customers”"), exact: true });
    await expect(dialog).toBeVisible();
    if (source === "file") await dialog.getByLabel(label("Archivo", "File"), { exact: true }).setInputFiles({ name: "Clientes.csv", mimeType: "text/csv", buffer: Buffer.from("Código,Texto\nN,Norte\n") });
    else await dialog.getByRole("textbox", { name: label("Pegá las filas con encabezados", "Paste rows with headers"), exact: true }).fill("Código\tTexto\nN\tNorte\n");
    await dialog.getByRole("button", { name: label("Revisar", "Review"), exact: true }).click();
    await expect(dialog.getByRole("tab", { name: label("Errores y avisos", "Errors and warnings"), exact: true })).toHaveAttribute("aria-selected", "true");
    const received = await fixture(page);
    expect(received.previews).toHaveLength(1); expect(received.previews[0]).toMatchObject({ mode: source === "file" ? "Replace" : "Append", expectedRevision: 1 });
    expect(received.previews[0]!.bytes).toBeGreaterThan(0); expect(received.applies).toEqual([]); expect(received.writes).toEqual([]);
    await expect(dialog.getByRole("columnheader", { name: label("Fila", "Row"), exact: true })).toBeVisible();
    await expect(dialog.getByRole("columnheader", { name: label("Columna", "Column"), exact: true })).toBeVisible();
    await expect(dialog.getByRole("columnheader", { name: label("Tipo", "Type"), exact: true })).toBeVisible();
    await expect(dialog.getByRole("cell", { name: label("Responsable", "Supervisor"), exact: true })).toHaveCount(1);
    await expect(dialog.getByText(label("Fila 2", "Row 2"), { exact: true })).toHaveCount(24);
    await expect(dialog.getByText(label("Aviso", "Warning"), { exact: true })).toHaveCount(1);
    const apply = dialog.getByRole("button", { name: label("Aplicar sin las 24 filas con errores", "Apply without the 24 rows with errors"), exact: true });
    await expect(apply).toBeDisabled();
    await page.screenshot({ path: info.outputPath("catalog-import-counts-" + source + ".png"), fullPage: true });
    const geometry = await dialog.evaluate(node => {
      const box = node.getBoundingClientRect();
      const body = Array.from(node.children).find(child => getComputedStyle(child).overflowY === "auto") as HTMLElement;
      const footer = node.querySelector('[data-slot="dialog-footer"]')!;
      const initial = footer.getBoundingClientRect().top; body.scrollTop = body.scrollHeight;
      return { x: box.x, right: box.right, top: box.top, bottom: box.bottom, scroll: body.scrollTop, footerBefore: initial, footerAfter: footer.getBoundingClientRect().top };
    });
    expect(geometry.x).toBeGreaterThanOrEqual(0); expect(geometry.right).toBeLessThanOrEqual(width);
    expect(geometry.top).toBeGreaterThanOrEqual(0); expect(geometry.bottom).toBeLessThanOrEqual(900);
    expect(geometry.scroll).toBeGreaterThan(0); expect(geometry.footerAfter).toBe(geometry.footerBefore);
    if (width < 640) { expect(geometry.top).toBe(0); expect(geometry.bottom).toBe(900); }
    await page.screenshot({ path: info.outputPath("catalog-import-review-" + source + ".png"), fullPage: true });
    if (source === "file") await dialog.getByText(label("Sí, dar de baja 1 opción", "Yes, deactivate 1 option"), { exact: true }).click();
    else await expect(dialog.getByRole("checkbox", { name: /dar de baja|deactivate/ })).toHaveCount(0);
    await dialog.getByText(label("Sí, aplicar sin las filas con errores", "Yes, apply without the rows with errors"), { exact: true }).click();
    await expect(apply).toBeEnabled(); expect((await fixture(page)).applies).toEqual([]);
    await apply.click(); await expect(dialog).toHaveCount(0);
    expect((await fixture(page)).applies).toHaveLength(1);
    await contained(page, width);
  });

  test("CA2 typed values and diagnostics " + language + " " + width, async ({ page }, info) => {
    const en = language === "en", label = (es: string, english: string) => en ? english : es;
    await page.setViewportSize({ width, height: 900 }); await enter(page, language, "catalogs-import-typed");
    await importAction(page, en, width, "paste");
    const dialog = page.getByRole("dialog", { name: label("Importar opciones a «Recargo por zona»", "Import options into “Zone surcharge”"), exact: true });
    await expect(dialog.getByRole("heading")).toBeVisible();
    const overlappingTitleRects = await dialog.evaluate(node => {
      const range = document.createRange(); range.selectNodeContents(node.querySelector('[data-slot="dialog-title"]')!);
      const close = node.querySelector('[data-slot="dialog-close"]')!.getBoundingClientRect();
      return Array.from(range.getClientRects(), rect => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }))
        .filter(rect => rect.left < close.right && rect.right > close.left && rect.top < close.bottom && rect.bottom > close.top);
    });
    expect(overlappingTitleRects).toEqual([]);
    await dialog.getByRole("textbox", { name: label("Pegá las filas con encabezados", "Paste rows with headers"), exact: true }).fill("Code\tText\tValue\nN\tNorte\t1500.5\nC1\tGBA\t1500.5\n");
    await dialog.getByRole("button", { name: label("Revisar", "Review"), exact: true }).click();
    const apply = dialog.getByRole("button", { name: label("Aplicar sin las 24 filas con errores", "Apply without the 24 rows with errors"), exact: true });
    await expect(apply).toBeDisabled();
    await dialog.getByRole("tab", { name: label("Altas", "New"), exact: true }).click();
    await expect(dialog.getByRole("columnheader", { name: label("Valor", "Value"), exact: true })).toBeVisible();
    const addedValue = dialog.getByRole("cell", { name: label("1.500,5", "1,500.5"), exact: true });
    await addedValue.scrollIntoViewIfNeeded(); await expect(addedValue).toBeVisible();
    await page.screenshot({ path: info.outputPath("catalog-import-typed-added.png"), fullPage: true });
    await dialog.getByRole("tab", { name: label("Cambios", "Changes"), exact: true }).click();
    const changedValue = dialog.getByRole("cell", { name: label("Valor: 1.000 → 1.500,5", "Value: 1,000 → 1,500.5"), exact: true });
    await changedValue.scrollIntoViewIfNeeded(); await expect(changedValue).toBeVisible();
    await page.screenshot({ path: info.outputPath("catalog-import-typed-changed.png"), fullPage: true });
    await dialog.getByRole("tab", { name: label("Errores y avisos", "Errors and warnings"), exact: true }).click();
    await expect(dialog.getByRole("columnheader", { name: label("Tipo", "Type"), exact: true })).toBeVisible();
    const related = dialog.getByText(label("Fila 2", "Row 2"), { exact: true });
    await expect(related).toHaveCount(24); await related.first().scrollIntoViewIfNeeded();
    await expect(related.first()).toBeVisible();
    await expect(dialog.getByText("Error", { exact: true }).first()).toBeVisible();
    await page.screenshot({ path: info.outputPath("catalog-import-typed-error.png"), fullPage: true });
    const header = dialog.getByRole("cell", { name: label("Responsable", "Supervisor"), exact: true });
    await header.scrollIntoViewIfNeeded(); await expect(header).toBeVisible();
    await expect(dialog.getByText(label("Aviso", "Warning"), { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath("catalog-import-typed-warning.png"), fullPage: true });
    await contained(page, width);
    expect((await fixture(page)).applies).toEqual([]); expect((await fixture(page)).writes).toEqual([]);
  });
}
