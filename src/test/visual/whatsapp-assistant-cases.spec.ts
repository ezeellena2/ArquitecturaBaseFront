import { expect, test, type Page } from "@playwright/test";

// Casos del asistente in the operator's chat (board AS4): «Necesita una persona» in the row, the filter, the header and the strip;
// «Por qué respondió esto» under each answer; the lines of what the assistant decided without a message; and in Atención manual the
// text for the composer. es/en at 1440, 390 and 320 px, with the clock fixed and every conversation whole in its history.
const words = {
  es: { menu: "Menú de Ana Pérez", title: "Chat de WhatsApp", show: "Mostrar", filters: ["Todos", "Sin leer", "Necesita una persona"], mark: "Necesita una persona",
    reason: "Pide hablar con una persona.", why: "Por qué respondió esto", handoffLine: "El asistente derivó la conversación", limit: "Llegó al tope de respuestas del día",
    noReply: "Sin respuesta del asistente", history: "Historial de mensajes", tapped: "«Visita»", first: "1 de 2", second: "2 de 2", take: "Tomar atención manual",
    reply: "Respuesta al cliente", suggestion: "Sugerencia de respuesta", useAsDraft: "Usar como borrador", fallback: "Cualquier otra cosa",
    text: "Sí: al interior enviamos por transporte, a cargo del cliente. En CABA y GBA entregamos nosotros." },
  en: { menu: "Ana Pérez's menu", title: "WhatsApp chat", show: "Show", filters: ["All", "Unread", "Needs a person"], mark: "Needs a person",
    reason: "Asks to talk to a person.", why: "Why it replied this", handoffLine: "The assistant handed off the conversation", limit: "It reached the daily reply limit",
    noReply: "No reply from the assistant", history: "Message history", tapped: "«Visit»", first: "1 of 2", second: "2 of 2", take: "Take manual attention",
    reply: "Reply to customer", suggestion: "Reply suggestion", useAsDraft: "Use as draft", fallback: "Anything else",
    text: "Yes: we ship to other provinces by carrier, paid by the customer. In the city and the suburbs we deliver ourselves." },
} as const;
// Tall enough for the whole conversation: the history does not scroll and the capture shows it entire.
const heights: Record<string, Record<number, number>> = {
  "chat-ana": { 1440: 1300, 390: 2000, 320: 2260 }, "chat-juan": { 1440: 1400, 390: 2080, 320: 2340 },
  "chat-marta": { 1440: 900, 390: 1100, 320: 1200 }, inbox: { 390: 900, 320: 900 },
};

async function open(page: Page, language: "es" | "en", width: number, conversation?: string) {
  await page.setViewportSize({ width, height: heights[conversation ?? "inbox"][width] });
  await page.clock.setFixedTime(new Date("2026-11-11T15:42:00Z"));
  await page.goto(`/src/test/visual/index.html?screen=${encodeURIComponent("/whatsapp/chat" + (conversation ? "?conversacion=" + conversation : ""))}&scenario=chat-assistant-cases&lang=${language}`);
  await page.getByRole("button", { name: words[language].menu, exact: true }).waitFor({ state: "visible" });
  await expect(page.getByRole("heading", { level: 1, name: words[language].title })).toBeVisible();
}
async function settle(page: Page, width: number) {
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
}
async function wholeHistory(page: Page, language: "es" | "en") {
  const history = page.getByLabel(words[language].history, { exact: true });
  await expect.poll(() => history.evaluate(node => node.scrollHeight - node.clientHeight)).toBeLessThanOrEqual(1);
  return history;
}

