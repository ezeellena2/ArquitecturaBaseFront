import { expect, test } from "@playwright/test";
import { visualCatalogId } from "./catalogFixtures";

// IA2: a catalog with the import of a proposal's spreadsheet pending opens it by itself, on «La planilla del chat» and already
// reviewed; when the copy is gone, the dialog says so and asks for the file, as always.
for (const scene of ["chat", "chat-gone"] as const)
  for (const language of ["es", "en"] as const)
    for (const width of [1440, 390, 320])
      test(`catalog assistant import ${scene} ${language} ${width}`, async ({ page }) => {
        const en = language === "en";
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen: "/catalogos/" + visualCatalogId, lang: language, scenario: "catalogs-import-" + scene }));
        const dialog = page.getByRole("dialog", { name: en ? "Import options into “Customers”" : "Importar opciones a «Clientes»", exact: true });
        await expect(dialog).toBeVisible();
        if (scene === "chat") {
          await expect(dialog.getByRole("button", { name: en ? "The chat spreadsheet: clientes.xlsx (27 rows)" : "La planilla del chat: clientes.xlsx (27 filas)", exact: true })).toHaveAttribute("aria-pressed", "true");
          await expect(dialog.getByRole("button", { name: en ? "Apply without the 24 rows with errors" : "Aplicar sin las 24 filas con errores", exact: true })).toBeVisible();
        } else {
          await expect(dialog.getByText(en ? "The spreadsheet you saw in the chat is no longer available. You can upload the file yourself."
            : "La planilla que viste en el chat ya no está disponible. Podés subir el archivo a mano.", { exact: true })).toBeVisible();
          await expect(dialog.getByRole("button", { name: en ? "Upload a file" : "Subir un archivo", exact: true })).toHaveAttribute("aria-pressed", "true");
        }
        await page.evaluate(() => document.fonts.ready);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        // No option of «Desde» goes out of its box, not even the long one of the chat on a phone: the control is measured, not
        // only the page's scroll.
        const from = dialog.getByRole("group", { name: en ? "From" : "Desde", exact: true });
        expect(await from.evaluate(group => group.scrollWidth <= group.clientWidth)).toBe(true);
        expect(await from.getByRole("button").evaluateAll(buttons => buttons.every(button => button.scrollWidth <= button.clientWidth))).toBe(true);
        await expect(page).toHaveScreenshot(`catalog-assistant-import-${scene}-${language}-${width}.png`);
      });
