import { expect, test, type Page } from "@playwright/test";
import { fixtureFormId } from "./formFixtures";

// W3 (UC1-A), evidence without goldens: «Ubicación y contacto» in the editor of «Registrar entrega», es/en at 1440, 390 and 320 px: the
// zone with the questions chosen and its (i), the zone gone with «Sólo en la app», the location row off with its reason beside a
// question «Ubicación» (pointer and keyboard) and the zone read only. Each capture is compared with the board UC1-A.
type Language = "es" | "en";
const text = (language: Language, es: string, en: string) => language === "es" ? es : en;
async function open(page: Page, language: Language, width: number, scenario: string) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen: "/formularios/" + fixtureFormId, scenario, lang: language }));
  await expect(page.getByRole("heading", { name: text(language, "Registrar entrega", "Register delivery"), exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  if (width < 768) {
    const menu = page.getByRole("button", { name: text(language, "Menú de navegación", "Navigation menu"), exact: true });
    if (await menu.getAttribute("aria-expanded") === "true") await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
  }
  const zone = page.getByRole("region", { name: text(language, "Ubicación y contacto", "Location and contact"), exact: true });
  await zone.scrollIntoViewIfNeeded();
  return zone;
}
const noPageScroll = async (page: Page, width: number) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
const rows = (language: Language) => [text(language, "Ubicación", "Location"), text(language, "Nombre del contacto", "Contact name"), text(language, "Teléfono del contacto", "Contact phone")];

for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test("UC1-A the zone in the editor " + language + " " + width, async ({ page }) => {
    const zone = await open(page, language, width, "forms-location-contact");
    // After «Preguntas», one row per datum with the question that receives it.
    const questions = page.getByRole("region", { name: text(language, "Preguntas", "Questions"), exact: true });
    expect(await questions.evaluate((element, other) => !!(element.compareDocumentPosition(other!) & Node.DOCUMENT_POSITION_FOLLOWING), await zone.elementHandle())).toBe(true);
    // The Picker of each row says its label and the question chosen.
    const selects = rows(language).map(name => zone.getByRole("button", { name: new RegExp("^" + name + " ") }));
    for (const select of selects) await expect(select).not.toHaveAccessibleName(/ (Ninguna|None)$/);
    // On the phone each list goes across and is 44 px tall; from 640 px it is as wide as the board's.
    for (const select of selects) {
      const box = (await select.boundingBox())!;
      if (width < 640) expect(box.height).toBeGreaterThanOrEqual(44);
      else expect(box.width).toBeLessThan(300);
    }
    await noPageScroll(page, width);
    await zone.screenshot({ path: "test-results/visual/location-contact-" + language + "-" + width + ".png" });
    // How it works is in the (i) of the title.
    await zone.getByRole("button", { name: text(language, "Más información sobre Ubicación y contacto", "More about Location and contact"), exact: true }).click();
    await expect(page.getByRole("tooltip")).toContainText(text(language, "Sin una pregunta elegida, quedan en el chat.", "With no question chosen, they stay in the chat."));
    await noPageScroll(page, width);
    await page.screenshot({ path: "test-results/visual/location-contact-help-" + language + "-" + width + ".png" });
    await page.keyboard.press("Escape");

    // «Sólo en la app»: the zone does not show.
    await page.getByRole("group", { name: text(language, "Dónde se completa", "Where it is completed"), exact: true })
      .getByRole("button", { name: text(language, "Sólo en la app", "Only in the app"), exact: true }).click();
    await expect(zone).toHaveCount(0);
    await noPageScroll(page, width);
    await page.screenshot({ path: "test-results/visual/location-contact-app-only-" + language + "-" + width + ".png", fullPage: true });
  });

  test("UC1-A the location row beside a question «Ubicación» and read only " + language + " " + width, async ({ page }) => {
    const zone = await open(page, language, width, "forms-location-contact-location");
    const [location, name] = rows(language);
    const select = zone.getByRole("button", { name: new RegExp("^" + location + " ") });
    await expect(select).toBeDisabled();
    await expect(zone.getByRole("button", { name: new RegExp("^" + name + " ") })).toBeEnabled();
    // The reason opens over the row, with the pointer on its envelope and with the focus on it.
    const reason = text(language, "La ubicación va a la pregunta «Ubicación», que se pide antes de mandar el formulario.", "The location goes to the “Location” question, which is asked for before the form is sent.");
    const envelope = zone.getByRole("group", { name: location, exact: true });
    await envelope.hover();
    await expect(page.getByRole("tooltip")).toContainText(reason);
    if (width < 640) expect((await select.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await noPageScroll(page, width);
    await page.screenshot({ path: "test-results/visual/location-contact-location-" + language + "-" + width + ".png" });
    // The pointer leaves in steps (Radix closes it outside its grace area); then the keyboard reaches the envelope.
    const box = (await zone.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height + 40, { steps: 8 });
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await envelope.focus();
    await expect(page.getByRole("tooltip")).toContainText(reason);
    await page.keyboard.press("Escape");

    // Read only: each row says its question, without lists.
    const readOnly = await open(page, language, width, "forms-location-contact-read");
    await expect(readOnly.getByRole("button", { name: new RegExp("^(" + rows(language).join("|") + ") ") })).toHaveCount(0);
    await expect(readOnly.getByRole("definition")).toHaveText([text(language, "Dirección de entrega (pregunta 1)", "Delivery address (question 1)"),
      text(language, "Recibió (pregunta 2)", "Received by (question 2)"), text(language, "Teléfono de quien recibe (pregunta 3)", "Recipient's phone (question 3)")]);
    await noPageScroll(page, width);
    await readOnly.screenshot({ path: "test-results/visual/location-contact-read-" + language + "-" + width + ".png" });
  });
}
