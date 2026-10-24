import { expect, test } from "@playwright/test";
import { fixtureFormId } from "./formFixtures";

// Prepared I2/I3 scenes use the existing synthetic store; they never publish to Meta.
for (const language of ["es", "en"] as const) for (const width of [390, 320]) for (const state of ["original", "complete", "add", "remove"] as const) {
  test("publication languages " + state + " in " + language + " at " + width + "px", async ({ page }) => {
    const es = language === "es";
    const version = state === "add" ? 2 : state === "remove" ? 3 : 1;
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/src/test/visual/index.html?screen=/formularios/" + fixtureFormId + "&scenario=forms-languages-" + state + "&lang=" + language);
    await page.getByRole("heading", { name: "Registrar visita", level: 1, exact: true }).waitFor({ state: "visible" });
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
    const incomplete = state === "original" || state === "remove";
    await expect(dialog.getByText(incomplete ? es ? "En WhatsApp, en español" : "On WhatsApp, in Spanish" : es ? "En WhatsApp, en español y en inglés" : "On WhatsApp, in Spanish and English", { exact: true })).toBeVisible();
    if (incomplete) {
      if (state === "original") await expect(dialog.getByText(es ? "El inglés no se publica." : "English is not published.", { exact: true })).toBeVisible();
      else await expect(dialog.getByText(es ? "El inglés no se publica." : "English is not published.", { exact: true })).toHaveCount(0);
      await expect(dialog.getByRole("status")).toHaveCount(1);
      await expect(dialog.getByRole("status").getByRole("listitem")).toHaveCount(3);
      await expect(dialog.getByRole("button", { name: es ? "Completar el inglés" : "Complete English", exact: true })).toBeEnabled();
    }
    if (state === "add") await expect(dialog.getByText(es ? "Se suma el inglés." : "English is added.", { exact: true })).toBeVisible();
    if (state === "remove") await expect(dialog.getByText(es ? "El inglés deja de publicarse." : "English will no longer be published.", { exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    if (incomplete) {
      const notice = dialog.getByRole("status");
      const copy = notice.locator("p");
      const action = notice.getByRole("button", { name: es ? "Completar el inglés" : "Complete English", exact: true });
      const noticeBounds = (await notice.boundingBox())!;
      const copyBounds = (await copy.boundingBox())!;
      const actionBounds = (await action.boundingBox())!;
      expect(copyBounds.width).toBeGreaterThanOrEqual(noticeBounds.width * 0.6);
      expect(actionBounds.y).toBeGreaterThanOrEqual(copyBounds.y + copyBounds.height);
      expect(actionBounds.x).toBeGreaterThanOrEqual(noticeBounds.x);
      expect(actionBounds.x + actionBounds.width).toBeLessThanOrEqual(noticeBounds.x + noticeBounds.width);
      expect(await copy.evaluate(node => node.scrollWidth)).toBeLessThanOrEqual(await copy.evaluate(node => node.clientWidth));
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const bounds = await dialog.boundingBox(); expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: "test-results/form-languages-" + state + "-" + language + "-" + width + ".png", fullPage: true });
    await dialog.press("Escape"); await expect(trigger).toBeFocused();
    await trigger.press("Enter");
    const cancel = dialog.getByRole("button", { name: es ? "Cancelar" : "Cancel", exact: true });
    await cancel.focus(); await cancel.press("Enter");
    await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
    if (state === "original") {
      await trigger.press("Enter");
      const complete = dialog.getByRole("button", { name: es ? "Completar el inglés" : "Complete English", exact: true });
      await complete.focus(); await complete.press("Enter");
      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole("textbox", { name: es ? "Opción 1" : "Option 1", exact: true })).toBeFocused();
    }
    expect(await page.evaluate(() => (window as typeof window & { formLanguageWrites: string[] }).formLanguageWrites)).toEqual([]);
  });
}
