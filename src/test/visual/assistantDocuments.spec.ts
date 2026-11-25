import { expect, test, type Page } from "@playwright/test";
import { assistantFixtureConversationId } from "./assistantFixtures";

const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

// Etapa 3 de la IA: a PDF sent with its text, in its message with its pages and size, and the form card it brought, which reads
// documents; then, in the same conversation, the clip with a PDF chosen and, after sending it, its reading in progress, with
// «Leyendo el documento…» on the arrow. es/en at 1440, 390 and 320 px.
for (const lang of ["es", "en"] as const)
  for (const width of [1440, 390, 320])
    test(`assistant document ${lang} ${width}`, async ({ page }) => {
      const es = lang === "es";
      await page.setViewportSize({ width, height: 1000 });
      await page.clock.install({ time: new Date("2026-11-12T15:00:00Z") });
      // The file goes up by XMLHttpRequest, outside the fetch double: the scene answers it here, and its reading stays running.
      const uploads: string[] = [];
      await page.route(url => url.pathname === "/api/ai/assistant/documents", async route => {
        uploads.push(route.request().method());
        await route.fulfill({ status: 202, json: { requestId: "0199a0c0-0000-7000-8000-000000000777", state: "pending", document: null,
          failure: null, pollingAfterSeconds: 2 } });
      });
      await page.goto(`/src/test/visual/index.html?${new URLSearchParams({ screen: `/?conversacion=${assistantFixtureConversationId}`, lang,
        scenario: "assistant-proposal-document" })}`);
      const card = page.getByRole("region", { name: es ? "Formulario: Pagos de clientes" : "Form: Customer payments" });
      await expect(card.getByText(es ? "Lee documentos" : "Reads documents", { exact: true })).toBeVisible();
      await expect(card.getByRole("button", { name: es ? "Crear borrador" : "Create draft", exact: true })).toBeVisible();
      await expect(page.getByText(es ? "PDF · 2 páginas · 412 KB" : "PDF · 2 pages · 412 KB", { exact: true })).toBeVisible();
      const clip = page.getByRole("button", { name: es ? "Adjuntar un archivo" : "Attach a file", exact: true });
      await expect(clip).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(await noSideScroll(page)).toBe(true);
      await expect(page).toHaveScreenshot(`assistant-document-${lang}-${width}.png`, { fullPage: true });

      // The clip with a PDF chosen: its name, its kind and size, and the X instead of the clip.
      const name = es ? "transferencia.pdf" : "transfer.pdf";
      await page.locator("input[type=file]").setInputFiles({ name, mimeType: "application/pdf", buffer: Buffer.alloc(98 * 1024) });
      await expect(page.getByText("PDF · 98 KB", { exact: true })).toBeVisible();
      const remove = page.getByRole("button", { name: (es ? "Quitar " : "Remove ") + name, exact: true });
      await expect(remove).toBeVisible();
      await expect(clip).toBeHidden();
      await page.evaluate(() => document.fonts.ready);
      expect(await noSideScroll(page)).toBe(true);
      await expect(page).toHaveScreenshot(`assistant-document-chosen-${lang}-${width}.png`, { fullPage: true });

      // Sending reads it first: the arrow waits with «Leyendo el documento…», the X turns off and nothing else is sent yet.
      await page.getByRole("button", { name: es ? "Enviar" : "Send", exact: true }).click();
      const readingLabel = es ? "Leyendo el documento…" : "Reading the document…";
      const reading = page.getByLabel(readingLabel, { exact: true }).first();
      await expect(reading).toBeVisible();
      await expect(remove).toBeDisabled();
      expect(uploads).toEqual(["POST"]);
      // The click closed the arrow's tooltip and Radix opens it again only after the pointer leaves: it goes out and comes back.
      await page.mouse.move(0, 0);
      await reading.hover();
      await expect(page.getByRole("tooltip")).toHaveText(readingLabel);
      await page.evaluate(() => document.fonts.ready);
      expect(await noSideScroll(page)).toBe(true);
      await expect(page).toHaveScreenshot(`assistant-document-reading-${lang}-${width}.png`, { fullPage: true });
    });
