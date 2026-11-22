import { test, expect, type Page } from "@playwright/test";

// La pantalla ARCA con los tableros AC1-A, AC2-A y AC3, y la delegación (DG1-A, DG2-A y DG3). El reloj queda en el
// 2026-11-05: los vencimientos no cambian.
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
      // AC4: los datos del comprobante, debajo del punto de venta, con el día sólo con números.
      const voucher = page.getByRole("region", { name: es ? /Facturación · Datos del comprobante/ : /Invoicing · Voucher details/ });
      await expect(voucher.getByText("901-123456-7", { exact: true })).toBeVisible();
      await expect(voucher.getByText(es ? "01/03/2019" : "03/01/2019", { exact: true })).toBeVisible();
      // AC5-A: el aviso de vencimiento, en un renglón de «Certificado», con su lápiz.
      await expect(page.getByText(es ? "30 días antes, por correo" : "30 days before, by email", { exact: true })).toBeVisible();
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
    // The point of sale goes in the shared piece for choosing (DS1-A, 2026-11-22).
    await page.getByRole("button", { name: new RegExp("^" + (es ? "Punto de venta" : "Point of sale") + " ") }).click();
    await page.getByRole("option", { name: "0005 · CAE - Factura", exact: true }).click();
    await expect(activate).toBeEnabled();
    await expect(page).toHaveScreenshot(`arca-unverified-${language}.png`, { fullPage: true });

    await open(page, language, "arca-renewal");
    await expect(page.getByRole("status").filter({ hasText: es ? "El certificado vence el" : "The certificate expires on" })).toBeVisible();
    await expect(page.getByRole("button", { name: es ? "Cancelar la renovación" : "Cancel the renewal", exact: true })).toBeVisible();
    await expect(page).toHaveScreenshot(`arca-renewal-${language}.png`, { fullPage: true });
  });

  // AC5-A (RC7-B): el lápiz del renglón abre «Aviso de vencimiento» con los días de la conexión.
  test(`ARCA certificate notice dialog ${language}`, async ({ page }) => {
    await page.clock.install({ time: new Date("2026-11-05T15:00:00Z") });
    await open(page, language, "arca-active");
    await page.getByRole("button", { name: es ? "Cambiar el aviso de vencimiento" : "Change the expiry notice", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: es ? "Aviso de vencimiento" : "Expiry notice" });
    await expect(dialog.getByRole("spinbutton", { name: es ? "Avisar" : "Notify" })).toHaveValue("30");
    await expect(dialog.getByRole("button", { name: es ? "Guardar" : "Save", exact: true })).toBeDisabled();
    await expect(page).toHaveScreenshot(`arca-certificate-notice-${language}.png`);
  });

  for (const width of [1440, 390]) {
    test(`ARCA delegation guide ${language} at ${width}px`, async ({ page }) => {
      await page.clock.install({ time: new Date("2026-11-05T15:00:00Z") });
      await open(page, language, "arca-delegation-waiting", width);
      await expect(page.getByRole("heading", { name: es ? "4 · Delegación" : "4 · Delegation", exact: true })).toBeVisible();
      await page.getByRole("button", { name: es ? "Verificar la delegación" : "Check the delegation", exact: true }).click();
      await expect(page.getByText(es ? "Sin delegar" : "Not delegated", { exact: true })).toBeVisible();
      expect(await fitsWidth(page)).toBe(true);
      await expect(page).toHaveScreenshot(`arca-delegation-guide-${language}-${width}.png`, { fullPage: true });
    });
  }

  test(`ARCA delegation setup and active ${language}`, async ({ page }) => {
    await page.clock.install({ time: new Date("2026-11-05T15:00:00Z") });
    await open(page, language, "arca-delegation-setup");
    await expect(page.getByRole("heading", { name: es ? "3 · Certificado de la plataforma" : "3 · Platform certificate", exact: true })).toBeVisible();
    await expect(page).toHaveScreenshot(`arca-delegation-setup-${language}.png`, { fullPage: true });

    await open(page, language, "arca-delegation-active");
    await expect(page.getByText("Plataforma Ejemplo S.A. · 30-71999888-3", { exact: true })).toBeVisible();
    await expect(page).toHaveScreenshot(`arca-delegation-active-${language}.png`, { fullPage: true });
  });

  // Con el robot prendido, «Cómo se conecta» tiene tres opciones, en la pieza para elegir (DS1-A, 2026-11-22): en el celular la
  // lista ocupa la pantalla y ninguna se corta.
  for (const width of [390, 320]) {
    test(`ARCA details with the three modes ${language} at ${width}px`, async ({ page }) => {
      await page.clock.install({ time: new Date("2026-11-05T15:00:00Z") });
      await open(page, language, "arca-empty-robot", width);
      await page.getByRole("button", { name: es ? "Conectar con ARCA" : "Connect to ARCA", exact: true }).click();
      const modeLabel = es ? "Cómo se conecta" : "How it connects", automatedLabel = es ? "Delegación automática" : "Automated delegation";
      const mode = page.getByRole("button", { name: new RegExp(`^${modeLabel} `) });
      await mode.click();
      // Las tres enteras dentro de la pantalla.
      const modes = page.getByRole("option");
      await expect(modes).toHaveCount(3);
      for (const option of await modes.all()) {
        const box = (await option.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
      }
      await page.getByRole("option", { name: automatedLabel, exact: true }).click();
      await expect(mode).toHaveAccessibleName(`${modeLabel} ${automatedLabel}`);
      expect(await fitsWidth(page)).toBe(true);
      await expect(page).toHaveScreenshot(`arca-details-robot-${language}-${width}.png`, { fullPage: true });
    });
  }

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
