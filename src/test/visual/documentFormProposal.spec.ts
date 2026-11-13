import { expect, test, type Page } from "@playwright/test";
import { documentFormProposalIds } from "./documentFormProposalFixtures";

// DOC6 «Armar formulario con la IA» with the real routes, es/en at 1440, 390 and 320 px, with goldens: the notice of similar documents
// above the inbox; a request while the AI builds the form (the zones that are coming, with the ring and its gerund, and the documents in
// their place); its proposal (the form, one question per row with what it read in the first ticket, and the documents with the chosen one
// in the viewer); and a request that failed, with nothing to create. The page never scrolls sideways. Each capture is compared with DOC6.
type Language = "es" | "en";
const text = (language: Language, es: string, en: string) => language === "es" ? es : en;
const proposalPath = (requestId: string) => `/formularios/documentos/armar/${requestId}`;

async function open(page: Page, language: Language, width: number, scenario: string, screen: string, heading: string) {
  await page.setViewportSize({ width, height: width < 640 ? 1100 : 960 });
  await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen, scenario, lang: language }));
  await expect(page.getByRole("heading", { level: 1, name: heading, exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  if (width < 768) {
    const menu = page.getByRole("button", { name: text(language, "Menú de navegación", "Navigation menu"), exact: true });
    if (await menu.getAttribute("aria-expanded") === "true") await menu.click();
  }
}
const title = (language: Language) => text(language, "Armar formulario con la IA", "Build a form with AI");
const noPageScroll = async (page: Page, width: number) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
// The documents of the request, with the first ticket in the viewer.
async function documents(page: Page, language: Language) {
  const zone = page.getByRole("region", { name: text(language, "Documentos (5)", "Documents (5)"), exact: true });
  await expect(zone.getByRole("img", { name: "ticket.jpg" })).toBeVisible();
  await expect(zone.getByRole("table").getByRole("row")).toHaveCount(6);
  return zone;
}

for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test(`DOC6 the notice of similar documents above the inbox ${language} ${width}`, async ({ page }) => {
    await open(page, language, width, "document-form-notice", "/formularios/documentos", text(language, "Documentos recibidos", "Received documents"));
    await expect(page.getByText(text(language, "Llegaron 5 documentos parecidos que no encajan en ningún formulario: tickets de combustible.",
      "5 similar documents arrived that fit no form: fuel tickets."), { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: text(language, "Armar formulario con la IA: tickets de combustible", "Build a form with AI: fuel tickets"), exact: true })).toBeVisible();
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(11);
    await noPageScroll(page, width);
    await expect(page).toHaveScreenshot(`document-form-notice-${language}-${width}.png`, { fullPage: true });
  });

  test(`DOC6 a request while the AI builds the form ${language} ${width}`, async ({ page }) => {
    await open(page, language, width, "document-form-pending", proposalPath(documentFormProposalIds.pending), title(language));
    await expect(page.getByText(text(language, "La IA está leyendo los 5 documentos y armando la propuesta…", "The AI is reading the 5 documents and building the proposal…"), { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: text(language, "Crear borrador", "Create draft"), exact: true })).toHaveAttribute("aria-disabled", "true");
    await documents(page, language);
    await noPageScroll(page, width);
    await expect(page).toHaveScreenshot(`document-form-pending-${language}-${width}.png`, { fullPage: true });
  });

  test(`DOC6 the proposal ${language} ${width}`, async ({ page }) => {
    await open(page, language, width, "document-form-proposal", proposalPath(documentFormProposalIds.completed), title(language));
    await expect(page.getByRole("textbox", { name: new RegExp("^" + text(language, "Nombre", "Name")) })).toHaveValue(text(language, "Tickets de combustible", "Fuel tickets"));
    const questions = page.getByRole("region", { name: text(language, "Preguntas (8)", "Questions (8)"), exact: true });
    await expect(questions.getByRole("table").getByRole("row")).toHaveCount(9);
    await expect(page.getByRole("button", { name: text(language, "Crear borrador", "Create draft"), exact: true })).not.toHaveAttribute("aria-disabled");
    await documents(page, language);
    await noPageScroll(page, width);
    await expect(page).toHaveScreenshot(`document-form-proposal-${language}-${width}.png`, { fullPage: true });
  });

  test(`DOC6 a request that failed ${language} ${width}`, async ({ page }) => {
    await open(page, language, width, "document-form-failed", proposalPath(documentFormProposalIds.failed), title(language));
    await expect(page.getByText(text(language, "No se pudo armar la propuesta.", "The proposal could not be built."), { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: text(language, "Volver a pedir", "Ask again"), exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: text(language, "Crear borrador", "Create draft"), exact: true })).toHaveCount(0);
    await documents(page, language);
    await noPageScroll(page, width);
    await expect(page).toHaveScreenshot(`document-form-failed-${language}-${width}.png`, { fullPage: true });
  });
}
