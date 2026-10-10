import { expect, test } from "@playwright/test";
import { fixtureFormId } from "./formFixtures";

for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test(`forms draft creation ${language} at ${width}px`, async ({ page, baseURL }) => {
    if (!baseURL) throw new Error("A base URL is required.");
    const localOrigin = new URL(baseURL).origin;
    const external: string[] = [];
    page.on("request", request => { if (new URL(request.url()).origin !== localOrigin) external.push(request.url()); });
    const es = language === "es";
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/src/test/visual/index.html?screen=/formularios&scenario=forms-empty&lang=${language}`);
    await expect(page.getByRole("heading", { name: es ? "Todavía no hay formularios" : "No forms yet" })).toBeVisible();
    await page.getByRole("link", { name: es ? "Nuevo formulario" : "New form", exact: true }).first().click();
    const name = page.getByRole("textbox", { name: es ? "Nombre" : "Name", exact: true });
    const formName = es ? "Registrar entrega" : "Register delivery";
    await name.fill(formName);
    await expect(page.getByRole("textbox", { name: es ? "Prefijo de numeración" : "Numbering prefix", exact: true })).toHaveValue(es ? "ENT" : "DEL");
    await page.getByRole("button", { name: es ? "Agregar pregunta" : "Add question", exact: true }).click();
    const label = page.getByRole("textbox", { name: es ? "Pregunta" : "Question", exact: true }).first();
    await label.fill(es ? "Observaciones" : "Notes");
    await page.getByRole("combobox", { name: es ? "Tipo de respuesta" : "Answer type", exact: true }).selectOption("longText");
    await expect(page.getByRole("spinbutton", { name: es ? "Máximo de caracteres" : "Maximum characters", exact: true })).toHaveValue("600");
    await page.getByRole("button", { name: es ? "Guardar borrador" : "Save draft", exact: true }).click();
    await expect(page.locator('[data-sonner-toast][data-type="success"]')).toHaveCount(1);
    await expect(name).toHaveValue(formName);
    await expect(page.getByRole("button", { name: es ? "Publicar en WhatsApp" : "Publish on WhatsApp" })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const preview = page.getByRole("region", { name: es ? "Vista previa" : "Preview", exact: true });
    const box = await preview.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `test-results/forms-editor-${language}-${width}.png`, fullPage: true });
    await preview.scrollIntoViewIfNeeded();
    await preview.screenshot({ path: `test-results/forms-preview-${language}-${width}.png` });
    await page.getByRole("link", { name: es ? "Diseñar formularios" : "Design forms", exact: true }).last().click();
    await expect(page.getByRole("table").getByRole("link", { name: formName, exact: true })).toBeVisible();
    expect(external).toEqual([]);
  });
}

test("conflict comparison restores focus and never writes until Save is pressed", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/src/test/visual/index.html?screen=/formularios/${fixtureFormId}&scenario=forms-conflict&lang=es`);
  await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Mis cambios");
  await page.getByRole("button", { name: "Guardar borrador", exact: true }).click();
  const trigger = page.getByRole("main").getByRole("button", { name: "Revisar", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Revisión del borrador", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByRole("button", { name: "Conservar mis cambios", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Terminar la revisión", exact: true })).toBeDisabled();
  for (const select of await dialog.getByRole("combobox").all()) await select.selectOption("mine");
  await page.screenshot({ path: "test-results/forms-conflict-es.png", fullPage: true });
  await dialog.getByRole("button", { name: "Terminar la revisión", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Nombre", exact: true })).toHaveValue("Mis cambios");
  await page.getByRole("button", { name: "Guardar borrador", exact: true }).click();
  await expect(page.locator('[data-sonner-toast][data-type="success"]')).toHaveCount(1);
});

