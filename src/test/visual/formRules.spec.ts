import { expect, test } from "@playwright/test";
import { fixtureFormId } from "./formFixtures";
for (const language of ["es", "en"] as const)
  for (const width of [1440, 390, 320]) {
    test("rules save separately " + language + " at " + width, async ({ page }) => {
      const en = language === "en";
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/src/test/visual/index.html?screen=/formularios/" + fixtureFormId + "&scenario=forms-rules&lang=" + language);
      await expect(page.getByRole("heading", { name: en ? "Register visit" : "Registrar visita", exact: true })).toBeVisible();
      await page.getByRole("button", { name: en ? "Add rule" : "Agregar regla", exact: true }).click();
      await page.getByRole("button", { name: en ? "Add action" : "Agregar acción", exact: true }).click();
      const message = en ? "We received {número}." : "Recibimos {número}.";
      await page.getByRole("textbox", { name: en ? "Message" : "Mensaje", exact: true }).fill(message);
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.screenshot({ path: "test-results/rules-g1-" + language + "-" + width + ".png", fullPage: true });
      await page.getByRole("button", { name: en ? "Save rules" : "Guardar reglas", exact: true }).click();
      const revision = page.getByRole("button", { name: en ? "Revision 1" : "Revisión 1", exact: true });
      await expect(revision).toBeVisible();
      const saved = await page.evaluate(language => {
        const store = (window as unknown as { formsFixture: { writes: unknown[]; ruleWrites: { expectedRevision: number; rules: { actions: { text: Record<string, string> }[] }[] }[] } }).formsFixture;
        return { draftWrites: store.writes.length, revision: store.ruleWrites[0].expectedRevision, original: store.ruleWrites[0].rules[0].actions[0].text[language], optional: store.ruleWrites[0].rules[0].actions[0].text[language === "es" ? "en" : "es"] };
      }, language);
      expect(saved).toEqual({ draftWrites: 0, revision: 0, original: message, optional: "" });
      await revision.click();
      const history = page.getByRole("dialog", { name: en ? "Revision 1" : "Revisión 1", exact: true });
      await expect(history.getByText(message, { exact: false })).toBeVisible();
      await expect(history.getByRole("textbox")).toHaveCount(0);
      await history.getByRole("button", { name: en ? "Close" : "Cerrar", exact: true }).click();
      await expect(revision).toBeFocused();
    });
  }
