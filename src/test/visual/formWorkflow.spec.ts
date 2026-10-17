import { expect, test } from "@playwright/test";
import { responseFormId, responseRecordId } from "../responseFixtures";
for (const language of ["es", "en"] as const)
  for (const width of [1440, 390, 320]) {
    test("workflow checks before retry " + language + " at " + width, async ({ page }) => {
      const en = language === "en";
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/src/test/visual/index.html?screen=/formularios/" + responseFormId + "/respuestas/" + responseRecordId + "&scenario=responses-workflow&lang=" + language);
      await expect(page.getByRole("heading", { name: "TEST-000002", exact: true })).toBeVisible();
      const panel = page.getByRole("region", { name: en ? "Response detail" : "Detalle de la respuesta", exact: true });
      await panel.getByRole("tab", { name: en ? "Activity" : "Actividad", exact: true }).click();
      const history = panel.getByRole("region", { name: en ? "Activity" : "Actividad", exact: true });
      await expect(history.getByText(en ? "Unconfirmed" : "Sin confirmar", { exact: true })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => {
        const original = window.fetch;
        const calls: string[] = [];
        (window as unknown as { workflowPosts: string[] }).workflowPosts = calls;
        window.fetch = (input, init) => {
          const request = input instanceof Request ? input : new Request(new URL(String(input), location.href), init);
          if (request.method === "POST" && request.url.includes("/actions/")) calls.push(new URL(request.url).pathname.split("/").at(-1)!);
          return original(input, init);
        };
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await expect(history.getByRole("button", { name: en ? "Retry" : "Reintentar", exact: true })).toHaveCount(0);
      await history.scrollIntoViewIfNeeded();
      await page.screenshot({ path: "test-results/workflow-unconfirmed-" + language + "-" + width + ".png", fullPage: true });
      await history.getByRole("button", { name: en ? "Check status" : "Consultar", exact: true }).focus();
      await page.keyboard.press("Enter");
      await expect(history.getByText(en ? "Failed" : "No se pudo", { exact: true })).toBeVisible();
      await history.getByRole("button", { name: en ? "Retry" : "Reintentar", exact: true }).focus();
      await page.keyboard.press("Enter");
      await expect(history.getByText(en ? "Done" : "Hecho", { exact: true })).toBeVisible();
      await expect(history.getByRole("button", { name: en ? "Retry" : "Reintentar", exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => (window as unknown as { workflowPosts: string[] }).workflowPosts)).toEqual(["consult", "retry"]);
    });
  }
