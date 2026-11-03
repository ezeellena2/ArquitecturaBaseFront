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
      // The header keeps Add rule and Save at its right edge, without draft state or revision; that the rules are saved apart is
      // the (i) next to the title (2026-10-31), whose hidden help is not one of the actions.
      const band = page.getByRole("heading", { name: en ? "When a response arrives" : "Cuando llega una respuesta", exact: true }).locator("xpath=ancestor::section[1]/*[1]");
      // «Historial» goes first and opens the revisions in a side panel (board HI1-A).
      const headerButtons = [en ? "History" : "Historial", en ? "Add rule" : "Agregar regla", en ? "Save rules" : "Guardar reglas"];
      const actions = band.getByRole("button").filter({ hasNotText: en ? "Rules are saved separately" : "Se guardan aparte" });
      await expect(band.getByRole("button", { name: en ? "More about When a response arrives" : "Más información sobre Cuando llega una respuesta", exact: true })).toBeVisible();
      await expect(actions).toHaveText(headerButtons);
      await expect(band).not.toContainText(en ? "Unsaved changes" : "Cambios sin guardar");
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.screenshot({ path: "test-results/rules-g1-" + language + "-" + width + ".png", fullPage: true });
      await page.getByRole("button", { name: en ? "Save rules" : "Guardar reglas", exact: true }).click();
      const history = page.getByRole("button", { name: en ? "History" : "Historial", exact: true });
      await expect(history).toBeEnabled();
      await expect(actions).toHaveText(headerButtons);
      await expect(band).not.toContainText(en ? "Revision" : "Revisión");
      const saved = await page.evaluate(language => {
        const store = (window as unknown as { formsFixture: { writes: unknown[]; ruleWrites: { expectedRevision: number; rules: { actions: { text: Record<string, string> }[] }[] }[] } }).formsFixture;
        return { draftWrites: store.writes.length, revision: store.ruleWrites[0].expectedRevision, original: store.ruleWrites[0].rules[0].actions[0].text[language], optional: store.ruleWrites[0].rules[0].actions[0].text[language === "es" ? "en" : "es"] };
      }, language);
      expect(saved).toEqual({ draftWrites: 0, revision: 0, original: message, optional: "" });
      await history.click();
      const panel = page.getByRole("dialog", { name: en ? "Rule history" : "Historial de las reglas", exact: true });
      const revision = panel.getByRole("button", { name: en ? "Revision 1" : "Revisión 1", exact: true });
      await expect(revision).toBeVisible();
      await expect(panel.getByText(en ? "Current" : "Vigente", { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.screenshot({ path: "test-results/rules-history-" + language + "-" + width + ".png" });
      await revision.click();
      await expect(panel.getByRole("heading", { name: en ? "Revision 1" : "Revisión 1", exact: true })).toBeVisible();
      await expect(panel.getByText(message, { exact: false })).toBeVisible();
      await expect(panel.getByRole("textbox")).toHaveCount(0);
      await page.screenshot({ path: "test-results/rules-history-revision-" + language + "-" + width + ".png" });
      await panel.getByRole("button", { name: en ? "Back to revisions" : "Volver a las revisiones", exact: true }).click();
      await expect(revision).toBeFocused();
      await panel.getByRole("button", { name: en ? "Close" : "Cerrar", exact: true }).click();
      await expect(history).toBeFocused();
    });
    // Board RP1-A: the attachment is never cleared; its reason is under the box right away, with the button that fixes the order.
    test("attached PDF tells why and fixes the order " + language + " at " + width, async ({ page }) => {
      const en = language === "en";
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/src/test/visual/index.html?screen=/formularios/" + fixtureFormId + "&scenario=forms-rules&lang=" + language);
      await expect(page.getByRole("heading", { name: en ? "Register visit" : "Registrar visita", exact: true })).toBeVisible();
      await page.getByRole("button", { name: en ? "Add rule" : "Agregar regla", exact: true }).click();
      await page.getByRole("combobox", { name: en ? "When" : "Cuándo", exact: true }).selectOption("Approved");
      await page.getByRole("button", { name: en ? "Add action" : "Agregar acción", exact: true }).click();
      await page.getByRole("textbox", { name: en ? "Message" : "Mensaje", exact: true }).fill(en ? "We approved {número}." : "Aprobamos {número}.");
      const attach = page.getByRole("checkbox", { name: en ? "Attach PDF" : "Adjuntar el PDF", exact: true });
      // The label covers the whole row of the common box, as clicking anywhere on it does.
      await page.getByText(en ? "Attach PDF" : "Adjuntar el PDF", { exact: true }).click();
      const reason = en ? "To attach it, “Generate PDF” must come before this message." : "Para adjuntarlo, «Armar el PDF» tiene que ir antes de este mensaje.";
      await expect(page.getByRole("alert").filter({ hasText: reason })).toBeVisible();
      const fix = page.getByRole("button", { name: en ? "Add “Generate PDF” before" : "Agregar «Armar el PDF» antes", exact: true });
      await expect(fix).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.screenshot({ path: "test-results/rules-pdf-attachment-" + language + "-" + width + ".png", fullPage: true });
      await fix.click();
      await expect(page.getByRole("combobox", { name: en ? "Action 1" : "Acción 1", exact: true })).toHaveValue("GeneratePdf");
      await expect(attach).toBeChecked();
      await expect(attach).toBeFocused();
      await expect(page.getByRole("alert").filter({ hasText: reason })).toHaveCount(0);
      const writes = await page.evaluate(() => (window as unknown as { formsFixture: { ruleWrites: unknown[] } }).formsFixture.ruleWrites.length);
      expect(writes).toBe(0);
    });
  }
