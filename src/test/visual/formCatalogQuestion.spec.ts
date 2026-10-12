import { expect, test } from "@playwright/test";
import { fixtureFormId } from "./formFixtures";
import { visualCatalogId } from "./catalogFixtures";

// Production editor/routes with the existing simulated HTTP store; real persistence is checked separately.
for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test("Catalog question " + language + " " + width, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 }); const english = language === "en";
    const label = (es: string, en: string) => english ? en : es;
    const enter = async (scenario = "forms-catalog") => {
      await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen: "/formularios/" + fixtureFormId, lang: language, scenario }));
      await page.getByRole("heading", { name: label("Registrar visita", "Register visit"), exact: true }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      if (width < 768) { const menu = page.getByRole("button", { name: label("Menú de navegación", "Navigation menu"), exact: true }); if (await menu.getAttribute("aria-expanded") === "true") await menu.click(); await expect(menu).toHaveAttribute("aria-expanded", "false"); }
      await page.getByRole("button", { name: scenario === "forms-catalog-read" ? label("Ver pregunta Cliente", "View question Customer") : label("Editar Cliente", "Edit Customer"), exact: true }).click();
    };
    const geometry = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await enter(); const catalog = page.getByRole("combobox", { name: label("Catálogo", "Catalog"), exact: true });
    await expect(catalog).toHaveValue(visualCatalogId);
    await expect(page.getByRole("option", { name: new RegExp(label("Responsables de obra", "Site managers")) })).toBeDisabled();
    await expect(page.getByRole("option", { name: new RegExp(label("Archivados", "Archived")) })).toBeDisabled();
    const preview = page.getByRole("region", { name: label("Vista previa", "Preview"), exact: true });
    await expect(preview.getByRole("combobox", { name: label("Cliente", "Customer"), exact: true })).toBeDisabled();
    await expect(preview.getByRole("option")).toHaveCount(1);
    await page.getByRole("button", { name: label("Página siguiente", "Next page"), exact: true }).click();
    await expect(page.getByText(label("Página 2 de 2", "Page 2 of 2"), { exact: true })).toBeVisible();
    await expect(catalog).toHaveValue(visualCatalogId);
    await page.getByRole("searchbox", { name: label("Buscar catálogo", "Search catalogs"), exact: true }).fill(label("Supervisores activos", "Active supervisors"));
    await expect(page.getByText(label("Página 1 de 1", "Page 1 of 1"), { exact: true })).toBeVisible();
    await catalog.scrollIntoViewIfNeeded(); await geometry();
    expect(await page.locator("[data-question-local-id]").first().evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    const catalogBox = await catalog.boundingBox(); expect(catalogBox).not.toBeNull(); expect(catalogBox!.x).toBeGreaterThanOrEqual(0); expect(catalogBox!.x + catalogBox!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: info.outputPath("catalog-selector.png"), fullPage: true });
    const filtersId = "01990000-0000-7000-8000-000000000081";
    await catalog.focus(); await catalog.selectOption(filtersId);
    const dialog = page.getByRole("dialog", { name: label("¿Cambiar el catálogo?", "Change the catalog?"), exact: true });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape"); await expect(dialog).toBeHidden(); await expect(catalog).toBeFocused(); await expect(catalog).toHaveValue(visualCatalogId);
    await catalog.selectOption(filtersId); await expect(dialog).toBeVisible();
    await page.screenshot({ path: info.outputPath("catalog-replace.png"), fullPage: true });
    await dialog.getByRole("button", { name: label("Cambiar catálogo", "Change catalog"), exact: true }).click();
    await expect(page.locator("[data-question-control=label]").first()).toBeFocused();
    await page.getByRole("button", { name: label("Guardar borrador", "Save draft"), exact: true }).click();
    await expect(page.getByText(label("Guardamos el borrador de Registrar visita.", "Saved the draft of Register visit."), { exact: true })).toBeVisible();
    const body = await page.evaluate(() => (globalThis as unknown as { formsFixture: { writes: { draft: { fields: { type: string; source?: { catalog: string }; options?: unknown; fieldId: string | null; replacesFieldId: string | null }[] } }[] } }).formsFixture.writes.at(-1)!);
    expect(body.draft.fields[0]!.source?.catalog).toBe(filtersId); expect(body.draft.fields[0]!.options == null).toBe(true);
    expect(body.draft.fields[0]!.fieldId).toBeNull(); expect(body.draft.fields[0]!.replacesFieldId).not.toBeNull();
    await page.locator('main a[href="/formularios"]').first().click();
    await page.getByRole("heading", { name: label("Diseñar formularios", "Design forms"), exact: true }).waitFor();
    await page.getByRole("table").getByRole("link", { name: label("Registrar visita", "Register visit"), exact: true }).click();
    await page.getByRole("heading", { name: label("Registrar visita", "Register visit"), exact: true }).waitFor();
    await page.getByRole("button", { name: label("Editar Cliente", "Edit Customer"), exact: true }).click();
    await expect(catalog).toHaveValue(filtersId); await catalog.scrollIntoViewIfNeeded(); await geometry(); await page.screenshot({ path: info.outputPath("catalog-saved.png"), fullPage: true });
    const calls = await page.evaluate(() => (globalThis as unknown as { catalogsFixture: { calls: { path: string }[] } }).catalogsFixture.calls);
    expect(calls.some(call => call.path.includes("catalog-previews") || call.path.endsWith("/items") || call.path.includes("catalog-filter-options"))).toBe(false);
  });
  test("Catalog question permissions " + language + " " + width, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 }); const english = language === "en";
    const label = (es: string, en: string) => english ? en : es;
    const enter = async (scenario = "forms-catalog") => {
      await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen: "/formularios/" + fixtureFormId, lang: language, scenario }));
      await page.getByRole("heading", { name: label("Registrar visita", "Register visit"), exact: true }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      if (width < 768) { const menu = page.getByRole("button", { name: label("Menú de navegación", "Navigation menu"), exact: true }); if (await menu.getAttribute("aria-expanded") === "true") await menu.click(); await expect(menu).toHaveAttribute("aria-expanded", "false"); }
      await page.getByRole("button", { name: scenario === "forms-catalog-read" ? label("Ver pregunta Cliente", "View question Customer") : label("Editar Cliente", "Edit Customer"), exact: true }).click();
    };
    const geometry = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await enter("forms-catalog-read"); const catalog = page.getByRole("combobox", { name: label("Catálogo", "Catalog"), exact: true });
    await expect(catalog).toBeDisabled(); await expect(page.getByRole("button", { name: label("Guardar borrador", "Save draft"), exact: true })).toHaveCount(0);
    await catalog.scrollIntoViewIfNeeded(); await geometry(); await page.screenshot({ path: info.outputPath("catalog-read.png"), fullPage: true });
    await enter("forms-catalog-no-read");
    await expect(catalog).toBeDisabled(); await expect(page.getByText(label("Necesitás permiso para leer catálogos y elegir uno.", "You need permission to read catalogs and choose one."), { exact: true })).toBeVisible();
    await catalog.scrollIntoViewIfNeeded(); await geometry(); await page.screenshot({ path: info.outputPath("catalog-no-read.png"), fullPage: true });
    expect(await page.evaluate(() => (globalThis as unknown as { catalogsFixture: { calls: unknown[] } }).catalogsFixture.calls.length)).toBe(0);
  });
}
