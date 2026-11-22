import { expect, test } from "@playwright/test";
import { visualCatalogId } from "./catalogFixtures";

// «Ordenar por…» (OR1-A): the dialog, the pending notice and the PUT with `sort`, in both languages and three widths.
for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test("Manual catalog sort " + language + " " + width, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const english = language === "en";
    await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen: "/catalogos/" + visualCatalogId, lang: language, scenario: "catalogs-manage" }));
    await page.getByRole("heading", { name: english ? "Customers" : "Clientes", exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    const options = page.getByRole("region", { name: english ? "Options" : "Opciones", exact: true }).and(page.locator("section"));
    const more = options.getByRole("button", { name: english ? "More option actions" : "Más acciones de opciones", exact: true });
    await more.click();
    await page.getByRole("menuitem", { name: english ? "Sort by…" : "Ordenar por…" }).click();
    const dialog = page.getByRole("dialog", { name: english ? "Sort the options" : "Ordenar las opciones" });
    // The direction is the shared piece to choose (2026-11-22): its button says «Orden» and the chosen one.
    const order = dialog.getByRole("button", { name: english ? /^Order / : /^Orden / });
    await expect(order).toHaveAccessibleName(english ? "Order A to Z" : "Orden De la A a la Z");
    await dialog.getByRole("button", { name: english ? "Column Text" : "Columna Texto", exact: true }).click();
    await page.getByRole("option", { name: english ? "Code" : "Código", exact: true }).click();
    await order.click();
    await page.getByRole("option", { name: english ? "Z to A" : "De la Z a la A", exact: true }).click();
    await page.screenshot({ path: info.outputPath("manual-sort-dialog.png") });
    await dialog.getByRole("button", { name: english ? "Sort" : "Ordenar", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(more).toBeFocused();
    const pending = page.getByRole("status").filter({ hasText: english ? "It will be sorted by “Code”, Z to A, when saved." : "Se ordenará por «Código», de la Z a la A, al guardar." });
    await expect(pending).toBeVisible();
    await expect(page.getByRole("button", { name: english ? "Move Pérez down" : "Bajar Pérez", exact: true })).toBeDisabled();
    await page.screenshot({ path: info.outputPath("manual-sort-pending.png"), fullPage: true });
    expect(await page.evaluate(() => (globalThis as unknown as { catalogsFixture: { writes: unknown[] } }).catalogsFixture.writes.length)).toBe(0);
    await page.getByRole("button", { name: english ? "Save" : "Guardar", exact: true }).click();
    await expect(pending).toHaveCount(0);
    const bodies = await page.evaluate(() => (globalThis as unknown as { catalogsFixture: { writes: { body: Record<string, unknown> }[] } }).catalogsFixture.writes.map(write => write.body));
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({ sort: { column: "code", descending: true } });
    expect(bodies[0]).not.toHaveProperty("moves");
  });
}
