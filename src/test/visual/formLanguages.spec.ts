import { expect, test } from "@playwright/test";
import { fixtureFormId } from "./formFixtures";

// Prepared I2/I3 scenes use the existing synthetic store; they never publish to Meta.
for (const language of ["es", "en"] as const) for (const width of [390, 320]) for (const state of ["original", "complete", "add", "remove"] as const) {
  test("publication languages " + state + " in " + language + " at " + width + "px", async ({ page }) => {
    const es = language === "es";
    const version = state === "add" ? 2 : state === "remove" ? 3 : 1;
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/src/test/visual/index.html?screen=/formularios/" + fixtureFormId + "&scenario=forms-languages-" + state + "&lang=" + language);
    await page.getByRole("heading", { name: es ? "Registrar visita" : "Register visit", level: 1, exact: true }).waitFor({ state: "visible" });
    await page.evaluate(() => {
      const fixture = window as typeof window & { formLanguageWrites: string[] };
      fixture.formLanguageWrites = [];
      const previous = window.fetch;
      window.fetch = (input, init) => {
        const request = input instanceof Request ? input : new Request(new URL(String(input), location.origin), init);
        const path = new URL(request.url).pathname;
        if ((request.method === "POST" || request.method === "PUT") && !path.endsWith("/publication-checks")) fixture.formLanguageWrites.push(request.method + " " + path);
        return previous(input, init);
      };
    });
    const trigger = page.getByRole("button", { name: es ? "Publicar en WhatsApp" : "Publish on WhatsApp", exact: true });
    await trigger.focus(); await trigger.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: es ? "Publicar la versión " + version + " en WhatsApp" : "Publish version " + version + " on WhatsApp", exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: es ? "Publicar versión " + version : "Publish version " + version, exact: true })).toBeEnabled();
    // PU1-A (2026-11-01): the languages are a row of «Qué se publica»; what is missing is the (i) of that row, and a language
    // that stops being published is a warning with its own (i).
    const incomplete = state === "original" || state === "remove";
    const published = dialog.getByRole("region", { name: es ? "Qué se publica" : "What is published", exact: true });
    const languages = published.locator("dt", { hasText: es ? "Idiomas" : "Languages" }).locator("xpath=following-sibling::dd[1]");
    await expect(languages).toContainText(incomplete ? es ? "Español" : "Spanish" : es ? "Español e inglés" : "Spanish and English");
    const without = languages.getByText(es ? "Sin el inglés: faltan 3 textos" : "Without English: 3 texts missing", { exact: true });
    const warnings = dialog.getByRole("region", { name: es ? "Avisos" : "Warnings", exact: true });
    // A text missing in English is named in English when the question has it, and in Spanish when it does not.
    const missing = es ? "Faltan Cliente · la opción «Pérez Hnos.», Importe cobrado · la pregunta y Observaciones · la ayuda." : "Missing: Customer · option “Pérez Hnos.”, Importe cobrado · question, and Notes · help.";
    if (state === "original") {
      await expect(without).toBeVisible();
      await expect(languages.getByRole("button", { name: es ? "Qué falta en el inglés" : "What is missing in English", exact: true })).toHaveAccessibleDescription(missing);
    } else await expect(without).toHaveCount(0);
    if (state === "remove") {
      await expect(warnings.getByText(es ? "Deja de publicarse." : "It will no longer be published.", { exact: true })).toBeVisible();
      await expect(warnings.getByRole("button", { name: es ? "Qué cambia para el inglés" : "What changes for English", exact: true }))
        .toHaveAccessibleDescription((es ? "Desde la versión 3, las cuentas en inglés lo reciben en español. " : "From version 3, accounts in English receive it in Spanish. ") + missing);
    } else await expect(warnings).toHaveCount(0);
    // Completing English is offered only with the menu in English, the language it is edited in.
    if (incomplete) {
      if (es) await expect(dialog.getByRole("button", { name: "Completar el inglés", exact: true })).toHaveCount(0);
      else await expect(dialog.getByRole("button", { name: "Complete English", exact: true })).toBeEnabled();
    }
    if (state === "add") await expect(languages.getByText(es ? "Se suma el inglés." : "English is added.", { exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    // The row wraps inside its zone, the completion included: nothing runs off to the side.
    expect(await languages.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    if (incomplete && !es) {
      const zone = (await (state === "remove" ? warnings : published).boundingBox())!;
      const action = (await dialog.getByRole("button", { name: "Complete English", exact: true }).boundingBox())!;
      expect(action.x).toBeGreaterThanOrEqual(zone.x);
      expect(action.x + action.width).toBeLessThanOrEqual(zone.x + zone.width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const bounds = await dialog.boundingBox(); expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: "test-results/form-languages-" + state + "-" + language + "-" + width + ".png", fullPage: true });
    await dialog.press("Escape"); await expect(trigger).toBeFocused();
    await trigger.press("Enter");
    const cancel = dialog.getByRole("button", { name: es ? "Cancelar" : "Cancel", exact: true });
    await cancel.focus(); await cancel.press("Enter");
    await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
    if (state === "original" && !es) {
      await trigger.press("Enter");
      const complete = dialog.getByRole("button", { name: "Complete English", exact: true });
      await complete.focus(); await complete.press("Enter");
      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole("textbox", { name: "Option 1", exact: true })).toBeFocused();
    }
    expect(await page.evaluate(() => (window as typeof window & { formLanguageWrites: string[] }).formLanguageWrites)).toEqual([]);
  });
}
