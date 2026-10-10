import { expect, test } from "@playwright/test";
import { fixtureFormId } from "./formFixtures";
import failedDetail from "../fixtures/forms-http/failed/detail-es.json" with { type: "json" };

for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test(`review keeps focus after movement, Done and final removal ${language} at ${width}px`, async ({ page }) => {
    const es = language === "es";
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/src/test/visual/index.html?screen=/formularios/${fixtureFormId}&scenario=forms-editor&lang=${language}`);
    const customer = es ? "Cliente" : "Customer";
    const down = page.getByRole("button", { name: es ? "Bajar " + customer : "Move " + customer + " down", exact: true });
    await down.focus(); await down.press("Enter");
    await expect(down).toBeFocused();
    const up = page.getByRole("button", { name: es ? "Subir " + customer : "Move " + customer + " up", exact: true });
    await up.focus(); await up.press("Enter");
    await expect(down).toBeFocused();
    await expect(page.getByRole("status").filter({ hasText: customer + (es ? ": posición 1 de 6" : ": position 1 of 6") })).toHaveCount(1);
    const edit = page.getByRole("button", { name: (es ? "Editar " : "Edit ") + customer, exact: true });
    await edit.click();
    await page.getByRole("button", { name: es ? "Bajar Pérez Hnos." : "Move Pérez Hnos. down", exact: true }).click();
    await expect(page.getByRole("button", { name: es ? "Subir Pérez Hnos." : "Move Pérez Hnos. up", exact: true })).toBeFocused();
    for (const option of [2, 1]) {
      await page.getByRole("button", { name: es ? "Quitar Opción " + option : "Remove Option " + option, exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: es ? "Quitar opción" : "Remove option", exact: true }).click();
      if (option === 2) await expect(page.getByRole("textbox", { name: es ? "Opción 1" : "Option 1", exact: true })).toBeFocused();
      else await expect(page.getByRole("button", { name: es ? "Agregar opción" : "Add option", exact: true })).toBeFocused();
    }
    await page.getByRole("button", { name: es ? "Listo" : "Done", exact: true }).click();
    await expect(edit).toBeFocused();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `test-results/forms-review-focus-${language}-${width}.png`, fullPage: true });
    for (let index = 0; index < 6; index++) {
      await page.locator("[data-question-local-id]").first().getByRole("button", { name: es ? /^Quitar / : /^Remove / }).click();
      await page.getByRole("dialog").getByRole("button", { name: es ? "Quitar pregunta" : "Remove question", exact: true }).click();
    }
    await expect(page.getByRole("button", { name: es ? "Agregar pregunta" : "Add question", exact: true })).toBeFocused();
  });
  test(`actual HTTP Published and Failed render with version and field diagnostics ${language} at ${width}px`, async ({ page }) => {
    const es = language === "es";
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/src/test/visual/index.html?screen=/formularios&scenario=forms-publication-http-published&lang=${language}`);
    await expect(page.getByRole("table").getByText(es ? "Publicado · versión 1" : "Published · version 1", { exact: true })).toBeVisible();
    await page.screenshot({ path: `test-results/forms-review-http-published-${language}-${width}.png`, fullPage: true });
    await page.goto(`/src/test/visual/index.html?screen=/formularios/${failedDetail.definition.id}&scenario=forms-publication-http-failed&lang=${language}`);
    await page.getByRole("button", { name: es ? "Ir a la pregunta" : "Go to the question", exact: true }).click();
    const label = page.getByRole("textbox", { name: es ? "Pregunta" : "Question", exact: true });
    await expect(label).toBeFocused(); await expect(label).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("button", { name: /^English/ })).toHaveAttribute("aria-pressed", "true");
    const writes = await page.evaluate(() => (globalThis as unknown as { formsFixture: { calls: { method: string }[] } }).formsFixture.calls.filter(call => call.method !== "GET"));
    expect(writes).toEqual([]);
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `test-results/forms-review-http-failed-${language}-${width}.png`, fullPage: true });
  });
}
