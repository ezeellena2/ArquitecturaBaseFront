import { test, expect, type Page } from "@playwright/test";

// La pantalla ARCA con los tableros AC1-A, AC2-A y AC3. El reloj queda en el 2026-11-05: los vencimientos no cambian.
async function open(page: Page, language: "es" | "en", scenario: string, width = 1440) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(`/src/test/visual/index.html?screen=/configuracion/arca&lang=${language}&scenario=${scenario}`);
  await expect(page.getByRole("heading", { name: "ARCA", exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const fitsWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

for (const language of ["es", "en"] as const) {
  const es = language === "es";
  for (const width of [1440, 390, 320]) {
    test(`ARCA active connection ${language} at ${width}px`, async ({ page }) => {
      await page.clock.install({ time: new Date("2026-11-05T15:00:00Z") });
      await open(page, language, "arca-active", width);
      await expect(page.getByText("Campo del Sur SA", { exact: true })).toBeVisible();
      await expect(page.getByText("0005", { exact: true })).toBeVisible();
      expect(await fitsWidth(page)).toBe(true);
      await expect(page).toHaveScreenshot(`arca-active-${language}-${width}.png`, { fullPage: true });
    });

    test(`ARCA setup awaiting the certificate ${language} at ${width}px`, async ({ page }) => {
      await page.clock.install({ time: new Date("2026-11-05T15:00:00Z") });
      await open(page, language, "arca-setup", width);
      await expect(page.getByRole("heading", { name: es ? "3 · Certificado" : "3 · Certificate", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: es ? "Elegir archivo" : "Choose file", exact: true })).toBeVisible();
      expect(await fitsWidth(page)).toBe(true);
      await expect(page).toHaveScreenshot(`arca-setup-${language}-${width}.png`, { fullPage: true });
    });
  }

  test(`ARCA activation and renewal ${language}`, async ({ page }) => {
    await page.clock.install({ time: new Date("2026-11-05T15:00:00Z") });
    await open(page, language, "arca-unverified");
    const activate = page.getByRole("button", { name: es ? "Activar la conexión" : "Activate the connection", exact: true });
    await expect(activate).toBeDisabled();
    await page.getByRole("radio", { name: es ? "0005 · CAE - Factura" : "0005 · CAE - Factura", exact: true }).click();
    await expect(activate).toBeEnabled();
    await expect(page).toHaveScreenshot(`arca-unverified-${language}.png`, { fullPage: true });

    await open(page, language, "arca-renewal");
    await expect(page.getByRole("status").filter({ hasText: es ? "El certificado vence el" : "The certificate expires on" })).toBeVisible();
    await expect(page.getByRole("button", { name: es ? "Cancelar la renovación" : "Cancel the renewal", exact: true })).toBeVisible();
    await expect(page).toHaveScreenshot(`arca-renewal-${language}.png`, { fullPage: true });
  });

  test(`ARCA without a connection and read only ${language}`, async ({ page }) => {
    await page.clock.install({ time: new Date("2026-11-05T15:00:00Z") });
    await open(page, language, "arca-empty");
    await page.getByRole("button", { name: es ? "Conectar con ARCA" : "Connect to ARCA", exact: true }).click();
    await expect(page.getByRole("heading", { name: es ? "1 · Datos" : "1 · Details", exact: true })).toBeVisible();
    await expect(page).toHaveScreenshot(`arca-empty-${language}.png`, { fullPage: true });

    await open(page, language, "arca-read");
    await expect(page.getByText(es ? "Solo lectura" : "Read only", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: es ? "Desconectar" : "Disconnect", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: es ? "Probar" : "Test", exact: true })).toHaveCount(0);
  });
}
