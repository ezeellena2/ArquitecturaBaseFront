import { expect, test } from "@playwright/test";
import { responseFormId } from "../responseFixtures";
import type { createResponseVisualFixtures } from "./responseFixtures";

// Chosen CE5 through real routes; transport is synthetic and does not qualify Meta or persistence.
for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test("CE5 captured catalog fields and visible export " + language + " " + width, async ({ page }, info) => {
    const label = (es: string, en: string) => language === "es" ? es : en;
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen: "/formularios/" + responseFormId + "/respuestas", scenario: "responses-catalog-fields", lang: language }));
    await expect(page.getByRole("heading", { name: label("Pedir repuesto", "Request a spare part"), level: 1, exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    if (width < 768) {
      const navigation = page.getByRole("button", { name: label("Menú de navegación", "Navigation menu"), exact: true });
      if (await navigation.getAttribute("aria-expanded") === "true") await navigation.click();
    }
    const question = label("Proveedores a consultar", "Suppliers to contact");
    const zone = label("Zona", "Zone");
    const table = page.getByRole("table");
    await expect(table.getByRole("columnheader", { name: question + " · CUIT", exact: true })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: question + " · " + zone, exact: true })).toHaveCount(0);
    await expect(table.getByText("30-71234567-8, 30-65432109-7", { exact: true })).toBeVisible();
    await expect(table.getByText(label("30, Contado", "30, Cash"), { exact: true })).toBeVisible();
    const extraHeader = table.getByRole("columnheader", { name: question + " · CUIT", exact: true });
    await expect(extraHeader.getByRole("button")).toHaveCount(0);
    const tableContainer = page.locator('[data-slot="table-container"]').first();
    const box = (await tableContainer.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    if (width < 640) expect(await tableContainer.evaluate(node => node.scrollWidth)).toBeGreaterThan(await tableContainer.evaluate(node => node.clientWidth));
    await extraHeader.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("ce5-default-data-fields.png"), fullPage: true });

    const columns = page.getByRole("button", { name: label("Columnas", "Columns"), exact: true });
    await columns.focus(); await columns.press("Enter");
    await page.getByRole("menuitemcheckbox", { name: zone + " · " + label("filtro", "filter"), exact: true }).click();
    await page.getByRole("menuitemcheckbox", { name: question, exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(columns).toBeFocused();
    await expect(table.getByRole("columnheader", { name: question, exact: true })).toHaveCount(0);
    await expect(table.getByRole("columnheader", { name: question + " · " + zone, exact: true })).toBeVisible();
    await expect(table.getByText(label("Centro, Centro", "Center, Center"), { exact: true })).toBeVisible();
    await table.getByRole("columnheader", { name: question + " · " + zone, exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("ce5-filter-field-visible.png"), fullPage: true });
    const exportButton = page.getByRole("button", { name: label("Exportar a Excel", "Export to Excel"), exact: true });
    await exportButton.click();
    const dialog = page.getByRole("dialog", { name: label("Exportar respuestas a Excel", "Export responses to Excel"), exact: true });
    await dialog.getByRole("radio", { name: new RegExp(label("^Solo las visibles", "^Visible only")) }).click();
    const download = page.waitForEvent("download");
    await dialog.getByRole("button", { name: label("Exportar a Excel", "Export to Excel"), exact: true }).click();
    expect((await download).suggestedFilename()).toBe("E2.xlsx");
    await expect.poll(async () => page.evaluate(() => (globalThis as typeof globalThis & { responseFixtures: ReturnType<typeof createResponseVisualFixtures> }).responseFixtures.exports.length)).toBe(1);
    const exported = await page.evaluate(() => (globalThis as typeof globalThis & { responseFixtures: ReturnType<typeof createResponseVisualFixtures> }).responseFixtures.exports[0]);
    expect(exported).toMatchObject({ catalogFields: [
      { questionId: "0199a0c0-0000-7000-8000-000000000034", fieldId: "0199a0c0-0000-7000-8000-000000000301" },
      { questionId: "0199a0c0-0000-7000-8000-000000000034", fieldId: "0199a0c0-0000-7000-8000-000000000302" },
      { questionId: "0199a0c0-0000-7000-8000-000000000034", fieldId: "0199a0c0-0000-7000-8000-000000000303" },
    ] });
    expect((exported as { columns: string[] }).columns).not.toContain("0199a0c0-0000-7000-8000-000000000034");
    await tableContainer.evaluate(node => { node.scrollLeft = 0; });
    await page.getByRole("link", { name: "TEST-000002", exact: true }).click();
    const detail = page.getByRole("region", { name: label(width < 640 ? "Respuesta" : "Detalle de la respuesta", width < 640 ? "Response" : "Response details"), exact: true });
    await expect(detail.getByText("30-71234567-8", { exact: true })).toBeVisible();
    await expect(detail.getByText(zone, { exact: true })).toHaveCount(2);
    await expect(detail.getByText(label("Contado", "Cash"), { exact: true })).toBeVisible();
    await expect(detail.getByText(label("Plazo anterior", "Previous terms"), { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    await page.screenshot({ path: info.outputPath("ce5-captured-detail.png"), fullPage: true });
  });
}
