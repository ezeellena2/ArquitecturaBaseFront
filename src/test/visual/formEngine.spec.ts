import { expect, test, type Page } from "@playwright/test";
import { responseFormId } from "../responseFixtures";
import { fixtureFormId } from "./formFixtures";
import { formEntryFixtureIds } from "./formEntryFixtures";

// Evidence of the engine for documents (CA1-A, CO1-A, BI1-A), without goldens: each capture is compared with its board.
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
  test("CA1-A CO1-A BI1-A the invoice from the library in the editor " + language + " " + width, async ({ page }) => {
    await open(page, language, width, "/formularios/" + fixtureFormId, "forms-library-engine");
    await expect(page.getByRole("heading", { name: text(language, "Factura", "Invoice"), exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await closeMenu(page, language, width);
    // BI1-A: the header names the standard; each bound question has its padlock and its trash off, with the reason.
    await expect(page.getByText(text(language, "· De la biblioteca: Factura, versión 1", "· From the library: Invoice, version 1"), { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: text(language, "La necesita el estándar de la biblioteca: se cambian el texto, la ayuda y el orden.",
      "The library standard needs it: its text, help and order can change."), exact: true })).toHaveCount(4);
    // CO1-A and CA1-A in the list: the condition under the name and the formula of each calculation.
    await expect(page.getByText(text(language, "Si Concepto es Servicios o…", "If Concept is Services or…"), { exact: true })).toBeVisible();
    await expect(page.getByText(text(language, "Cálculo · Suma de Importe de todos los ítems", "Calculation · Sum of Amount of all items"), { exact: true })).toBeVisible();
    await noPageScroll(page, width);
    await page.screenshot({ path: "test-results/engine-editor-" + language + "-" + width + ".png", fullPage: true });

    // CA1-A: «Qué calcula» of the amount, in the block, with its two lists and «Sumar» off with its reason.
    await page.getByRole("button", { name: text(language, "Editar Importe", "Edit Amount"), exact: true }).click();
    await expect(page.getByRole("button", { name: new RegExp("^" + text(language, "Multiplica", "Multiplies") + " ") })).toBeVisible();
    await expect(page.getByRole("button", { name: text(language, "Sumar", "Add"), exact: true })).toHaveAttribute("aria-disabled", "true");
    await noPageScroll(page, width);
    await page.screenshot({ path: "test-results/engine-calculation-" + language + "-" + width + ".png", fullPage: true });

    // CO1-A: «Se muestra» of the period, with «Si» and the chips of «es».
    await page.getByRole("button", { name: text(language, "Editar Período desde", "Edit Period from"), exact: true }).click();
    await expect(page.getByRole("combobox", { name: text(language, "Si", "If"), exact: true })).toBeVisible();
    await expect(page.getByRole("group", { name: text(language, "es", "is"), exact: true })).toContainText(text(language, "Productos y servicios", "Goods and services"));
    await noPageScroll(page, width);
    await page.screenshot({ path: "test-results/engine-condition-" + language + "-" + width + ".png", fullPage: true });

    // BI1-A: the total, bound, keeps its calculation and its condition with the reason on each control.
    await page.getByRole("button", { name: text(language, "Editar Total", "Edit Total"), exact: true }).click();
    await expect(page.getByRole("button", { name: text(language, "Multiplicar", "Multiply"), exact: true })).toHaveAttribute("aria-disabled", "true");
    await noPageScroll(page, width);
    await page.screenshot({ path: "test-results/engine-bound-" + language + "-" + width + ".png", fullPage: true });
  });

  test("CA1-A CO1-A the invoice while it is loaded " + language + " " + width, async ({ page }) => {
    await open(page, language, width, "/formularios/" + formEntryFixtureIds.sowing + "/cargar", "entries-engine");
    await expect(page.getByRole("heading", { name: text(language, "Nueva respuesta", "New response"), level: 1 })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await closeMenu(page, language, width);
    // CO1-A: the period appears in its place only with «Servicios».
    await expect(page.getByLabel(text(language, "Período desde", "Period from"))).toHaveCount(0);
    await page.getByRole("radio", { name: text(language, "Servicios", "Services"), exact: true }).click();
    await expect(page.getByLabel(new RegExp(text(language, "^Período desde", "^Period from")))).toBeVisible();
    // CA1-A: the amount and the total change as the numbers are typed, greyed and not written.
    const quantity = page.getByLabel(new RegExp(text(language, "Cantidad", "Quantity"))).first();
    const price = page.getByLabel(new RegExp(text(language, "Precio unitario", "Unit price"))).first();
    await quantity.fill("12");
    await price.fill(text(language, "850,00", "850.00"));
    const total = page.getByRole("textbox", { name: "Total", exact: true });
    await expect(total).toHaveValue(text(language, "10.200,00", "10,200.00"));
    await expect(total).toHaveAttribute("readonly", "");
    // The amount is one more column of the table, to the right; its (i) says how it is computed.
    if (width >= 640) await expect(page.getByRole("columnheader", { name: new RegExp(text(language, "^Importe", "^Amount")) })).toHaveCSS("text-align", "right");
    await noPageScroll(page, width);
    await page.screenshot({ path: "test-results/engine-entry-" + language + "-" + width + ".png", fullPage: true });
  });
}

for (const language of ["es", "en"] as const) {
  test("CA1-A the invoice next to the sheet " + language, async ({ page }) => {
    await open(page, language, 1440, "/formularios/" + responseFormId + "/respuestas", "responses-app-engine");
    await expect(page.getByRole("link", { name: "TEST-000002", exact: true })).toBeVisible();
    await page.getByRole("button", { name: text(language, "Agregar respuesta", "Add response"), exact: true }).click();
    const panel = page.getByRole("region", { name: text(language, "Nueva respuesta de Factura", "New response to Invoice") });
    const first = panel.getByRole("region", { name: text(language, "Ítem 1", "Item 1"), exact: true });
    await first.getByLabel(new RegExp(text(language, "^Cantidad", "^Quantity"))).fill("3");
    await first.getByLabel(new RegExp(text(language, "^Precio unitario", "^Unit price"))).fill("10");
    // In the panel the amount is one more line of the item's box.
    await expect(first.getByRole("textbox", { name: text(language, "Importe", "Amount"), exact: true })).toHaveValue("30");
    await page.evaluate(() => document.fonts.ready);
    await noPageScroll(page, 1440);
    await page.screenshot({ path: "test-results/engine-entry-panel-" + language + "-1440.png" });
  });
}
