import { expect, test, type Page } from "@playwright/test";

/// Mi perfil rearmado como Configuración (tablero PF1-A, elegido el 2026-11-03): los datos, los medios de ingreso en
/// renglones de columnas fijas y el chat de WhatsApp en su zona. El escenario `profile-chat` es el caso de la prueba
/// completa: el número dice «Verificado», pero su chat quedó sin vincular. El teléfono es inventado.
async function openProfile(page: Page, language: "es" | "en", scenario = "profile-chat") {
  const parameters = new URLSearchParams({ screen: "/perfil", lang: language, scenario });
  await page.goto(`/src/test/visual/index.html?${parameters}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const copy = {
  es: { details: "Datos del perfil", methods: "Medios de ingreso", chat: "Chat de WhatsApp", verified: "Verificado",
    unlinked: "Sin vincular", link: "Vincular", unlink: "Desvincular", notices: "No llegan", until: "Llegan hasta el 3 nov 2026, 21:40" },
  en: { details: "Profile details", methods: "Sign-in methods", chat: "WhatsApp chat", verified: "Verified",
    unlinked: "Not linked", link: "Link", unlink: "Unlink", notices: "They don't arrive", until: "They arrive until Nov 3, 2026, 9:40 PM" },
} as const;

for (const language of ["es", "en"] as const) {
  const text = copy[language];

  for (const width of [1440, 390, 320]) {
    test(`the profile reads in zones, with the chat of the number apart, ${language} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openProfile(page, language);

      const details = page.getByRole("region", { name: text.details });
      const methods = page.getByRole("region", { name: text.methods });
      const chat = page.getByRole("region", { name: text.chat });
      await expect(chat.getByText(text.unlinked, { exact: true })).toBeVisible();
      await expect(chat.getByRole("button", { name: text.link, exact: true })).toBeVisible();
      await expect(chat.getByText(text.notices, { exact: true })).toBeVisible();

      // Una zona debajo de la otra, a todo el ancho, sin desplazar la página de costado.
      const [detailsBox, methodsBox, chatBox] = await Promise.all([details.boundingBox(), methods.boundingBox(), chat.boundingBox()]);
      expect(methodsBox!.y).toBeGreaterThan(detailsBox!.y + detailsBox!.height - 1);
      expect(chatBox!.y).toBeGreaterThan(methodsBox!.y + methodsBox!.height - 1);
      expect(Math.abs(detailsBox!.width - methodsBox!.width)).toBeLessThanOrEqual(1);
      const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
      expect(geometry.document).toBeLessThanOrEqual(geometry.viewport + 1);

      // El estado de cada medio queda en la misma columna; en escritorio, en el renglón de su valor.
      const badges = methods.getByText(text.verified, { exact: true });
      await expect(badges).toHaveCount(2);
      const [email, phone] = await Promise.all([badges.nth(0).boundingBox(), badges.nth(1).boundingBox()]);
      if (width === 1440) {
        expect(Math.abs(email!.x - phone!.x)).toBeLessThanOrEqual(1);
        const value = methods.getByText("+54 9 11 5555-0123", { exact: true });
        const valueBox = (await value.boundingBox())!;
        expect(Math.abs((valueBox.y + valueBox.height / 2) - (phone!.y + phone!.height / 2))).toBeLessThanOrEqual(2);
      }

      // Quitar va en rojo, y el botón no se sale de su zona.
      const unlink = methods.getByRole("button", { name: text.unlink, exact: true });
      const unlinkBox = (await unlink.boundingBox())!;
      expect(unlinkBox.x + unlinkBox.width).toBeLessThanOrEqual(methodsBox!.x + methodsBox!.width);
      const [unlinkColor, dangerColor] = await unlink.evaluate((element) => {
        const probe = document.createElement("span");
        probe.style.color = "var(--color-destructive)";
        document.body.append(probe);
        const danger = getComputedStyle(probe).color;
        probe.remove();

        return [getComputedStyle(element).color, danger];
      });
      expect(unlinkColor).toBe(dangerColor);

      await expect(page).toHaveScreenshot(`profile-chat-${language}-${width}.png`, { fullPage: true });
    });
  }

  test(`a linked chat says until when the notices arrive, ${language}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openProfile(page, language, "profile-chat-linked");

    const chat = page.getByRole("region", { name: text.chat });
    await expect(chat.getByText(text.until, { exact: true })).toBeVisible();
    await expect(chat.getByRole("button", { name: text.link, exact: true })).toHaveCount(0);
  });
}
