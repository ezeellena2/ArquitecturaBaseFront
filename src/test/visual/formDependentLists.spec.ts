import { expect, test, type Page } from "@playwright/test";
import { fixtureFormId } from "./formFixtures";
import { formEntryFixtureIds } from "./formEntryFixtures";

// Evidence of the lists that depend on another answer (CW7), without goldens: each capture is compared with its board.
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
  test("CW7 the filter by another answer in the editor " + language + " " + width, async ({ page }) => {
    await open(page, language, width, "/formularios/" + fixtureFormId, "forms-catalog-fields-dependent");
    await expect(page.getByRole("heading", { name: text(language, "Pedir repuesto", "Request a spare part"), exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await closeMenu(page, language, width);
    await page.getByRole("button", { name: text(language, "Editar Proveedor", "Edit Supplier"), exact: true }).click();
    const editor = page.locator("[data-question-local-id]").last();
    const filters = text(language, "Qué opciones ve cada persona", "Which options each person sees");
    // Folded, the band says the filters, the one by another answer with the question it waits for.
    await expect(editor.getByText(text(language, "Zona según la respuesta de «Zona» · Rubro: Frío", "Zone by the answer to «Zone» · Category: Frío"), { exact: true })).toBeVisible();
    await editor.getByRole("button", { name: text(language, "Expandir «" + filters + "»", "Expand “" + filters + "”"), exact: true }).click();
    const condition = editor.getByRole("group", { name: text(language, "Condición 1", "Condition 1"), exact: true });
    await expect(condition.getByText(text(language, "Según otra respuesta", "By another answer"), { exact: true })).toBeVisible();
    const answer = condition.getByRole("combobox", { name: text(language, "Respuesta de", "Answer to"), exact: true });
    await expect(answer).toHaveValue(text(language, "Zona (pregunta 2)", "Zone (question 2)"));
    await expect(editor.getByRole("button", { name: text(language, "Agregar filtro según otra respuesta", "Add filter by another answer"), exact: true })).toBeVisible();
    await answer.click();
    const option = page.getByRole("listbox").getByRole("option", { name: new RegExp(text(language, "Zona \\(pregunta 2\\)", "Zone \\(question 2\\)")) });
    await expect(option).toContainText(text(language, "Elige de Zonas", "Chooses from Zones"));
    await noPageScroll(page, width);
    await page.screenshot({ path: "test-results/cw7-editor-" + language + "-" + width + ".png", fullPage: true });
    await page.keyboard.press("Escape");
    // It is tried by loading the form: the test with a person says so and no maximum is read.
    await expect(editor.getByText(text(language, "Calculando cuántas opciones ve cada persona…", "Calculating how many options each person sees…"), { exact: true })).toHaveCount(0);
  });

  test("CW7 a dependent list in the app " + language + " " + width, async ({ page }) => {
    const phone = width < 640;
    await open(page, language, width, "/formularios/" + formEntryFixtureIds.sowing + "/cargar", "entries-dependent");
    await expect(page.getByRole("heading", { name: text(language, "Nueva respuesta", "New response"), level: 1 })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const field = text(language, "Campo", "Field"), lot = text(language, "Lote", "Lot");
    const waiting = text(language, "Elegí primero «Campo»", "Choose «Field» first");
    const control = (label: string) => phone ? page.getByRole("button", { name: label, exact: true }) : page.getByRole("combobox", { name: label, exact: true });
    // Until the field is chosen, the lot is off and says so in its field.
    await expect(control(lot)).toBeDisabled();
    if (phone) await expect(control(lot)).toHaveText(waiting); else await expect(control(lot)).toHaveAttribute("placeholder", waiting);
    await noPageScroll(page, width);
    await page.screenshot({ path: "test-results/cw7-entry-waiting-" + language + "-" + width + ".png", fullPage: true });
    const choose = async (label: string, title: string) => {
      await control(label).click();
      if (phone) await page.getByRole("dialog").getByRole("option", { name: new RegExp("^" + title) }).click();
      else await page.getByRole("listbox", { name: label, exact: true }).getByRole("option", { name: new RegExp("^" + title) }).click();
    };
    await choose(field, "El Ombú");
    await expect(control(lot)).toBeEnabled();
    await control(lot).click();
    const list = phone ? page.getByRole("dialog") : page.getByRole("listbox", { name: lot, exact: true });
    // The count names the field the lots are of.
    await expect(list.getByText(text(language, "15 opciones de El Ombú", "15 options for El Ombú"), { exact: true })).toBeVisible();
    await page.screenshot({ path: "test-results/cw7-entry-list-" + language + "-" + width + ".png", fullPage: true });
    await list.getByRole("option", { name: new RegExp("^" + lot + " 2(?![0-9])") }).click();
    if (phone) await expect(control(lot)).toHaveText(lot + " 2"); else await expect(control(lot)).toHaveValue(lot + " 2");
    // Another field clears the lot, which was of the other one.
    await choose(field, "La Esperanza");
    if (phone) await expect(control(lot)).toHaveText(text(language, "Buscar en Lote", "Search in Lot")); else await expect(control(lot)).toHaveValue("");
    await page.screenshot({ path: "test-results/cw7-entry-cleared-" + language + "-" + width + ".png", fullPage: true });
  });

  test("CW7 a form with a dependent list in the WhatsApp chat " + language + " " + width, async ({ page }) => {
    await open(page, language, width, "/whatsapp/chat", "forms-chat-dependent");
    await page.getByRole("button", { name: "Juan Gómez", exact: true }).click();
    await page.getByRole("button", { name: text(language, "Enviar formulario", "Send form"), exact: true }).click();
    const dialog = page.getByRole("dialog");
    // The form and its question go in the recipient's language (Spanish here); the reason, in the menu's.
    const sowing = dialog.getByRole("radio", { name: /Siembra/ });
    await expect(sowing).toBeDisabled();
    await expect(dialog.getByText(text(language, "«Lote» depende de otra respuesta: se carga desde la app", "«Lote» depends on another answer: it is loaded in the app"), { exact: true })).toBeVisible();
    await noPageScroll(page, width);
    await page.screenshot({ path: "test-results/cw7-chat-" + language + "-" + width + ".png", fullPage: true });
  });
}
