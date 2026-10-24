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
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Cambios de la otra revisión para revisar" })).toBeVisible();
  await page.screenshot({ path: "test-results/forms-conflict-es.png", fullPage: true });
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
  test(`content is edited in the menu language ${language} at ${width}px`, async ({ page }) => {
    const es = language === "es";
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/src/test/visual/index.html?screen=/formularios/${fixtureFormId}&scenario=forms-translations&lang=${language}`);
    await page.getByRole("heading", { name: es ? "El formulario" : "The form", level: 2, exact: true }).waitFor({ state: "visible" });
    // There is no content language selector: the menu language decides what is edited.
    await expect(page.getByRole("button", { name: /^(Español|Inglés|Spanish|English)\b/ })).toHaveCount(0);
    const name = page.getByRole("textbox", { name: es ? "Nombre" : "Name", exact: true });
    const prefix = page.getByRole("textbox", { name: es ? "Prefijo de numeración" : "Numbering prefix", exact: true });
    const preview = page.getByRole("region", { name: es ? "Vista previa" : "Preview", exact: true });
    if (es) {
      // Spanish is the original: it is edited as written, without translation marks.
      await expect(name).toHaveValue("Registrar visita");
      await expect(prefix).not.toHaveAttribute("readonly", "");
      await expect(page.getByText(/\d+ sin traducir/)).toHaveCount(0);
      await expect(preview.getByRole("radio", { name: "Sí", exact: true })).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.screenshot({ path: `test-results/forms-translations-${language}-${width}.png`, fullPage: true });
      return;
    }
    // With the menu in English, the optional translation is edited and the original is the reference.
    await expect(name).toHaveValue("Register visit");
    await expect(prefix).toHaveAttribute("readonly", "");
    await page.getByRole("button", { name: "Edit Importe cobrado", exact: true }).click();
    const question = page.getByRole("textbox", { name: "Question", exact: true }).first();
    await expect(question).toHaveValue("");
    await expect(question).toBeFocused();
    await expect(page.getByText("Original (Spanish): Importe cobrado", { exact: true })).toBeVisible();
    await expect(preview.getByRole("radio", { name: "Sí", exact: true })).toHaveCount(1);
    await expect(preview.getByRole("radio", { name: "Yes", exact: true })).toHaveCount(0);
    await expect(preview.getByRole("textbox", { name: "Importe cobrado", exact: true })).toHaveCount(1);
    await expect(preview.getByText("Shown in Spanish: 3 texts are untranslated in English.", { exact: true })).toBeVisible();
    await question.fill("Collected amount");
    await name.fill("Visit record");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `test-results/forms-translations-${language}-${width}.png`, fullPage: true });
    await preview.scrollIntoViewIfNeeded();
    await preview.screenshot({ path: `test-results/forms-translations-preview-${language}-${width}.png` });
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.locator('[data-sonner-toast][data-type="success"]')).toHaveCount(1);
    await expect(name).toHaveValue("Visit record");
    await expect(preview.getByRole("option", { name: "Pérez Hnos.", exact: true })).toHaveCount(1);
    await page.getByRole("link", { name: "Design forms", exact: true }).last().click();
    await page.getByRole("table").getByRole("link", { name: "Visit record", exact: true }).click();
    await expect(name).toHaveValue("Visit record");
    await expect(preview.getByRole("textbox", { name: "Importe cobrado", exact: true })).toHaveCount(1);
    await expect(preview.getByRole("option", { name: "Pérez Hnos.", exact: true })).toHaveCount(1);
    await page.getByRole("button", { name: "Edit Customer", exact: true }).click();
    await page.getByRole("textbox", { name: "Option 1", exact: true }).fill("Perez brothers");
    await page.getByRole("button", { name: "Edit Notes", exact: true }).click();
    await page.getByRole("textbox", { name: "Help for the employee", exact: true }).fill("Tell us what happened.");
    await expect(page.getByText(/\d+ untranslated/)).toHaveCount(0);
    await expect(preview.getByRole("radio", { name: "Yes", exact: true })).toHaveCount(1);
    await expect(preview.getByRole("radio", { name: "Sí", exact: true })).toHaveCount(0);
    await expect(preview.getByRole("textbox", { name: "Collected amount", exact: true })).toHaveCount(1);
    await expect(preview.getByRole("option", { name: "Perez brothers", exact: true })).toHaveCount(1);
    await expect(preview.getByText("Tell us what happened.", { exact: true })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    await page.screenshot({ path: "test-results/forms-translations-complete-" + language + "-" + width + ".png", fullPage: true });
    await preview.scrollIntoViewIfNeeded();
    await preview.screenshot({ path: "test-results/forms-translations-complete-preview-" + language + "-" + width + ".png" });
  });
}

for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test(`publication confirmation and progress ${language} at ${width}px`, async ({ page, baseURL }) => {
    const es = language === "es";
    const external: string[] = [];
    const origin = new URL(baseURL!).origin;
    page.on("request", request => { if (new URL(request.url()).origin !== origin) external.push(request.url()); });
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/src/test/visual/index.html?screen=/formularios/${fixtureFormId}&scenario=forms-publication-progress&lang=${language}`);
    const trigger = page.getByRole("button", { name: es ? "Publicar en WhatsApp" : "Publish on WhatsApp", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: es ? "Publicar la versión 1 en WhatsApp" : "Publish version 1 on WhatsApp", exact: true });
    const publish = dialog.getByRole("button", { name: es ? "Publicar versión 1" : "Publish version 1", exact: true });
    await expect(publish).toBeEnabled();
    await page.evaluate(() => document.fonts.ready);
    const close = await dialog.locator('[data-slot="dialog-close"]').boundingBox();
    const titleRight = await dialog.getByRole("heading").first().evaluate(element => { const range = document.createRange(); range.selectNodeContents(element); return Math.max(...Array.from(range.getClientRects(), rect => rect.right)); });
    expect(titleRight).toBeLessThanOrEqual(close!.x - 4);
    await dialog.press("Escape");
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(publish).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `test-results/forms-publication-confirm-${language}-${width}.png`, fullPage: true });
    await publish.click();
    await expect(page.getByRole("heading", { name: es ? "Publicando · versión 1" : "Publishing · version 1", exact: true })).toBeVisible();
    await expect(page.locator("[data-sonner-toast][data-type=success]")).toContainText(es ? "Publicación aceptada · versión 1" : "Publication accepted · version 1");
    await expect(page.getByRole("heading", { name: es ? "Publicado · versión 1" : "Published · version 1", exact: true })).toHaveCount(0);
    const name = page.getByRole("textbox", { name: es ? "Nombre" : "Name", exact: true });
    await name.fill(es ? "Mi borrador siguiente" : "My next draft");
    await expect(page.getByRole("textbox", { name: es ? "Prefijo de numeración" : "Numbering prefix", exact: true })).toHaveAttribute("readonly", "");
    const consult = page.getByRole("button", { name: es ? "Consultar publicación" : "Check publication", exact: true });
    await consult.click();
    await expect(page.getByText(es ? "Enviada a WhatsApp; esperando confirmación" : "Sent to WhatsApp; awaiting confirmation", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const progress = await page.getByRole("region", { name: es ? "Publicando · versión 1" : "Publishing · version 1", exact: true }).boundingBox();
    expect(progress!.x).toBeGreaterThanOrEqual(0);
    expect(progress!.x + progress!.width).toBeLessThanOrEqual(width);
    const action = await trigger.boundingBox();
    expect(action!.x).toBeGreaterThanOrEqual(0);
    expect(action!.x + action!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `test-results/forms-publication-progress-${language}-${width}.png`, fullPage: true });
    await consult.click();
    await expect(page.getByRole("heading", { name: es ? "Publicado · versión 1" : "Published · version 1", exact: true })).toBeVisible();
    await expect(name).toHaveValue(es ? "Mi borrador siguiente" : "My next draft");
    expect(external).toEqual([]);
  });
}

