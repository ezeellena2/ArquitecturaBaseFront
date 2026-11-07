import { expect, test } from "@playwright/test";
import { expectColumnLines, expectRightAligned } from "./tableColumns";

// RG2-A in the UI catalog: the table of items (empty, at the maximum and with errors) and its version in boxes. Evidence
// es/en at 1440, 390 and 320 px, without golden: the captures go to test-results to compare them with the board.
for (const lang of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test(`table of items and its boxes ${lang} at ${width}px`, async ({ page }) => {
    const es = lang === "es";
    // Tall enough for the two boxes in one column, so their capture is whole.
    await page.setViewportSize({ width, height: 1800 });
    await page.goto(`/src/test/visual/index.html?screen=/catalogo&scenario=item-table&lang=${lang}`);
    const variants = es
      ? { empty: "Ítems · vacía", full: "Ítems · con el máximo", errors: "Ítems · con errores", cards: "Ítems · en una columna" }
      : { empty: "Items · empty", full: "Items · at the maximum", errors: "Items · with errors", cards: "Items · in one column" };
    const errors = page.getByRole("region", { name: variants.errors, exact: true });
    await errors.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);

    // Every table draws the line between columns and takes its numbers to the right, the item's included.
    const table = errors.getByRole("region", { name: es ? "Artículos" : "Articles", exact: true });
    await expectColumnLines(table.locator("table"));
    await expectRightAligned(table.getByRole("cell", { name: "1", exact: true }));
    await expectRightAligned(table.getByRole("columnheader", { name: es ? "Cantidad" : "Quantity", exact: true }));
    // The problem of a cell goes under its row, with the name of its question.
    await expect(errors.getByText(es ? "Cantidad: completá esta respuesta." : "Quantity: complete this answer.", { exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: variants.cards, exact: true }).getByRole("heading", { name: es ? "Ítem 2" : "Item 2", exact: true })).toBeVisible();
    // A table that does not fit scrolls sideways inside its box, never the page.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

    for (const [key, name] of Object.entries(variants)) {
      const region = page.getByRole("region", { name, exact: true });
      await region.scrollIntoViewIfNeeded();
      await region.screenshot({ path: `test-results/item-table-${key}-${lang}-${width}.png` });
    }
  });
}
