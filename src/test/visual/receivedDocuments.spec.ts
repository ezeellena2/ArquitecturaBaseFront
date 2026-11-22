import { expect, test, type Page } from "@playwright/test";
import { receivedDocumentIds } from "./receivedDocumentFixtures";

// DOC5-A, evidence without goldens (test-results/documents): «Documentos recibidos» with the real route, es/en at 1440, 390 and 320 px:
// the list with one datum per column, the panel with the comprobante as a photo (brought closer and turned), the PDF in the browser's
// viewer, a document its person was sent with its actions off and their reason, a rejected file without its copy, the panel read only,
// the history, «Filtros» with the form and the person, and the empty, no matches and error states. The table scrolls sideways inside its box and the page never does. Each capture is compared with DOC5-A.
type Language = "es" | "en";
const text = (language: Language, es: string, en: string) => language === "es" ? es : en;
const shot = (name: string, language: Language, width: number) => `test-results/documents/${name}-${language}-${width}.png`;
const panelOf = (page: Page, language: Language, width: number) => page.getByRole(width < 640 ? "dialog" : "region", { name: text(language, "Documento", "Document"), exact: true });
// The inbox, or a document of it: on the phone the document opens on its own screen, a dialog that hides the page behind it.
async function open(page: Page, language: Language, width: number, scenario: string, documentId?: string) {
  await page.setViewportSize({ width, height: width < 640 ? 1100 : 960 });
  await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen: "/formularios/documentos" + (documentId ? "/" + documentId : ""), scenario, lang: language }));
  await expect(documentId ? panelOf(page, language, width) : page.getByRole("heading", { level: 1, name: text(language, "Documentos recibidos", "Received documents"), exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  if (width < 768 && !documentId) {
    const menu = page.getByRole("button", { name: text(language, "Menú de navegación", "Navigation menu"), exact: true });
    if (await menu.getAttribute("aria-expanded") === "true") await menu.click();
  }
}
const noPageScroll = async (page: Page, width: number) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);

for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test(`DOC5-A the inbox and its panel ${language} ${width}`, async ({ page }) => {
    await open(page, language, width, "documents");
    const table = page.getByRole("table");
    await expect(table.getByRole("row")).toHaveCount(11);
    // The state is the button of the bar of the piece to choose (2026-11-22): it says the chosen one, without counts.
    await expect(page.getByRole("button", { name: text(language, "Estado Todos", "State All"), exact: true })).toBeVisible();
    // The table scrolls inside its box: the page does not.
    await noPageScroll(page, width);
    await page.screenshot({ path: shot("documents", language, width), fullPage: true });

    // The comprobante that Pablo Sosa did not confirm, in the panel: the photo, why it is for review, its form and its data.
    await table.getByRole("row").filter({ hasText: "Pablo Sosa" }).filter({ hasText: text(language, "Para revisar", "To review") }).getByRole("link").click();
    const panel = panelOf(page, language, width);
    const photo = panel.getByRole("img", { name: "comprobante.jpg" });
    await expect(photo).toBeVisible();
    // The form is the only piece to choose (DS1-A): a button named by its label and the form chosen.
    await expect(panel.getByRole("button", { name: text(language, "Formulario Pagos de clientes", "Form Customer payments"), exact: true })).toBeVisible();
    await expect(panel.getByRole("button", { name: text(language, "Pasar al formulario", "Pass to the form"), exact: true })).toBeVisible();
    await noPageScroll(page, width);
    await page.screenshot({ path: shot("document-photo", language, width) });
    // Closer and turned, inside its box.
    await panel.getByRole("button", { name: text(language, "Acercar", "Zoom in"), exact: true }).click();
    await panel.getByRole("button", { name: text(language, "Girar", "Rotate"), exact: true }).click();
    await expect(panel.getByText("150%", { exact: true })).toBeVisible();
    await panel.getByRole("toolbar").screenshot({ path: shot("document-toolbar", language, width) });
    await panel.getByRole("region", { name: text(language, "Foto comprobante.jpg", "Photo comprobante.jpg"), exact: true }).screenshot({ path: shot("document-photo-turned", language, width) });
    // The actions stay at the bottom, out of the scroll, also on the phone.
    const pass = panel.getByRole("button", { name: text(language, "Pasar al formulario", "Pass to the form"), exact: true });
    const [panelBox, passBox] = [(await panel.boundingBox())!, (await pass.boundingBox())!];
    expect(panelBox.y + panelBox.height - (passBox.y + passBox.height)).toBeLessThan(24);
    if (width < 640) expect(passBox.height).toBeGreaterThanOrEqual(30);
    await panel.getByRole("button", { name: text(language, "Ver los 7 datos más", "See the 7 more data"), exact: true }).click();
    await panel.evaluate(node => node.querySelector(".overflow-y-auto")?.scrollTo(0, 99999));
    await page.screenshot({ path: shot("document-data", language, width) });
    await panel.getByRole("tab", { name: text(language, "Historial (1)", "History (1)"), exact: true }).click();
    await expect(panel.getByText(text(language, "Llegó y la IA lo reconoció", "Arrived and the AI recognized it"), { exact: true })).toBeVisible();
    await page.screenshot({ path: shot("document-history", language, width) });

    // The PDF, in the browser's viewer, and confirmed with its response.
    await open(page, language, width, "documents", receivedDocumentIds.pdf);
    const pdf = panelOf(page, language, width);
    await expect(pdf.getByTitle("PDF comprobante-nacion.pdf")).toBeVisible();
    await expect(pdf.getByRole("link", { name: "REC-000124", exact: true })).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: shot("document-pdf", language, width) });

    // A document its person was sent: its actions in place, off, with the reason over them (VC1-A).
    await open(page, language, width, "documents", receivedDocumentIds.waiting);
    const waiting = panelOf(page, language, width);
    const waitingPass = waiting.getByRole("button", { name: text(language, "Pasar al formulario", "Pass to the form"), exact: true });
    await expect(waitingPass).toHaveAttribute("aria-disabled", "true");
    await waitingPass.focus();
    await expect(page.getByRole("tooltip")).toContainText(text(language, "Le mandamos este documento a Juan Gómez", "We sent this document to Juan Gómez"));
    await page.screenshot({ path: shot("document-waiting", language, width) });

    // A rejected file the inbox kept no copy of: its name and its reason, with nothing to see or download.
    await open(page, language, width, "documents", receivedDocumentIds.rejected);
    const rejected = panelOf(page, language, width);
    await expect(rejected.getByText(text(language, "Es de un formato viejo: no se pudo abrir.", "It has an old format: it could not be opened."), { exact: true })).toBeVisible();
    await expect(rejected.getByRole("toolbar")).toHaveCount(0);
    await page.screenshot({ path: shot("document-rejected", language, width) });
  });

  test(`DOC5-A read only, empty, no matches and error ${language} ${width}`, async ({ page }) => {
    await open(page, language, width, "documents-read", receivedDocumentIds.forReview);
    const panel = panelOf(page, language, width);
    await expect(panel.getByRole("img", { name: "comprobante.jpg" })).toBeVisible();
    await expect(panel.getByRole("button", { name: text(language, "Pasar al formulario", "Pass to the form"), exact: true })).toHaveCount(0);
    // Read only, nothing is chosen: neither the form nor a choice is a list.
    await expect(panel.getByRole("button", { name: new RegExp("^(" + text(language, "Formulario|Cliente|Moneda|Banco o billetera de origen",
      "Form|Customer|Currency|Bank or wallet of origin") + ") ") })).toHaveCount(0);
    await page.screenshot({ path: shot("document-read-only", language, width) });

    await open(page, language, width, "documents-empty");
    await expect(page.getByText(text(language, "Todavía no llegaron documentos", "No documents have arrived yet"), { exact: true })).toBeVisible();
    await page.screenshot({ path: shot("documents-empty", language, width) });

    // «Filtros»: the form and the person, with the options the page brings, and when it arrived.
    await open(page, language, width, "documents");
    await page.getByRole("button", { name: text(language, "Filtros", "Filters"), exact: true }).click();
    if (width < 640) await page.getByRole("button", { name: text(language, "Formulario", "Form"), exact: true }).click();
    // The filter is the only piece to choose (DS1-A): a button named by the filter and what is chosen. It is looked for in
    // «Filtros», because the menu has «Form management» in English.
    const filters = page.getByRole("dialog", { name: text(language, "Filtros", "Filters"), exact: true });
    await filters.getByRole("button", { name: new RegExp("^" + text(language, "Formulario", "Form") + " ") }).click();
    await expect(page.getByRole("option", { name: text(language, "Pagos de clientes", "Customer payments"), exact: true })).toBeVisible();
    await page.screenshot({ path: shot("documents-filters", language, width) });
    await page.getByRole("option", { name: text(language, "Pagos de clientes", "Customer payments"), exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByText(text(language, "Formulario: Pagos de clientes", "Form: Customer payments"), { exact: true })).toBeVisible();
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(7);
    await noPageScroll(page, width);
    await page.screenshot({ path: shot("documents-filtered", language, width) });

    await open(page, language, width, "documents");
    await page.getByRole("searchbox", { name: text(language, "Monto, CUIT u operación", "Amount, CUIT or operation"), exact: true }).fill("777777");
    await expect(page.getByText(text(language, "Ningún documento coincide", "No document matches"), { exact: true })).toBeVisible();
    await noPageScroll(page, width);
    await page.screenshot({ path: shot("documents-no-matches", language, width) });

    await open(page, language, width, "documents-error");
    await expect(page.getByText(text(language, "No pudimos cargar los documentos.", "We could not load the documents."), { exact: true }).first()).toBeVisible();
    await page.screenshot({ path: shot("documents-error", language, width) });
  });
}
