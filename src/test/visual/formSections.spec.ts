import { expect, test, type Page } from "@playwright/test";
import { fixtureFormId } from "./formFixtures";
import { formEntryFixtureIds } from "./formEntryFixtures";

// Evidence of the section titles (CW15-B), without goldens: each capture is compared with its board.
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
  test("CW15-B the titles in the editor and the preview " + language + " " + width, async ({ page }) => {
    await open(page, language, width, "/formularios/" + fixtureFormId, "forms-sections");
    await expect(page.getByRole("heading", { name: text(language, "Registrar visita", "Register visit"), exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await closeMenu(page, language, width);
    // The titles are rows of the list, among the questions, and «Agregar título» goes next to «Agregar pregunta».
    const rows = page.locator("[data-question-local-id], [data-section-local-id]");
    await expect(rows.nth(3)).toHaveAttribute("data-section-local-id", /.+/);
    await expect(rows.nth(3)).toContainText(text(language, "Cobro", "Payment"));
    await expect(page.getByRole("button", { name: text(language, "Agregar título", "Add title"), exact: true })).toBeVisible();
    // The preview shows the titles of its first screen as subtitles.
    const preview = page.getByRole("region", { name: text(language, "Vista previa", "Preview"), exact: true });
    await expect(preview.getByRole("heading", { level: 3 })).toHaveText([text(language, "Visita", "Visit"), text(language, "Cobro", "Payment"), text(language, "Cierre", "Closing")]);
    await noPageScroll(page, width);
    await page.screenshot({ path: "test-results/cw15-editor-" + language + "-" + width + ".png", fullPage: true });
    await page.getByRole("button", { name: text(language, "Editar Cobro", "Edit Payment"), exact: true }).click();
    await expect(page.getByRole("textbox", { name: text(language, "Título", "Title"), exact: true })).toHaveValue(text(language, "Cobro", "Payment"));
    await noPageScroll(page, width);
    await page.screenshot({ path: "test-results/cw15-editor-open-" + language + "-" + width + ".png", fullPage: true });
  });

  test("CW15-B a zone per title in the app " + language + " " + width, async ({ page }) => {
    await open(page, language, width, "/formularios/" + formEntryFixtureIds.sowing + "/cargar", "entries-sections");
    await expect(page.getByRole("heading", { name: text(language, "Nueva respuesta", "New response"), level: 1 })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await closeMenu(page, language, width);
    // A zone per title, in the editor's order, and the photos at the end.
    for (const title of [text(language, "Lote y cultivo", "Lot and crop"), text(language, "Siembra", "Sowing"), text(language, "Labores", "Tasks"), text(language, "Fotos y documentos", "Photos and documents")])
      await expect(page.getByRole("button", { name: text(language, "Plegar " + title, "Collapse " + title), exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: text(language, "Plegar Datos", "Collapse Data"), exact: true })).toHaveCount(0);
    await noPageScroll(page, width);
    await page.screenshot({ path: "test-results/cw15-entry-" + language + "-" + width + ".png", fullPage: true });
  });
}