for (const language of ["es", "en"] as const) {
  const text = words[language];
  for (const width of [1440, 390, 320]) {
    test(`a conversation that needs a person in ${language} at ${width}px`, async ({ page }) => {
      await open(page, language, width, "chat-ana");
      const header = page.locator("header").filter({ has: page.getByRole("heading", { name: "Ana Martínez" }) });
      await expect(header.getByText(text.mark, { exact: true })).toBeVisible();
      const strip = page.getByRole("status").filter({ hasText: text.reason });
      await expect(strip).toBeVisible();
      const history = await wholeHistory(page, language);
      await expect(history.getByText(text.why, { exact: true })).toHaveCount(2);
      await expect(history.getByText(text.handoffLine, { exact: true })).toBeVisible();
      await expect(history.getByText(text.limit, { exact: true })).toBeVisible();
      await expect(history.getByText(text.fallback, { exact: true })).toHaveCount(2);
      if (width === 1440) {
        // «Mostrar» is the button of the bar of the piece to choose (2026-11-22): it says the chosen one, without counts.
        await expect(page.getByRole("button", { name: text.show + " " + text.filters[0], exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Ana Martínez", exact: true }).locator("xpath=..").getByText(text.mark, { exact: true })).toBeVisible();
      }
      await settle(page, width);
      await expect(page).toHaveScreenshot(`whatsapp-assistant-handoff-${language}-${width}.png`, { fullPage: true });
      if (width === 1440) {
        await page.getByRole("button", { name: text.show + " " + text.filters[0], exact: true }).click();
        await page.getByRole("listbox", { name: text.show, exact: true }).getByRole("option", { name: text.filters[2], exact: true }).click();
        await expect(page.getByRole("button", { name: text.show + " " + text.filters[2], exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Juan Gómez", exact: true })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Ana Martínez", exact: true })).toBeVisible();
      }
    });

    test(`the assistant's answers and lines in ${language} at ${width}px`, async ({ page }) => {
      await open(page, language, width, "chat-juan");
      const history = await wholeHistory(page, language);
      await expect(history.getByText(text.why, { exact: true })).toHaveCount(3);
      await expect(history.getByText(text.first, { exact: true })).toBeVisible();
      await expect(history.getByText(text.second, { exact: true })).toBeVisible();
      await expect(history.getByText(text.tapped, { exact: true })).toBeVisible();
      await expect(history.getByText(text.noReply, { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: text.take, exact: true })).toBeVisible();
      await settle(page, width);
      await expect(page).toHaveScreenshot(`whatsapp-assistant-replies-${language}-${width}.png`, { fullPage: true });
    });

    test(`a text for the composer in ${language} at ${width}px`, async ({ page }) => {
      await open(page, language, width, "chat-marta");
      const card = page.getByRole("region", { name: text.suggestion, exact: true });
      await expect(card.getByText(text.text, { exact: true })).toBeVisible();
      await expect(card.getByText(text.fallback, { exact: true })).toBeVisible();
      await settle(page, width);
      await expect(page).toHaveScreenshot(`whatsapp-assistant-draft-${language}-${width}.png`, { fullPage: true });
      await card.getByRole("button", { name: text.useAsDraft, exact: true }).click();
      await expect(page.getByRole("textbox", { name: text.reply, exact: true })).toHaveValue(text.text);
      await expect(page.getByRole("textbox", { name: text.reply, exact: true })).toBeFocused();
      await expect(card).toHaveCount(0);
      expect(await page.evaluate(() => (globalThis as unknown as { chatAssistantFixture: { discards: string[] } }).chatAssistantFixture.discards)).toEqual(["chat-marta"]);
      await page.screenshot({ path: `test-results/visual/whatsapp-assistant-draft-used-${language}-${width}.png`, fullPage: true });
    });
  }

  for (const width of [390, 320]) {
    test(`the inbox with the mark and the filter in ${language} at ${width}px`, async ({ page }) => {
      await open(page, language, width);
      await expect(page.getByRole("button", { name: text.show + " " + text.filters[0], exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Ana Martínez", exact: true }).locator("xpath=..").getByText(text.mark, { exact: true })).toBeVisible();
      await settle(page, width);
      await expect(page).toHaveScreenshot(`whatsapp-assistant-list-${language}-${width}.png`, { fullPage: true });
    });
  }
}