test("readonly preview keeps absence, exact decimals and date-only values", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`/src/test/visual/index.html?screen=/formularios/${fixtureFormId}&scenario=forms-read&lang=es`);
  await expect(page.getByRole("textbox", { name: "Nombre", exact: true })).toHaveAttribute("readonly", "");
  await expect(page.getByRole("button", { name: "Guardar borrador", exact: true })).toHaveCount(0);
  const preview = page.getByRole("region", { name: "Vista previa", exact: true });
  await expect(preview.getByRole("radio", { checked: true })).toHaveCount(0);
  const amount = preview.getByRole("textbox", { name: "Importe cobrado", exact: true });
  await amount.fill("9007199254740993.000001");
  await expect(amount).toHaveValue("9007199254740993.000001");
  const date = preview.getByLabel(/^Fecha de visita/);
  await date.fill("2026-10-10");
  await expect(date).toHaveValue("2026-10-10");
  await preview.getByRole("radio", { name: "No", exact: true }).click();
  await expect(preview.getByRole("radio", { name: "No", exact: true })).toBeChecked();
  await page.screenshot({ path: "test-results/forms-read-es-390.png", fullPage: true });
});

for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test(`content language is independent of the SPA ${language} at ${width}px`, async ({ page }) => {
    const es = language === "es";
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/src/test/visual/index.html?screen=/formularios/${fixtureFormId}&scenario=forms-translations&lang=${language}`);
    const name = page.getByRole("textbox", { name: es ? "Nombre" : "Name", exact: true });
    await expect(name).toHaveValue("Registrar visita");
    const english = page.getByRole("button", { name: /^English/ });
    await english.focus();
    await page.keyboard.press("Enter");
    await expect(english).toHaveAttribute("aria-pressed", "true");
    await expect(name).toHaveValue("Register visit");
    await expect(page.getByRole("textbox", { name: es ? "Prefijo de numeración" : "Numbering prefix", exact: true })).toHaveAttribute("readonly", "");
    await expect(page.getByText(es ? "Inglés · 3 pendientes" : "English · 3 pending", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: es ? "Editar Importe cobrado" : "Edit Importe cobrado", exact: true }).click();
    const question = page.getByRole("textbox", { name: es ? "Pregunta" : "Question", exact: true }).first();
    await expect(question).toHaveValue("");
    await expect(question).toBeFocused();
    await expect(page.getByText(es ? "Original (Español): Importe cobrado" : "Original (Spanish): Importe cobrado", { exact: true })).toBeVisible();
    const preview = page.getByRole("region", { name: es ? "Vista previa" : "Preview", exact: true });
    await expect(preview.getByRole("radio", { name: "Yes", exact: true })).toHaveCount(1);
    await expect(preview.getByRole("textbox", { name: "Importe cobrado · Translation pending", exact: true })).toHaveCount(1);
    await question.fill("Collected amount");
    await name.fill("Visit record");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `test-results/forms-translations-${language}-${width}.png`, fullPage: true });
    await preview.scrollIntoViewIfNeeded();
    await preview.screenshot({ path: `test-results/forms-translations-preview-${language}-${width}.png` });
    await page.getByRole("button", { name: es ? "Guardar borrador" : "Save draft", exact: true }).click();
    await expect(page.locator('[data-sonner-toast][data-type="success"]')).toHaveCount(1);
    await page.getByRole("button", { name: /^Español/ }).click();
    await expect(name).toHaveValue("Registrar visita");
    await page.getByRole("button", { name: /^English/ }).click();
    await expect(name).toHaveValue("Visit record");
    await expect(preview.getByRole("option", { name: "Pérez Hnos. · Translation pending", exact: true })).toHaveCount(1);
    await page.getByRole("link", { name: es ? "Diseñar formularios" : "Design forms", exact: true }).last().click();
    await page.getByRole("table").getByRole("link", { name: es ? "Registrar visita" : "Visit record", exact: true }).click();
    await expect(name).toHaveValue("Registrar visita");
    await page.getByRole("button", { name: /^English/ }).click();
    await expect(name).toHaveValue("Visit record");
    await expect(preview.getByRole("textbox", { name: "Collected amount", exact: true })).toHaveCount(1);
    await expect(preview.getByRole("option", { name: "Pérez Hnos. · Translation pending", exact: true })).toHaveCount(1);
  });
}
