import { expect, test } from "@playwright/test";
for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
 test(`audio states preserve transcription and private playback actions in ${language} at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await page.clock.install({ time: new Date("2026-10-02T12:10:00Z") });
  await page.goto(`/src/test/visual/index.html?screen=/whatsapp/chat&scenario=chat-audio&lang=${language}`);
  await page.getByRole("button", { name: "Ana Martínez", exact: true }).click();
  const history = page.getByLabel(language === "es" ? "Historial de mensajes" : "Message history", { exact: true });
  await expect(history.getByText(language === "es" ? "Transcripción" : "Transcription", { exact: true })).toBeVisible();
  await expect(history.getByRole("button", { name: language === "es" ? "Escuchar audio" : "Listen to audio", exact: true })).toHaveCount(3);
  await expect(history.getByText(language === "es" ? "El audio y su transcripción ya no están disponibles." : "The audio and its transcription are no longer available.", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
  await page.screenshot({ path: `test-results/visual/whatsapp-audio-${language}-${width}.png`, fullPage: true });
 });
}
