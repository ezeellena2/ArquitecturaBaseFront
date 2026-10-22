import { expect, test, type Page } from "@playwright/test";
import { visualCatalogId } from "./catalogFixtures";

const fixture = (page: Page) => page.evaluate(() => (window as typeof window & {
  catalogsFixture: { writes: unknown[]; previews: { mode: string; expectedRevision: number; bytes: number }[]; applies: unknown[] };
}).catalogsFixture);
async function enter(page: Page, language: "es" | "en", scenario: string, query = "") {
  await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen: "/catalogos/" + visualCatalogId + query, lang: language, scenario }));
  await expect(page.getByRole("heading", { name: language === "en" ? "Customers" : "Clientes", exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
async function contained(page: Page, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}
async function importAction(page: Page, en: boolean, width: number, source: "file" | "paste") {
  const name = source === "file" ? en ? "Import" : "Importar" : en ? "Paste from Excel" : "Pegar de Excel";
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
    if (width >= 640) {
      await expect(page.getByRole("textbox", { name: label("Texto de la opción 1", "Option 1 text"), exact: true })).toHaveValue("Pérez");
      await expect(page.getByRole("textbox", { name: label("Código de la opción 1", "Option 1 code"), exact: true })).toHaveValue("C1");
      await expect(page.getByText("5/30", { exact: true }).first()).toBeVisible();
    } else {
      expect(await table.evaluate(node => node.scrollWidth)).toBeGreaterThan(await table.evaluate(node => node.clientWidth));
      await page.getByRole("button", { name: label("Editar Pérez", "Edit Pérez"), exact: true }).click();
      const text = page.getByRole("textbox", { name: label("Texto", "Text"), exact: true });
      await expect(text).toHaveValue("Pérez"); await text.scrollIntoViewIfNeeded();
      const box = (await text.boundingBox())!; expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width);
      await page.getByRole("button", { name: label("Listo", "Done"), exact: true }).click();
      await expect(page.getByRole("button", { name: label("Editar Pérez", "Edit Pérez"), exact: true })).toBeFocused();
    }
    await contained(page, width);
    await page.screenshot({ path: info.outputPath("catalog-options-editor.png"), fullPage: true });
    // Content starts in original Spanish even when the surrounding UI is English.
    const preview = page.getByRole("region", { name: label("Así lo ve el empleado", "How the employee sees it"), exact: true });
    await expect(preview.getByRole("radio")).toHaveCount(0);
    await preview.getByRole("button", { name: "Elegí una opción", exact: true }).click();
    await expect(preview.getByRole("radio")).toHaveCount(3);
    await preview.getByRole("radio", { name: "Pérez", exact: true }).click();
    await expect(preview.getByRole("radio")).toHaveCount(0);
    await expect(preview.getByRole("button", { name: "Pérez", exact: true })).toBeVisible();
    await preview.getByRole("button", { name: label("Varias", "Multiple"), exact: true }).click();
    await expect(preview.getByText("Elegí hasta 3", { exact: true })).toBeVisible();
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
}
