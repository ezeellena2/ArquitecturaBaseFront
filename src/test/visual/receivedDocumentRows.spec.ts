import { expect, test, type Page } from "@playwright/test";
import { receivedDocumentRowIds } from "./receivedDocumentFixtures";

// VC1-A «Una entrada por fila» with the real route, es/en at 1440, 390 and 320 px, with goldens: the inbox with the rows of two spreadsheets
// (each one its spreadsheet with «Fila 5» in grey below, «Ventas · fila 3» in a book with two sheets, «Para revisar» and «Propuesto»); the
// panel of a row for review, with «La fila» as it came and «Descargar la planilla» in the place of the viewer; and a row its person was
// sent, with «Descartar» and «Pasar al formulario» off and the reason that names the row. The page never scrolls sideways (the table does,
// inside its box). Each capture is compared with VC1-A and VC3.
type Language = "es" | "en";
const text = (language: Language, es: string, en: string) => language === "es" ? es : en;
const panelOf = (page: Page, language: Language, width: number) => page.getByRole(width < 640 ? "dialog" : "region", { name: text(language, "Documento", "Document"), exact: true });
async function open(page: Page, language: Language, width: number, documentId?: string) {
  await page.setViewportSize({ width, height: width < 640 ? 1100 : 960 });
  await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen: "/formularios/documentos" + (documentId ? "/" + documentId : ""), scenario: "documents-rows", lang: language }));
  await expect(documentId ? panelOf(page, language, width) : page.getByRole("heading", { level: 1, name: text(language, "Documentos recibidos", "Received documents"), exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  if (width < 768 && !documentId) {
    const menu = page.getByRole("button", { name: text(language, "Menú de navegación", "Navigation menu"), exact: true });
    if (await menu.getAttribute("aria-expanded") === "true") await menu.click();
  }
}
const noPageScroll = async (page: Page, width: number) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);

for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test(`VC1-A the inbox with the rows of a spreadsheet ${language} ${width}`, async ({ page }) => {
    await open(page, language, width);
    const table = page.getByRole("table");
    await expect(table.getByRole("row")).toHaveCount(11);
    await expect(table.getByText(text(language, "Fila 2", "Row 2"), { exact: true })).toBeVisible();
    await expect(table.getByText(text(language, "Ventas · fila 3", "Sales · row 3"), { exact: true })).toBeVisible();
    await noPageScroll(page, width);
    await expect(page).toHaveScreenshot(`document-rows-${language}-${width}.png`, { fullPage: true });
  });

  test(`VC1-A the row for review with «La fila» ${language} ${width}`, async ({ page }) => {
    await open(page, language, width, receivedDocumentRowIds.overLimit);
    const panel = panelOf(page, language, width);
    const row = panel.getByRole("region", { name: text(language, "La fila", "The row"), exact: true });
    await expect(row.getByText(text(language, "Kiosco El Sol", "El Sol kiosk"), { exact: true })).toBeVisible();
    await expect(row.getByRole("button", { name: text(language, "Descargar la planilla", "Download the spreadsheet"), exact: true })).toBeEnabled();
    await expect(panel.getByText(text(language, "Pasó el tope de 3 cargas por mensaje.", "It went over the limit of 3 loads per message."), { exact: true })).toBeVisible();
    await expect(panel.getByRole("button", { name: text(language, "Pasar al formulario", "Pass to the form"), exact: true })).toBeEnabled();
    await noPageScroll(page, width);
    await expect(page).toHaveScreenshot(`document-row-${language}-${width}.png`);
  });

  test(`VC1-A a row its person was sent, with its actions off and the reason ${language} ${width}`, async ({ page }) => {
    await open(page, language, width, receivedDocumentRowIds.load);
    const panel = panelOf(page, language, width);
    const pass = panel.getByRole("button", { name: text(language, "Pasar al formulario", "Pass to the form"), exact: true });
    await expect(pass).toHaveAttribute("aria-disabled", "true");
    await pass.focus();
    await expect(page.getByRole("tooltip")).toContainText(text(language, "Le mandamos esta fila a Marta Ruiz", "We sent this row to Marta Ruiz"));
    await noPageScroll(page, width);
    await expect(page).toHaveScreenshot(`document-row-waiting-${language}-${width}.png`);
  });
}
