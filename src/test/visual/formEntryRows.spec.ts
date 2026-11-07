import { expect, test, type Page } from "@playwright/test";
import { responseFormId } from "../responseFixtures";
import { formEntryFixtureIds } from "./formEntryFixtures";
import { expectColumnLines, expectRightAligned } from "./tableColumns";

// Evidence of loading the items of a block (RG2-A), without goldens: each capture is compared with its board.
type Language = "es" | "en";
const text = (language: Language, es: string, en: string) => language === "es" ? es : en;
async function open(page: Page, language: Language, width: number, screen: string, scenario: string) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen, scenario, lang: language }));
}
async function closeMenu(page: Page, language: Language, width: number) {
  if (width >= 768) return;
  const menu = page.getByRole("button", { name: text(language, "Menú de navegación", "Navigation menu"), exact: true });
  if (await menu.getAttribute("aria-expanded") === "true") await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
}
const noPageScroll = async (page: Page, width: number) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test("RG2-A the items on the page " + language + " " + width, async ({ page }) => {
    await open(page, language, width, "/formularios/" + formEntryFixtureIds.sowing + "/cargar", "entries-rows");
    await expect(page.getByRole("heading", { name: text(language, "Nueva respuesta", "New response"), level: 1 })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await closeMenu(page, language, width);
    const add = page.getByRole("button", { name: text(language, "Agregar ítem", "Add item"), exact: true });
    await add.click();
    if (width >= 640) {
      // On the computer the block is a table across «Datos»: a row per item, the line between columns and the numbers to the right.
      const table = page.getByRole("region", { name: text(language, "Artículos", "Articles"), exact: true });
      await expect(table.getByRole("row")).toHaveCount(3);
      await expect(page.getByRole("combobox", { name: text(language, "Ítem 2 · Artículo", "Item 2 · Article"), exact: true })).toBeFocused();
      await expectColumnLines(table.locator("table"));
      await expectRightAligned(table.getByRole("columnheader", { name: text(language, "Cantidad", "Quantity"), exact: true }));
      await page.screenshot({ path: "test-results/rg2-entry-table-" + language + "-" + width + ".png", fullPage: true });
      await page.getByRole("button", { name: text(language, "Enviar", "Send"), exact: true }).click();
      await expect(table.getByText(text(language, "Cantidad: completá esta respuesta.", "Quantity: fill in this answer."), { exact: true })).toHaveCount(2);
      // The first problem in the order of the form takes the focus: «Proveedor», above the block, is still empty.
      await expect(page.getByRole("textbox", { name: text(language, "Proveedor", "Supplier"), exact: true })).toBeFocused();
    } else {
      // On the phone each item goes in its box, «Agregar ítem» at the foot of the boxes and Enviar fixed below.
      const second = page.getByRole("region", { name: text(language, "Ítem 2", "Item 2"), exact: true });
      await expect(second).toBeVisible();
      await expect(page.getByRole("region", { name: text(language, "Artículos", "Articles"), exact: true })).toHaveCount(0);
      await page.screenshot({ path: "test-results/rg2-entry-boxes-" + language + "-" + width + ".png", fullPage: true });
      await page.getByRole("button", { name: text(language, "Enviar", "Send"), exact: true }).click();
      await expect(second.getByText(text(language, "Completá esta respuesta.", "Fill in this answer."), { exact: true }).first()).toBeVisible();
    }
    await noPageScroll(page, width);
    await page.screenshot({ path: "test-results/rg2-entry-errors-" + language + "-" + width + ".png", fullPage: true });
  });
}

for (const language of ["es", "en"] as const) {
  test("RG2-A the items next to the sheet " + language, async ({ page }) => {
    await open(page, language, 1440, "/formularios/" + responseFormId + "/respuestas", "responses-app-rows");
    await expect(page.getByRole("link", { name: "TEST-000002", exact: true })).toBeVisible();
    await page.getByRole("button", { name: text(language, "Agregar respuesta", "Add response"), exact: true }).click();
    const panel = page.getByRole("region", { name: text(language, "Nueva respuesta de Recepción de insumos", "New response to Supplies reception") });
    const first = panel.getByRole("region", { name: text(language, "Ítem 1", "Item 1"), exact: true });
    await expect(first).toBeVisible();
    // The panel is one column: the items in boxes, with the number as narrow as in a loose question (CW12).
    const rem = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    expect((await first.getByLabel(text(language, "Cantidad", "Quantity")).boundingBox())!.width).toBeLessThanOrEqual(37.5 / 4 * rem + 1);
    await page.evaluate(() => document.fonts.ready);
    await noPageScroll(page, 1440);
    await page.screenshot({ path: "test-results/rg2-entry-panel-" + language + "-1440.png" });
  });
}