test("uncertain publication keeps one UUID and replays only the same body after a 404 and wait", async ({ page }) => {
  const attempts = () => page.evaluate(() => (window as typeof window & { fixturePublicationAttempts: string[] }).fixturePublicationAttempts);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(`/src/test/visual/index.html?screen=/formularios/${fixtureFormId}&scenario=forms-publication-uncertain&lang=es`);
  await page.getByRole("heading", { name: "Registrar visita", level: 1, exact: true }).waitFor({ state: "visible" });
  await page.evaluate(() => {
    const fixture = window as typeof window & { fixturePublicationAttempts: string[] };
    fixture.fixturePublicationAttempts = [];
    const originalFetch = window.fetch;
    window.fetch = (input, options) => {
      const request = new Request(input, options);
      if (request.method === "POST" && new URL(request.url).pathname.endsWith("/publications")) void request.clone().text().then(body => fixture.fixturePublicationAttempts.push(body));
      return originalFetch(input, options);
    };
  });
  await page.getByRole("button", { name: "Publicar en WhatsApp", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Publicar la versión 1 en WhatsApp", exact: true });
  await expect(dialog.getByRole("button", { name: "Publicar versión 1", exact: true })).toBeEnabled();
  await dialog.getByRole("button", { name: "Publicar versión 1", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Publicación sin confirmar", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Repetir el mismo intento", exact: true })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Borrador posterior");
  await page.getByRole("button", { name: "Consultar publicación", exact: true }).click();
  const replay = page.getByRole("button", { name: "Repetir el mismo intento", exact: true });
  await expect(replay).toBeDisabled();
  await expect.poll(attempts).toHaveLength(1);
  await page.screenshot({ path: "test-results/forms-publication-uncertain-es-320.png", fullPage: true });
  await expect(replay).toBeEnabled({ timeout: 10000 });
  await replay.click();
  await expect(page.getByRole("heading", { name: "Publicando · versión 1", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Nombre", exact: true })).toHaveValue("Borrador posterior");
  await expect.poll(attempts).toHaveLength(2);
  const sent = await attempts();
  expect(sent[1]).toBe(sent[0]);
  await expect(page.getByRole("textbox", { name: "Prefijo de numeración", exact: true })).toHaveAttribute("readonly", "");
});
