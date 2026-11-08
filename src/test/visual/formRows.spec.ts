import { expect, test, type Locator, type Page } from "@playwright/test";
import { fixtureFormId, rowsCheckDefinition, type RowsCheckScenario } from "./formFixtures";

// Evidence of the block of rows in the editor (RG1-A, RG6-A, RG9-A), added with «Agregar bloque» (RG10-D) and with «ítem»
// in its texts (RG12-A), without goldens: each capture is compared with its board.
type Language = "es" | "en";
const text = (language: Language, es: string, en: string) => language === "es" ? es : en;
async function open(page: Page, language: Language, width: number, scenario = "forms-rows", id = fixtureFormId) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen: "/formularios/" + id, scenario, lang: language }));
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

// RG13-A: with a channel, a minimum of items that WhatsApp does not load stops publishing, with the limit and the minimum.
for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test("RG13-A the minimum that WhatsApp does not load stops publishing " + language + " " + width, async ({ page }) => {
    await open(page, language, width, "forms-publication-rows-minimum");
    await expect(page.getByRole("heading", { name: text(language, "Registrar visita", "Register visit"), exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await closeMenu(page, language, width);
    await page.getByRole("button", { name: text(language, "Publicar en WhatsApp", "Publish on WhatsApp"), exact: true }).click();
    const dialog = page.getByRole("dialog", { name: text(language, "Publicar la versión 1 en WhatsApp", "Publish version 1 on WhatsApp"), exact: true });
    const problems = dialog.getByRole("region", { name: text(language, "Problemas", "Problems"), exact: true });
    await expect(problems.getByText(text(language, "Artículos", "Items"), { exact: true })).toBeVisible();
    await expect(problems.getByText(text(language, "En WhatsApp se cargan hasta 10 ítems; el mínimo es 15.", "WhatsApp loads up to 10 items; the minimum is 15."), { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: text(language, "Publicar versión 1", "Publish version 1"), exact: true })).toBeDisabled();
    await noPageScroll(page, width);
    await page.screenshot({ path: "test-results/rg13-minimum-" + language + "-" + width + ".png", fullPage: true });
    // «Ir a la pregunta» closes the dialog to change the minimum in the block.
    await problems.getByRole("button", { name: text(language, "Ir a la pregunta", "Go to the question"), exact: true }).click();
    await expect(dialog).toHaveCount(0);
  });
}

// RG3-A and RG6-A over the real checks of FormGroupPublicationHttpTests: the empty block, with the warning of the items WhatsApp does
// not load, and the published question that moves into the block. The backend writes their messages in the language of the request
// and the bodies were captured in Spanish, so the scene runs in Spanish.
async function openCheck(page: Page, width: number, scenario: RowsCheckScenario, version: number) {
  await open(page, "es", width, scenario, rowsCheckDefinition(scenario).id);
  await expect(page.getByRole("heading", { name: "Registrar visita", exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await closeMenu(page, "es", width);
  await page.getByRole("button", { name: "Publicar en WhatsApp", exact: true }).click();
  return page.getByRole("dialog", { name: "Publicar la versión " + version + " en WhatsApp", exact: true });
}
const summaryValue = (dialog: Locator, label: string) =>
  dialog.getByRole("region", { name: "Qué se publica", exact: true }).locator("dt", { hasText: new RegExp("^" + label + "$") }).locator("xpath=following-sibling::dd[1]");

for (const width of [1440, 390, 320]) {
  test("RG3-A the real check stops the empty block and warns about the items WhatsApp does not load " + width, async ({ page }) => {
    const dialog = await openCheck(page, width, "forms-publication-rows-http", 1);
    const problems = dialog.getByRole("region", { name: "Problemas", exact: true });
    await expect(problems.getByText("Artículos", { exact: true })).toBeVisible();
    await expect(problems.getByText("Agregá al menos una pregunta al bloque.", { exact: true })).toBeVisible();
    const warnings = dialog.getByRole("region", { name: "Avisos", exact: true });
    await expect(warnings.getByText("Artículos", { exact: true })).toBeVisible();
    await expect(warnings.getByText("En WhatsApp se cargan hasta 10 ítems; el máximo es 20.", { exact: true })).toBeVisible();
    // «Preguntas» counts without the block.
    await expect(summaryValue(dialog, "Preguntas")).toHaveText("1");
    await expect(dialog.getByRole("button", { name: "Publicar versión 1", exact: true })).toBeDisabled();
    await noPageScroll(page, width);
    await page.screenshot({ path: "test-results/rg3-empty-block-es-" + width + ".png", fullPage: true });
    // «Ir a la pregunta» of the warning closes the dialog to change the maximum of the block.
    await warnings.getByRole("button", { name: "Ir a la pregunta", exact: true }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("RG6-A the real check names the published question that moves into the block " + width, async ({ page }) => {
    const dialog = await openCheck(page, width, "forms-publication-rows-moved-http", 3);
    await expect(summaryValue(dialog, "Preguntas")).toHaveText("2");
    await expect(summaryValue(dialog, "Agregadas")).toHaveText("Artículos");
    await expect(summaryValue(dialog, "Pasan al bloque")).toHaveText("Cantidad");
    await expect(dialog.getByRole("region", { name: "Problemas", exact: true })).toHaveCount(0);
    // The check was taken with its publication open: Publish is off with that reason.
    const publish = dialog.getByRole("button", { name: "Publicar versión 3", exact: true });
    await expect(publish).toBeDisabled();
    await expect(publish).toHaveAccessibleDescription("Ya hay una publicación en curso para este formulario.");
    await noPageScroll(page, width);
    await page.screenshot({ path: "test-results/rg6-moved-es-" + width + ".png", fullPage: true });
  });
}
