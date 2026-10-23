import { expect, test, type Locator, type Page } from "@playwright/test";
import type { createCatalogQuestionVisualFixtures } from "./catalogQuestionFixtures";
import { catalogQuestionFixtureIds } from "./catalogQuestionFixtures";
import { fixtureFormId } from "./formFixtures";

type Language = "es" | "en";
const text = (language: Language, es: string, en: string) => language === "es" ? es : en;
async function open(page: Page, language: Language, width: number, scenario = "forms-catalog-fields") {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen: "/formularios/" + fixtureFormId, scenario, lang: language }));
  await expect(page.getByRole("heading", { name: text(language, "Pedir repuesto", "Request a spare part"), exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  if (width < 768) {
    const menu = page.getByRole("button", { name: text(language, "Menú de navegación", "Navigation menu"), exact: true });
    if (await menu.getAttribute("aria-expanded") === "true") await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
  }
  await page.getByRole("button", { name: text(language, "Editar Proveedores a consultar", "Edit Suppliers to contact"), exact: true }).click();
  const editor = page.locator("[data-question-local-id]").last();
  await expect(editor.getByRole("combobox", { name: text(language, "Dato de la persona", "Person’s data"), exact: true })).toHaveValue(catalogQuestionFixtureIds.attribute);
  return editor;
}
async function recipient(page: Page, editor: Locator, language: Language, name: string) {
  const sample = editor.getByRole("combobox", { name: text(language, "Como si lo recibiera", "As if received by"), exact: true });
  await sample.fill(name);
  const options = page.getByRole("listbox", { name: text(language, "Como si lo recibiera", "As if received by"), exact: true }).getByRole("option");
  await expect(options).toHaveCount(1);
  await expect(options).toHaveText(new RegExp(name));
  await sample.press("ArrowDown");
  await sample.press("Enter");
  await expect(sample).toBeFocused();
  await expect(sample).toHaveValue(new RegExp(name));
}
async function contained(page: Page, editor: Locator, width: number) {
  const bounds = (await editor.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
  expect(await editor.evaluate(node => node.scrollWidth)).toBeLessThanOrEqual(Math.ceil(bounds.width) + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
  const addButtons = editor.getByRole("region", { name: /Qué opciones ve cada persona|Which options each person sees/ }).getByRole("button", { name: /^(Agregar filtro|Add (?:filter|fixed filter))/ });
  expect(await addButtons.evaluateAll(buttons => buttons.every(button => {
    const bounds = button.getBoundingClientRect(), container = button.parentElement!.getBoundingClientRect();
    return bounds.left >= container.left - 1 && bounds.right <= container.right + 1;
  }))).toBe(true);
}
async function observed(page: Page) {
  return page.evaluate(() => {
    const fixture = (globalThis as typeof globalThis & { catalogQuestionFixture: ReturnType<typeof createCatalogQuestionVisualFixtures> }).catalogQuestionFixture;
    return { previews: fixture.previews, writes: fixture.forms.writes };
  });
}

// Chosen CE3-B/CE4-A evidence through the production route; no golden or real provider is used.
for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test("CE3 inherited and own presentation with recipient filters " + language + " " + width, async ({ page }, info) => {
    const label = (es: string, en: string) => text(language, es, en);
    const editor = await open(page, language, width);
    const inherit = editor.getByRole("radio", { name: new RegExp("^" + label("Como en el catálogo", "As in the catalog")) });
    const description = editor.getByRole("combobox", { name: label("Descripción · hasta 300", "Description · up to 300"), exact: true });
    await expect(inherit).toBeChecked();
    await expect(description).toBeDisabled();
    await recipient(page, editor, language, "Juan Gómez");
    await expect(editor.getByText(label("14 opciones", "14 options"), { exact: true })).toBeVisible();
    const preview = page.getByRole("region", { name: label("Vista previa", "Preview"), exact: true });
    const suppliers = preview.getByRole("group", { name: label("Proveedores a consultar", "Suppliers to contact"), exact: true });
    await expect(suppliers.getByRole("checkbox")).toHaveCount(14);
    await expect(suppliers.getByText("30-71234567-8 · " + label("Centro", "Center"), { exact: true })).toBeVisible();
    await description.scrollIntoViewIfNeeded();
    await contained(page, editor, width);
    await page.screenshot({ path: info.outputPath("ce3-inherited-ready.png"), fullPage: true });

    const own = editor.getByRole("radio", { name: new RegExp("^" + label("Propio de esta pregunta", "Own for this question")) });
    await own.focus();
    await own.press("Space");
    await expect(own).toBeChecked();
    await expect(description).toBeEnabled();
    await editor.getByRole("button", { name: label("Quitar CUIT de Descripción · hasta 300", "Remove CUIT from Description · up to 300"), exact: true }).click();
    await editor.getByRole("button", { name: label("Quitar Zona de Descripción · hasta 300", "Remove Zone from Description · up to 300"), exact: true }).click();
    await description.selectOption(catalogQuestionFixtureIds.category);
    await description.selectOption(catalogQuestionFixtureIds.paymentDays);
    await expect(suppliers.getByText("Frío · 30", { exact: true }).first()).toBeVisible();
    await description.scrollIntoViewIfNeeded();
    await contained(page, editor, width);
    await page.screenshot({ path: info.outputPath("ce3-own-ready.png"), fullPage: true });

    await editor.getByRole("button", { name: label("Agregar filtro fijo", "Add fixed filter"), exact: true }).click();
    const fixed = editor.getByRole("textbox", { name: label("Valor fijo", "Fixed value"), exact: true });
    await fixed.fill("Frío");
    await expect(editor.getByText(label("7 opciones", "7 options"), { exact: true })).toBeVisible();
    await expect(suppliers.getByRole("checkbox")).toHaveCount(7);
    await fixed.scrollIntoViewIfNeeded();
    await contained(page, editor, width);
    await page.screenshot({ path: info.outputPath("ce4-person-and-fixed.png"), fullPage: true });
    const seen = await observed(page);
    expect(seen.writes).toHaveLength(0);
    expect(seen.previews.at(-1)?.source).toMatchObject({ catalog: catalogQuestionFixtureIds.suppliers, match: [{ fieldId: catalogQuestionFixtureIds.zone, personAttributeId: catalogQuestionFixtureIds.attribute }, { fieldId: catalogQuestionFixtureIds.category, value: "Frío" }], presentation: { title: ["text"], description: [catalogQuestionFixtureIds.category, catalogQuestionFixtureIds.paymentDays] } });
  });

  test("CE4 recipient without data never sees the full catalog " + language + " " + width, async ({ page }, info) => {
    const label = (es: string, en: string) => text(language, es, en);
    const editor = await open(page, language, width, "forms-catalog-fields-missing");
    await recipient(page, editor, language, "Pablo Sosa");
    const message = label("La persona no tiene el dato necesario; no se le puede mandar el formulario.", "This person is missing required data; the form cannot be sent to them.");
    await expect(editor.getByText(message, { exact: true })).toBeVisible();
    const preview = page.getByRole("region", { name: label("Vista previa", "Preview"), exact: true });
    await expect(preview.getByText(message, { exact: true })).toBeVisible();
    await expect(preview.getByRole("checkbox")).toHaveCount(0);
    const sample = editor.getByRole("combobox", { name: label("Como si lo recibiera", "As if received by"), exact: true });
    await sample.focus();
    await sample.press("ArrowDown");
    await sample.press("Escape");
    await expect(sample).toBeFocused();
    await expect(sample).toHaveAttribute("aria-expanded", "false");
    await contained(page, editor, width);
    await page.screenshot({ path: info.outputPath("ce4-recipient-data-missing.png"), fullPage: true });
    const seen = await observed(page);
    expect(seen.writes).toHaveLength(0);
    expect(seen.previews.at(-1)?.sampleUserId).toBe(catalogQuestionFixtureIds.pablo);
  });
}
