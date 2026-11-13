import { expect, test } from "@playwright/test";

// VC1-A (VC2 and VC5) in the operator's chat, with goldens: Marta Ruiz sends a spreadsheet of eight rows; the assistant's notice carries
// «Por qué lo propuso» in two columns (what it recognized, the rows it sent, the ones for the team as a range and the repeated one, already
// in a response) with the way to «Documentos recibidos», and each of the three loads is the card of its form, without the footer that only
// goes to WhatsApp. es/en at 1440, 390 and 320 px; the page never scrolls sideways.
for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test(`VC1-A the notice of the loads with «Por qué lo propuso» ${language} ${width}`, async ({ page }) => {
    const es = language === "es";
    await page.setViewportSize({ width, height: 1100 });
    await page.clock.install({ time: new Date("2026-10-02T12:10:00Z") });
    await page.goto(`/src/test/visual/index.html?screen=/whatsapp/chat&scenario=chat-document-rows&lang=${language}`);
    const contact = page.getByRole("button", { name: "Marta Ruiz", exact: true });
    await expect(contact).toBeVisible();
    await contact.click();
    const history = page.getByLabel(es ? "Historial de mensajes" : "Message history", { exact: true });
    const why = history.locator("section").filter({ hasText: es ? "Por qué lo propuso" : "Why it proposed this" });
    await expect(why.getByText(es ? "Filas 5 a 8" : "Rows 5 to 8", { exact: true })).toBeVisible();
    await expect(why.getByRole("link", { name: es ? "Ver en Documentos recibidos" : "View in Received documents", exact: true })).toBeVisible();
    await expect(history.getByText(es ? "3 de 3 · $128.400 · Panadería Don Ángel" : "3 of 3 · $128,400 · Don Ángel bakery", { exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await why.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    await expect(page).toHaveScreenshot(`whatsapp-spreadsheet-rows-${language}-${width}.png`, { fullPage: true });
  });
}
