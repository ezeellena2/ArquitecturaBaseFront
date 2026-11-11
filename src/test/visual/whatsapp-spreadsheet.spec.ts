import { expect, test } from "@playwright/test";

// Stage 2 of the assistant authoring: in the operator's chat, a received spreadsheet shows its name with the file icon and its
// caption below; one without caption shows only its name, and one whose content expired says so. The list keeps the generic
// preview. es/en at 1440, 390 and 320 px.
for (const language of ["es", "en"] as const)
  for (const width of [1440, 390, 320]) {
    test(`chat spreadsheet ${language} ${width}`, async ({ page }) => {
      const es = language === "es";
      await page.setViewportSize({ width, height: 900 });
      await page.clock.install({ time: new Date("2026-10-02T12:10:00Z") });
      await page.goto(`/src/test/visual/index.html?screen=/whatsapp/chat&scenario=chat-spreadsheet&lang=${language}`);
      const contact = page.getByRole("button", { name: "Ana Martínez", exact: true });
      await expect(contact).toBeVisible();
      await expect(page.getByText(es ? "Planilla" : "Spreadsheet", { exact: true })).toBeVisible();
      await contact.click();
      const history = page.getByLabel(es ? "Historial de mensajes" : "Message history", { exact: true });
      await expect(history.getByText(es ? "contratistas.xlsx" : "contractors.xlsx", { exact: true })).toBeVisible();
      await expect(history.getByText(es ? "Armame un catálogo de contratistas con esta planilla" : "Make me a catalog of contractors with this spreadsheet",
        { exact: true })).toBeVisible();
      await expect(history.getByText("zonas.csv", { exact: true })).toBeVisible();
      await expect(history.getByText(es ? "Ya no está disponible." : "It is no longer available.", { exact: true })).toBeVisible();
      await expect(history.getByText(es ? /de otro tipo/ : /other message/)).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
      await expect(page).toHaveScreenshot(`whatsapp-spreadsheet-${language}-${width}.png`, { fullPage: true });
    });
  }
