import { expect, test, type Page } from "@playwright/test";

// Configuración › Consumo (CO1-B, board chosen on 2026-11-27): the screen with both zones in es/en at 1440, 390 and 320; the dialog of
// the prices and its conflict; and the states of the board «Estados» (loading, a month without requests nor messages, Meta that did
// not answer and an installation without a number). The clock stays on 2026-11-27: the current month is 11/2026.
const words = {
  es: { title: "Consumo", menu: "Menú de Ana Pérez", ai: "Consumo de la inteligencia artificial de 11/2026", whatsapp: "Mensajes de WhatsApp de 11/2026",
    prices: "Precios de gpt-6.1-sol", output: "Salida", save: "Guardar", review: "Revisar valores actuales", comparison: "Revisar cambios",
    emptyAi: "En 10/2026 no hubo pedidos a la IA", emptyWhatsApp: "En 10/2026 Meta no informa mensajes entregados",
    unavailable: "No pudimos leer el consumo de Meta", unconfigured: "Esta instalación todavía no tiene un número de WhatsApp", loading: "Cargando…" },
  en: { title: "Usage", menu: "Ana Pérez's menu", ai: "Artificial intelligence usage of 11/2026", whatsapp: "WhatsApp messages of 11/2026",
    prices: "Prices of gpt-6.1-sol", output: "Output", save: "Save", review: "Review current values", comparison: "Review changes",
    emptyAi: "There were no AI requests in 10/2026", emptyWhatsApp: "Meta reports no delivered messages in 10/2026",
    unavailable: "We could not read the usage from Meta", unconfigured: "This installation does not have a WhatsApp number yet", loading: "Loading…" },
} as const;

async function open(page: Page, language: "es" | "en", width: number, scenario = "usage", search = "") {
  await page.clock.setFixedTime(new Date("2026-11-27T15:00:00Z"));
  await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 });
  await page.goto(`/src/test/visual/index.html?screen=${encodeURIComponent("/configuracion/consumo" + search)}&scenario=${scenario}&lang=${language}`);
  await page.getByRole("button", { name: words[language].menu, exact: true }).waitFor({ state: "visible" });
  await expect(page.getByRole("heading", { level: 1, name: words[language].title })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
const fitsWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

for (const language of ["es", "en"] as const) {
  const text = words[language];
  for (const width of [1440, 390, 320]) {
    test(`Usage of the month in ${language} at ${width}px`, async ({ page }) => {
      await open(page, language, width);
      await expect(page.getByRole("table", { name: text.ai })).toBeVisible();
      await expect(page.getByRole("table", { name: text.whatsapp })).toBeVisible();
      // A wide table scrolls inside its zone: the page never scrolls sideways.
      expect(await fitsWidth(page)).toBe(true);
      await expect(page).toHaveScreenshot(`usage-${language}-${width}.png`, { fullPage: true });
    });
  }

  for (const width of [1440, 320]) {
    test(`the prices of a model in ${language} at ${width}px`, async ({ page }) => {
      await open(page, language, width);
      await page.getByRole("button", { name: text.prices, exact: true }).click();
      const dialog = page.getByRole("dialog", { name: text.prices });
      await expect(dialog.getByRole("textbox", { name: text.output })).toHaveValue(language === "es" ? "10,00" : "10.00");
      expect(await fitsWidth(page)).toBe(true);
      await expect(page).toHaveScreenshot(`usage-prices-${language}-${width}.png`);
    });
  }

  test(`a conflict on the prices compares them in ${language}`, async ({ page }) => {
    await open(page, language, 1440, "usage-conflict");
    await page.getByRole("button", { name: text.prices, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: text.prices });
    await dialog.getByRole("textbox", { name: text.output }).fill("12");
    await dialog.getByRole("button", { name: text.save, exact: true }).click();
    // The notice of the conflict, which lives inside the dialog, has the same action: the one of the form is in the footer.
    await dialog.locator("form").getByRole("button", { name: text.review, exact: true }).click();
    await expect(dialog.getByRole("region", { name: text.comparison })).toBeVisible();
    await expect(page).toHaveScreenshot(`usage-prices-conflict-${language}-1440.png`);
  });

  test(`the states of the zones in ${language}`, async ({ page }) => {
    await open(page, language, 1440, "usage-loading");
    await expect(page.getByRole("status", { name: text.loading }).first()).toBeVisible();
    await expect(page).toHaveScreenshot(`usage-loading-${language}-1440.png`, { fullPage: true });

    await open(page, language, 1440, "usage", "?mes=2026-10");
    await expect(page.getByText(text.emptyAi, { exact: true })).toBeVisible();
    await expect(page.getByText(text.emptyWhatsApp, { exact: true })).toBeVisible();
    await expect(page).toHaveScreenshot(`usage-empty-${language}-1440.png`, { fullPage: true });

    await open(page, language, 1440, "usage-unavailable");
    await expect(page.getByText(text.unavailable, { exact: true })).toBeVisible();
    await expect(page.getByRole("table", { name: text.ai })).toBeVisible();
    await expect(page).toHaveScreenshot(`usage-unavailable-${language}-1440.png`, { fullPage: true });

    await open(page, language, 1440, "usage-unconfigured");
    await expect(page.getByText(text.unconfigured, { exact: true })).toBeVisible();
    await expect(page).toHaveScreenshot(`usage-unconfigured-${language}-1440.png`, { fullPage: true });
  });
}
