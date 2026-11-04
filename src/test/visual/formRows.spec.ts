import { expect, test, type Page } from "@playwright/test";
import { fixtureFormId } from "./formFixtures";

// Evidence of the block of rows in the editor (RG1-A, RG6-A, RG9-A), without goldens: each capture is compared with its board.
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
    await expect(page.getByText(text(language, "Renglones · de 1 a 20 · 3 preguntas", "Rows · 1 to 20 · 3 questions"), { exact: true })).toBeVisible();
    await expect(page.getByText(text(language, "Preguntas de cada renglón", "Questions of each row"), { exact: true })).toBeVisible();
    await page.getByRole("button", { name: text(language, "Editar Artículos", "Edit Items"), exact: true }).click();
    await expect(page.getByRole("spinbutton", { name: text(language, "Máximo", "Maximum"), exact: true })).toHaveValue("20");
    await noPageScroll(page, width);
    await page.screenshot({ path: "test-results/rg1-block-" + language + "-" + width + ".png", fullPage: true });
    // A question of the block: marked, and what a row does not hold off with its reason (RG9-A).
    await page.getByRole("button", { name: text(language, "Editar Cantidad", "Edit Quantity"), exact: true }).click();
    await expect(page.getByRole("checkbox", { name: text(language, "Se carga varias veces", "Loaded several times"), exact: true })).toBeChecked();
    await expect(page.getByRole("option", { name: text(language, "Foto · No se carga varias veces", "Photo · Not loaded several times"), exact: true })).toBeDisabled();
    await expect(page.getByRole("option", { name: text(language, "Renglones · Ya hay un bloque de renglones", "Rows · There is already a block of rows"), exact: true })).toBeDisabled();
    await noPageScroll(page, width);
    await page.screenshot({ path: "test-results/rg6-row-question-" + language + "-" + width + ".png", fullPage: true });
  });
}
