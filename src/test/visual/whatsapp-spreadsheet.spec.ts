import { expect, test, type Page } from "@playwright/test";

// Stage 2 of the assistant authoring: in the operator's chat, a received spreadsheet shows its name with the file icon and its
// caption below; one without caption shows only its name, and one whose content expired says so. The list keeps the generic
// preview. es/en at 1440, 390 and 320 px.
for (const language of ["es", "en"] as const)
  for (const width of [1440, 390, 320]) {
    test(`chat spreadsheet ${language} ${width}`, async ({ page }) => {
      const es = language === "es";
      await page.setViewportSize({ width, height: 900 });
      await page.clock.install({ time: new Date("2026-10-02T12:10:00Z") });
      await page.goto(`/src/test/visual/index.html?screen=/whatsapp/chat&scenario=chat-spreadsheet&lang=${language}`);
      const contact = page.getByRole("button", { name: "Ana Martínez", exact: true });
      await expect(contact).toBeVisible();
      await expect(page.getByText(es ? "Planilla" : "Spreadsheet", { exact: true })).toBeVisible();
      await contact.click();
      const history = page.getByLabel(es ? "Historial de mensajes" : "Message history", { exact: true });
      await expect(history.getByText(es ? "contratistas.xlsx" : "contractors.xlsx", { exact: true })).toBeVisible();
      await expect(history.getByText(es ? "Armame un catálogo de contratistas con esta planilla" : "Make me a catalog of contractors with this spreadsheet",
        { exact: true })).toBeVisible();
      await expect(history.getByText("zonas.csv", { exact: true })).toBeVisible();
      await expect(history.getByText(es ? "Ya no está disponible." : "It is no longer available.", { exact: true })).toBeVisible();
      await expect(history.getByText(es ? /de otro tipo/ : /other message/)).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
      await expect(page).toHaveScreenshot(`whatsapp-spreadsheet-${language}-${width}.png`, { fullPage: true });
    });
  }

// Task 8 of the documents (DOC2 and DOC4), with the bodies the backend writes (`chatDocumentFixtures`). In a linked conversation a PDF
// shows its name with its pages and its caption below, a photo WhatsApp sent without a file name is «Foto», a Word says so, and the one
// whose content expired, the oldest, is in sight with the history at the top. Without a linked account, what came in a row has the line
// of DOC4 once, under the last, which it describes. No document falls back to «Mensaje documento». es/en at 1440, 390 and 320 px.
const documentWords = {
  es: { history: "Historial de mensajes", region: "documento", pdf: "comprobante-la-posta.pdf", pages: "PDF · 2 páginas", caption: "Te paso el pago de La Posta",
    photo: "Foto", gone: "Ya no está disponible.", fallback: "Mensaje documento", budget: "presupuesto-firmado.pdf", receipt: "Te mando el comprobante de la seña",
    notRead: "No se leyó: el número no tiene una cuenta vinculada. Lo atiende un operador." },
  en: { history: "Message history", region: "document", pdf: "la-posta-payment.pdf", pages: "PDF · 2 pages", caption: "Here is the payment from La Posta",
    photo: "Photo", gone: "It is no longer available.", fallback: "document message", budget: "signed-quote.pdf", receipt: "I am sending you the deposit receipt",
    notRead: "Not read: the number has no linked account. An operator will handle it." },
} as const;
async function openDocuments(page: Page, language: "es" | "en", width: number, conversation: string) {
  // As tall as the spreadsheets: in the celular the history opens at the bottom and the one that expired is scrolled up.
  await page.setViewportSize({ width, height: 900 });
  await page.clock.install({ time: new Date("2026-10-02T12:10:00Z") });
  await page.goto(`/src/test/visual/index.html?screen=${encodeURIComponent("/whatsapp/chat?conversacion=" + conversation)}&scenario=chat-document&lang=${language}`);
  const history = page.getByLabel(documentWords[language].history, { exact: true });
  await expect(history.getByRole("article").first()).toBeVisible();
  return history;
}
async function settle(page: Page, width: number) {
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
}
for (const language of ["es", "en"] as const)
  for (const width of [1440, 390, 320]) {
    const words = documentWords[language];
    test(`chat document ${language} ${width}`, async ({ page }) => {
      const history = await openDocuments(page, language, width, "chat-ana");
      await expect(history.getByText(words.pdf, { exact: true })).toBeVisible();
      await expect(history.getByText(words.pages, { exact: true })).toBeVisible();
      await expect(history.getByText(words.caption, { exact: true })).toBeVisible();
      await expect(history.getByText(words.photo, { exact: true })).toHaveCount(1);
      await expect(history.getByText("Word", { exact: true })).toBeVisible();
      await expect(history.getByText(words.fallback, { exact: true })).toHaveCount(0);
      await expect(history.getByText(words.notRead, { exact: true })).toHaveCount(0);
      await settle(page, width);
      await expect(page).toHaveScreenshot(`whatsapp-document-${language}-${width}.png`, { fullPage: true });
      await history.evaluate(node => { node.scrollTop = 0; });
      await expect(history.getByRole("region", { name: words.region, exact: true }).filter({ hasText: words.gone })).toBeInViewport();
      await expect(page).toHaveScreenshot(`whatsapp-document-top-${language}-${width}.png`, { fullPage: true });
    });
    test(`chat document not read ${language} ${width}`, async ({ page }) => {
      const history = await openDocuments(page, language, width, "chat-carlos");
      await expect(history.getByText(words.notRead, { exact: true })).toHaveCount(1);
      await expect(history.getByText(words.budget, { exact: true })).toBeVisible();
      await expect(history.getByText(words.receipt, { exact: true })).toBeVisible();
      const messages = history.getByRole("article");
      await expect(messages.last()).toHaveAccessibleDescription(words.notRead);
      await expect(messages.nth(1)).not.toHaveAttribute("aria-describedby");
      await expect(history.getByText(words.fallback, { exact: true })).toHaveCount(0);
      await settle(page, width);
      await expect(page).toHaveScreenshot(`whatsapp-document-not-read-${language}-${width}.png`, { fullPage: true });
    });
  }
