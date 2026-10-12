import { expect, test } from "@playwright/test";

for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test("catalog component composition " + language + " at " + width + "px", async ({ page }) => {
    const es = language === "es";
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/src/test/visual/index.html?screen=/formularios/catalogos-preview&lang=" + language);
    // Independent component-simulation setup, before testing the origin/editor interactions.
    await page.getByRole("heading", { name: es ? "Catálogos · componentes simulados" : "Catalogs · simulated components", exact: true }).waitFor({ state: "visible" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: "test-results/catalog-list-" + language + "-" + width + ".png" });
    const create = page.getByRole("button", { name: es ? "Nuevo catálogo" : "New catalog", exact: true });
    await create.click();
    const dialog = page.getByRole("dialog", { name: es ? "Nuevo catálogo" : "New catalog" });
    const manual = dialog.getByRole("radio", { name: es ? "Escribirlas a mano" : "Write them manually" });
    await manual.focus();
    await page.keyboard.down("ArrowDown");
    await expect(dialog.getByRole("radio", { name: es ? "Tomarlas de la base, con filtros" : "Use database options with filters" })).toBeChecked();
    await page.keyboard.up("ArrowDown");
    await expect(dialog.getByRole("radio", { name: es ? "Escribir una consulta" : "Write a query" })).toHaveCount(0);
    await dialog.screenshot({ path: "test-results/catalog-origin-" + language + "-" + width + ".png" });
    await page.keyboard.press("Escape");
    await expect(create).toBeFocused();
    await create.click();
    await page.getByRole("dialog").getByRole("button", { name: es ? "Continuar" : "Continue" }).click();
    await page.getByRole("button", { name: es ? "Editar Pérez Hnos." : "Edit Pérez Hnos.", exact: true }).click();
    const text = page.getByRole("textbox", { name: es ? "Texto" : "Text", exact: true });
    await expect(text).toBeFocused();
    await expect(text).toHaveValue(es ? "Pérez Hnos." : "");
    await text.scrollIntoViewIfNeeded();
    const box = await text.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: "test-results/catalog-manual-" + language + "-" + width + ".png" });
    await page.getByRole("button", { name: es ? "Listo" : "Done", exact: true }).click();
    await expect(page.getByRole("button", { name: es ? "Editar Pérez Hnos." : "Edit Pérez Hnos.", exact: true })).toBeFocused();
    await page.getByRole("button", { name: es ? "Usuarios, con filtros" : "Users with filters", exact: true }).click();
    const column = page.getByRole("combobox", { name: es ? "Texto de cada opción" : "Option text", exact: true });
    await column.selectOption("role");
    await expect(column).toHaveValue("role");
    const exclude = page.getByRole("checkbox", { name: es ? "Sin incluir a quien lo recibe" : "Exclude the recipient" });
    await exclude.focus();
    await page.keyboard.press("Space");
    await expect(exclude).not.toBeChecked();
    await column.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/catalog-filters-" + language + "-" + width + ".png" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
