import { expect, test } from "./test";
import { assistantFixtureConversationId } from "./assistantFixtures";

for (const lang of ["es", "en"] as const) {
  test(`assistant suggestions remain inside the chat at 320px ${lang}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 1000 });
    const screen = `/?conversacion=${assistantFixtureConversationId}`;
    await page.goto(`/src/test/visual/index.html?${new URLSearchParams({ screen, lang, scenario: "assistant-running" })}`);
    const suggestions = page.locator('[data-slot="assistant-suggestions"]');
    await expect(suggestions).toBeVisible();
    const area = (await suggestions.boundingBox())!;
    for (const button of await suggestions.getByRole("button").all()) {
      const box = (await button.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(area.x - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(area.x + area.width + 1);
      expect(await button.locator("span").evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    }
  });

  test(`chosen assistant composition ${lang}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/src/test/visual/index.html?screen=/&scenario=assistant-empty&lang=${lang}`);
    const field = page.getByRole("textbox", { name: lang === "es" ? "Tu pregunta" : "Your question", exact: true });
    await expect(field).toBeVisible();
    const thread = page.locator('[data-slot="assistant-thread"]');
    const composer = page.locator('[data-slot="assistant-composer"]');
    const suggestions = page.locator('[data-slot="assistant-suggestions"]');
    const frame = (await thread.boundingBox())!;
    const box = (await composer.boundingBox())!;
    const prompts = (await suggestions.boundingBox())!;
    const panel = (await page.getByRole("complementary", { name: lang === "es" ? "Conversaciones" : "Conversations", exact: true }).boundingBox())!;
    expect(panel.width).toBe(256);
    expect(frame.width).toBeGreaterThan(880);
    expect(frame.height).toBeGreaterThan(740);
    expect(box.width).toBeLessThanOrEqual(704);
    expect(Math.abs(box.x + box.width / 2 - (frame.x + frame.width / 2))).toBeLessThan(2);
    expect(box.y).toBeGreaterThan(frame.y + frame.height * 0.25);
    expect(box.y + box.height).toBeLessThan(frame.y + frame.height * 0.7);
    expect(prompts.y).toBeGreaterThan(box.y + box.height);
    expect(await composer.evaluate(node => parseFloat(getComputedStyle(node).borderRadius))).toBeGreaterThanOrEqual(16);
    await expect(page.getByRole("button", { name: lang === "es" ? "Enviar" : "Send", exact: true })).toHaveText("");
    const hint = page.getByText(lang === "es" ? "Enter agrega una línea. Ctrl+Enter o ⌘+Enter envían." : "Enter adds a line. Ctrl+Enter or ⌘+Enter send.", { exact: true });
    expect((await hint.boundingBox())!.width).toBeLessThanOrEqual(1);
  });

  test(`route import failure recovers WhatsApp ${lang}`, async ({ page }) => {
    const module = "**/src/features/whatsapp/pages/WhatsAppChatPage.tsx";
    await page.route(module, route => route.abort("failed"));
    await page.goto(`/src/test/visual/index.html?screen=/whatsapp/chat&scenario=chat&lang=${lang}`);
    await expect(page.getByRole("heading", { name: lang === "es" ? "No pudimos abrir esta pantalla" : "We could not open this page", exact: true })).toBeVisible();
    await expect(page.getByText("Unexpected Application Error!", { exact: true })).not.toBeVisible();
    await page.unroute(module);
    await page.getByRole("button", { name: lang === "es" ? "Recargar pantalla" : "Reload page", exact: true }).click();
    await expect(page.getByRole("heading", { name: lang === "es" ? "Chat de WhatsApp" : "WhatsApp chat", exact: true })).toBeVisible();
  });
}
