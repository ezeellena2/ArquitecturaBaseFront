import { expect, test } from "@playwright/test";

for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test(`access events reuse the chat safely at ${width}px in ${language}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install({ time: new Date("2026-10-02T12:10:00Z") });
    await page.goto(`/src/test/visual/index.html?screen=/whatsapp/chat&scenario=chat-access&lang=${language}`);
    await page.getByRole("button", { name: "Ana Martínez", exact: true }).click();
    const label = language === "es" ? "Código de ingreso enviado" : "Sign-in code sent";
    await expect(page.getByText(label, { exact: true })).toBeVisible();
    await expect(page.getByText(language === "es" ? "No se pudo enviar" : "Could not send", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: language === "es" ? "Activar bot" : "Enable bot", exact: true })).toHaveCount(0);
    await expect(page.getByText(/123456|#t=secret|legacy-secret/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: language === "es" ? "Usar este texto en el borrador" : "Use this text in the draft" })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    const reply = page.getByLabel(language === "es" ? "Respuesta al cliente" : "Reply to customer");
    await reply.focus();
    await expect(reply).toBeFocused();
    await reply.fill("Borrador de atención");
    await expect(page.getByRole("button", { name: language === "es" ? "Enviar formulario" : "Send form", exact: true })).toBeDisabled();
    await expect(page.getByText(language === "es" ? "Para mandar un formulario, el número tiene que estar vinculado a una cuenta." : "The number must be linked to an account before sending a form.", { exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`whatsapp-access-${language}-${width}.png`, { fullPage: true });
  });
}

test("legacy mode offers only manual attention and preserves the draft", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.clock.install({ time: new Date("2026-10-02T12:10:00Z") });
  await page.goto("/src/test/visual/index.html?screen=/whatsapp/chat&scenario=chat-legacy");
  await page.getByRole("button", { name: "Ana Martínez", exact: true }).click();
  await expect(page.getByText("Atención manual", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Respuesta al cliente")).toBeDisabled();
  await expect(page).toHaveScreenshot("whatsapp-access-legacy-390.png", { fullPage: true });
  await page.getByRole("button", { name: "Tomar atención manual", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.getByLabel("Respuesta al cliente")).toBeEnabled();
  await expect(page.getByRole("button", { name: "Activar bot", exact: true })).toHaveCount(0);
});
