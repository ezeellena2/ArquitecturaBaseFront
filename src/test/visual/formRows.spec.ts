import { expect, test, type Page } from "@playwright/test";
import { fixtureFormId } from "./formFixtures";

// Evidence of the block of rows in the editor (RG1-A, RG6-A, RG9-A), added with «Agregar bloque» (RG10-D) and with «ítem»
// in its texts (RG12-A), without goldens: each capture is compared with its board.
type Language = "es" | "en";
const text = (language: Language, es: string, en: string) => language === "es" ? es : en;
async function open(page: Page, language: Language, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen: "/formularios/" + fixtureFormId, scenario: "forms-rows", lang: language }));
}
async function closeMenu(page: Page, language: Language, width: number) {
  if (width >= 768) return;
  const menu = page.getByRole("button", { name: text(language, "Menú de navegación", "Navigation menu"), exact: true });
  if (await menu.getAttribute("aria-expanded") === "true") await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
}
const noPageScroll = async (page: Page, width: number) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test("RG1-A the block of rows in the editor " + language + " " + width, async ({ page }) => {
    await open(page, language, width);
    await expect(page.getByRole("heading", { name: text(language, "Registrar visita", "Register visit"), exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await closeMenu(page, language, width);
    // The block is one more item, with its questions numbered 3.1, 3.2… in its box.
    await expect(page.getByText(text(language, "Bloque · de 1 a 20 ítems · 3 preguntas", "Block · 1 to 20 items · 3 questions"), { exact: true })).toBeVisible();
    await expect(page.getByText(text(language, "Preguntas de cada ítem", "Questions for each item"), { exact: true })).toBeVisible();
    // RG10-D: «Agregar bloque» goes next to «Agregar pregunta», off with its reason while the form has a block.
    const addBlock = page.getByRole("button", { name: text(language, "Agregar bloque", "Add block"), exact: true });
    await expect(addBlock).toBeDisabled();
    await expect(addBlock).toHaveAccessibleDescription(text(language, "Ya hay un bloque.", "There is already a block."));
    await page.getByRole("button", { name: text(language, "Editar Artículos", "Edit Items"), exact: true }).click();
    const items = page.locator('[data-question-control="rows"]');
    await expect(items.getByText(text(language, "Ítems", "Items"), { exact: true })).toBeVisible();
    await expect(items.getByRole("spinbutton", { name: text(language, "Máximo", "Maximum"), exact: true })).toHaveValue("20");
    await noPageScroll(page, width);
    await page.screenshot({ path: "test-results/rg1-block-" + language + "-" + width + ".png", fullPage: true });
    // A question of the block: marked, and what an item does not hold off with its reason (RG9-A); the block is no type.
    await page.getByRole("button", { name: text(language, "Editar Cantidad", "Edit Quantity"), exact: true }).click();
    await expect(page.getByRole("checkbox", { name: text(language, "Se carga varias veces", "Loaded several times"), exact: true })).toBeChecked();
    await expect(page.getByRole("option", { name: text(language, "Foto · No se carga varias veces", "Photo · Not loaded several times"), exact: true })).toBeDisabled();
    await expect(page.getByRole("option", { name: /^(Bloque|Block|Renglones|Rows)\b/ })).toHaveCount(0);
    // With a question of the block open, the preview shows the WhatsApp screen of an item (beside the editor on a wide screen).
    if (width >= 1024) await expect(page.getByText(text(language, "Artículos · ítem 1", "Items · item 1"), { exact: true })).toBeVisible();
    await noPageScroll(page, width);
    await page.screenshot({ path: "test-results/rg6-row-question-" + language + "-" + width + ".png", fullPage: true });
    // RG10-D: without the block, «Agregar bloque» adds it at the end of the list as one more question, open, named «Bloque».
    await page.getByRole("button", { name: text(language, "Quitar Artículos", "Remove Items"), exact: true }).click();
    await page.getByRole("button", { name: text(language, "Quitar el bloque", "Remove the block"), exact: true }).click();
    await expect(addBlock).toBeEnabled();
    await addBlock.click();
    const added = page.locator("[data-question-local-id]").last();
    await expect(added.getByText(text(language, "Bloque · de 1 a 20 ítems · 0 preguntas", "Block · 1 to 20 items · 0 questions"), { exact: true })).toBeVisible();
    await expect(added.getByRole("textbox", { name: text(language, "Nombre", "Name"), exact: true })).toHaveValue(text(language, "Bloque", "Block"));
    await expect(added.getByRole("spinbutton", { name: text(language, "Mínimo", "Minimum"), exact: true })).toHaveValue("1");
    await expect(added.getByRole("spinbutton", { name: text(language, "Máximo", "Maximum"), exact: true })).toHaveValue("20");
    await expect(page.getByText(text(language, "Preguntas de cada ítem", "Questions for each item"), { exact: true })).toBeVisible();
    await expect(addBlock).toBeDisabled();
    await noPageScroll(page, width);
    await page.screenshot({ path: "test-results/rg10-new-block-" + language + "-" + width + ".png", fullPage: true });
  });
}
