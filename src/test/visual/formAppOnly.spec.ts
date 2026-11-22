import { expect, test, type Page } from "@playwright/test";
import { fixtureFormId } from "./formFixtures";

// Evidence of forms completed only in the app (SA1-A, SA2-A, SA3-A and SA5), without goldens: each capture is compared with its
// board in the separate canvas (docs/design/formularios-solo-en-la-app.md).
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
  test("SA1-A «Sólo en la app» next to the prefix, with the app's preview and dialog " + language + " " + width, async ({ page }) => {
    await open(page, language, width, "/formularios/" + fixtureFormId, "forms-publication-app-only");
    await expect(page.getByRole("heading", { name: text(language, "Registrar visita", "Register visit"), exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await closeMenu(page, language, width);
    // «Dónde se completa» goes in the shared piece for choosing (DS1-A, 2026-11-22): its button says the one chosen.
    await expect(page.getByRole("button", { name: text(language, "Dónde se completa Sólo en la app", "Where it is completed Only in the app"), exact: true })).toBeVisible();
    // SA2-A: nothing of WhatsApp; the preview is the app's «Nueva respuesta», with its final button off.
    await expect(page.getByRole("textbox", { name: text(language, "Cuándo lo ofrece el asistente", "When the assistant offers it"), exact: true })).toHaveCount(0);
    const preview = page.getByRole("region", { name: text(language, "Vista previa", "Preview"), exact: true });
    await expect(preview.getByRole("button", { name: text(language, "Confirmar visita", "Confirm visit"), exact: true })).toBeDisabled();
    await noPageScroll(page, width);
    await page.screenshot({ path: "test-results/sa-editor-app-" + language + "-" + width + ".png", fullPage: true });
    // SA3-A: the same dialog, without WhatsApp in its title, saying where the version is completed.
    await page.getByRole("button", { name: text(language, "Publicar", "Publish"), exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: text(language, "Publicar la versión 1", "Publish version 1"), exact: true })).toBeVisible();
    await expect(dialog.getByText(text(language, "Sólo en la app", "Only in the app"), { exact: true })).toBeVisible();
    await noPageScroll(page, width);
    await page.screenshot({ path: "test-results/sa-publish-app-" + language + "-" + width + ".png", fullPage: true });
  });

  test("SA5 without a form channel there is nothing to choose " + language + " " + width, async ({ page }) => {
    await open(page, language, width, "/formularios/" + fixtureFormId, "forms-publication-without-channels");
    await expect(page.getByRole("button", { name: text(language, "Publicar", "Publish"), exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await closeMenu(page, language, width);
    await expect(page.getByRole("button", { name: new RegExp("^" + text(language, "Dónde se completa", "Where it is completed") + " ") })).toHaveCount(0);
    await noPageScroll(page, width);
    await page.screenshot({ path: "test-results/sa5-editor-" + language + "-" + width + ".png", fullPage: true });
  });

  test("SA3-A where each form is completed, in a column of its own " + language + " " + width, async ({ page }) => {
    await open(page, language, width, "/formularios", "forms-publication-app-only");
    const table = page.getByRole("table");
    await expect(table.getByRole("columnheader", { name: text(language, "Dónde se completa", "Where it is completed"), exact: true })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: text(language, "Estado", "Status"), exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await closeMenu(page, language, width);
    await expect(table.getByRole("row", { name: new RegExp(text(language, "Registrar visita", "Register visit")) })).toContainText(text(language, "Sólo en la app", "Only in the app"));
    await page.screenshot({ path: "test-results/sa-list-" + language + "-" + width + ".png", fullPage: true });
  });
}
