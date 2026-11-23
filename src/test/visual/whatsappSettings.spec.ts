import { expect, test, type Page } from "@playwright/test";

// Configuración › WhatsApp (RC3-A, board confirmed on 2026-11-22): the three values in es/en at 1440, 390 and 320; the list of the
// countries with a new one and the notice of its cost, on the desktop and on the phone; and the comparison after another
// administrator saved first.
const words = {
  es: { title: "WhatsApp", countries: "Países que reciben códigos", search: "Buscar en Países que reciben códigos", brazil: "Brasil", done: "Listo (3)",
    cost: "Los códigos a números de Brasil se pagan con la tarifa de Meta para ese país.", days: "Conservar el contenido de los mensajes", save: "Guardar cambios",
    review: "Revisar valores actuales", comparison: "Revisar cambios", menu: "Menú de Ana Pérez" },
  en: { title: "WhatsApp", countries: "Countries that receive codes", search: "Search in Countries that receive codes", brazil: "Brazil", done: "Done (3)",
    cost: "Codes to numbers of Brazil are paid at Meta's rate for that country.", days: "Keep the content of the messages", save: "Save changes",
    review: "Review current values", comparison: "Review changes", menu: "Ana Pérez's menu" },
} as const;

async function open(page: Page, language: "es" | "en", width: number, scenario = "whatsapp-settings") {
  await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 });
  await page.goto(`/src/test/visual/index.html?screen=${encodeURIComponent("/configuracion/whatsapp")}&scenario=${scenario}&lang=${language}`);
  await page.getByRole("button", { name: words[language].menu, exact: true }).waitFor({ state: "visible" });
  await expect(page.getByRole("heading", { level: 1, name: words[language].title })).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: words[language].days })).toHaveValue("90");
  await page.evaluate(() => document.fonts.ready);
}
const fitsWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

for (const language of ["es", "en"] as const) {
  const text = words[language];
  for (const width of [1440, 390, 320]) {
    test(`WhatsApp settings in ${language} at ${width}px`, async ({ page }) => {
      await open(page, language, width);
      await expect(page.getByRole("button", { name: new RegExp("^" + text.countries) })).toBeVisible();
      expect(await fitsWidth(page)).toBe(true);
      await expect(page).toHaveScreenshot(`whatsapp-settings-${language}-${width}.png`, { fullPage: true });
    });
  }

  for (const width of [1440, 390]) {
    test(`a new country says its cost in ${language} at ${width}px`, async ({ page }) => {
      await open(page, language, width);
      await page.getByRole("button", { name: new RegExp("^" + text.countries) }).click();
      await page.getByRole("combobox", { name: text.search }).fill(text.brazil.slice(0, 3));
      await page.getByRole("option", { name: text.brazil, exact: true }).click();
      // On the phone the list takes the screen and the choice is applied with «Listo»; on the desktop, at once.
      if (width < 768) {
        await expect(page.getByRole("button", { name: text.done, exact: true })).toBeVisible();
        expect(await fitsWidth(page)).toBe(true);
        await expect(page).toHaveScreenshot(`whatsapp-settings-countries-${language}-${width}.png`);
        await page.getByRole("button", { name: text.done, exact: true }).click();
      }
      await expect(page.getByText(text.cost, { exact: true })).toBeVisible();
      expect(await fitsWidth(page)).toBe(true);
      await expect(page).toHaveScreenshot(`whatsapp-settings-country-cost-${language}-${width}.png`);
    });
  }

  test(`a conflict compares the values in ${language}`, async ({ page }) => {
    await open(page, language, 1440, "whatsapp-settings-conflict");
    const days = page.getByRole("spinbutton", { name: text.days });
    await days.fill("30");
    await page.getByRole("button", { name: text.save, exact: true }).click();
    // The notice of the conflict has the same action: the one of the band is in the page.
    await page.getByRole("main").getByRole("button", { name: text.review, exact: true }).click();
    await expect(page.getByRole("region", { name: text.comparison })).toBeVisible();
    await expect(page).toHaveScreenshot(`whatsapp-settings-conflict-${language}-1440.png`, { fullPage: true });
  });
}
