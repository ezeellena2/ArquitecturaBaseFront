import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectNoSideScroll } from "./chartGeometry";

// W3 in the operator's chat (UC2 to UC6), with the shapes the backend will write (`chatSharedContentFixtures`). Juan shared the place and
// the contact of a delivery: the place is the point with «Ver en el mapa», as in W1-A, and the contact its card, with the name in bold
// and the two phones below, one per line; each one brought the form back with «Prellenado con» in its card. He answered the form and
// later the one that came back: the second response says which one was kept, with its number whole. Marta, without a form open: a
// contact without a name is «Contacto», with a long phone that breaks only at its spaces, one without a phone is its name alone, the old
// one «Mensaje de contacto», and the list says «Contacto». Nothing is «Mensaje de otro tipo» and nothing around the contacts, «Prellenado
// con» or the second response scrolls sideways (every box that scrolls or cuts, up to the document). es/en at 1440, 390 and 320 px, with
// golden like the other scenes of the chat: Juan's history where it opens, with the contact and with the second resend in sight, and
// Marta's.
const words = {
  es: { history: "Historial de mensajes", contact: "Contacto: Raúl Medina", prefilled: "Prellenado con", kept: "Guardada como ENT-000031",
    second: "No se guardó: el envío ya tiene su respuesta, ENT-000031.", nameless: "Contacto", noPhone: "Contacto: Recepción Depósito Norte",
    expired: "Mensaje de contacto", preview: "Contacto", fallback: "Mensaje de otro tipo" },
  en: { history: "Message history", contact: "Contact: Raúl Medina", prefilled: "Prefilled with", kept: "Saved as ENT-000031",
    second: "Not saved: the send already has its response, ENT-000031.", nameless: "Contact", noPhone: "Contact: North Warehouse Front Desk",
    expired: "contact message", preview: "Contact", fallback: "other message" },
} as const;
async function open(page: Page, language: "es" | "en", width: number, conversation?: string) {
  // As tall as the other scenes of the chat: in the celular the history opens at the bottom.
  await page.setViewportSize({ width, height: 900 });
  await page.clock.install({ time: new Date("2026-11-11T13:30:00Z") });
  const screen = conversation ? "/whatsapp/chat?conversacion=" + conversation : "/whatsapp/chat";
  await page.goto(`/src/test/visual/index.html?screen=${encodeURIComponent(screen)}&scenario=chat-shared-content&lang=${language}`);
}
const history = (page: Page, language: "es" | "en") => page.getByLabel(words[language].history, { exact: true });
// How many lines a text takes: a phone that fits takes one.
const lineCount = (text: Locator) => text.evaluate(node => { const range = document.createRange(); range.selectNodeContents(node);
  return new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size; });
// The groups of a text (what goes between its spaces) that are split over two lines: a phone or a number breaks only at its spaces.
// The element's text nodes are read as one run of text, so a list is checked value by value.
const splitGroups = (text: Locator) => text.evaluate(node => {
  const groups: { text: string; tops: Set<number> }[] = [];
  let group: { text: string; tops: Set<number> } | null = null;
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  for (let current = walker.nextNode(); current; current = walker.nextNode()) {
    const value = current.textContent ?? "";
    for (let index = 0; index < value.length; index++) {
      if (/\s/.test(value[index])) { group = null; continue; }
      const range = document.createRange();
      range.setStart(current, index);
      range.setEnd(current, index + 1);
      if (!group) groups.push(group = { text: "", tops: new Set() });
      group.text += value[index];
      for (const rect of range.getClientRects()) group.tops.add(Math.round(rect.top));
    }
  }
  return groups.filter(item => item.tops.size > 1).map(item => item.text);
});
for (const language of ["es", "en"] as const)
  for (const width of [1440, 390, 320]) {
    const w = words[language];
    test(`chat shared content ${language} ${width}`, async ({ page }) => {
      await open(page, language, width, "chat-juan");
      const thread = history(page, language);
      await expect(thread.getByRole("article").first()).toBeVisible();
      const contact = thread.getByRole("region", { name: w.contact, exact: true });
      await expect(contact).toBeVisible();
      const prefilled = thread.getByRole("group", { name: w.prefilled, exact: true });
      await expect(prefilled).toHaveCount(2);
      await expect(prefilled.last().getByText("Raúl Medina", { exact: true })).toBeVisible();
      const kept = thread.getByText(w.kept, { exact: true });
      const second = thread.getByText(w.second, { exact: true });
      await expect(kept).toBeVisible();
      await expect(second).toBeVisible();
      await expect(thread.getByText(w.fallback, { exact: true })).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      for (const phone of ["+54 9 341 555-0199", "+54 9 341 555-0142"]) expect(await lineCount(contact.locator("p", { hasText: phone }))).toBe(1);
      // The number of a response is a code: it moves whole to the next line, never «ENT-» / «000031».
      for (const line of [kept, second]) expect(await splitGroups(line)).toEqual([]);
      for (const part of [contact, prefilled.last(), second]) await expectNoSideScroll(part);
      await expect(page).toHaveScreenshot(`whatsapp-shared-content-${language}-${width}.png`, { fullPage: true });
      // In the celular the history scrolls: the contact, under the form the place brought back, and then the form the contact brought
      // back, whole, with its three values. Centered: leaving the bottom shows «Ir a los mensajes recientes», which shortens the history.
      await contact.evaluate(node => node.scrollIntoView({ block: "center" }));
      await expect(contact).toBeInViewport({ ratio: 0.95 });
      await expect(page).toHaveScreenshot(`whatsapp-shared-content-contact-${language}-${width}.png`, { fullPage: true });
      await prefilled.last().evaluate(node => node.scrollIntoView({ block: "center" }));
      await expect(prefilled.last()).toBeInViewport({ ratio: 0.95 });
      for (const value of await prefilled.last().locator("dd").all()) expect(await splitGroups(value)).toEqual([]);
      await expect(page).toHaveScreenshot(`whatsapp-shared-content-prefilled-${language}-${width}.png`, { fullPage: true });
    });
    test(`chat shared contacts ${language} ${width}`, async ({ page }) => {
      await open(page, language, width);
      const marta = page.getByRole("button", { name: "Marta Ruiz", exact: true });
      await expect(marta).toBeVisible();
      // The preview of the list is the server's text, under the button of the row.
      await expect(marta.locator("..").getByText(w.preview, { exact: true })).toBeVisible();
      await marta.click();
      const thread = history(page, language);
      const noPhone = thread.getByRole("region", { name: w.noPhone, exact: true });
      const nameless = thread.getByRole("region", { name: w.nameless, exact: true });
      await expect(noPhone).toBeVisible();
      await expect(nameless).toContainText("+54 9 (0341) 15-555-0177");
      await expect(thread.getByText(w.expired, { exact: true })).toBeVisible();
      await expect(thread.getByText(w.fallback, { exact: true })).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      // A long phone that does not fit breaks only at its spaces, never inside a group such as «(0341)» or «15-555-0177».
      expect(await splitGroups(nameless.locator("p", { hasText: "(0341)" }))).toEqual([]);
      for (const part of [noPhone, nameless]) await expectNoSideScroll(part);
      await expect(page).toHaveScreenshot(`whatsapp-shared-contacts-${language}-${width}.png`, { fullPage: true });
    });
  }
