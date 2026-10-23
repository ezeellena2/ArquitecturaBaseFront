import { expect, test, type Page } from "@playwright/test";
import { fixtureFormId } from "./formFixtures";
import { responseFullFixtureIds } from "./formResponseFullFixtures";
import type { createFormResponseFullFixtures } from "./formResponseFullFixtures";

// Synthetic transport through production routes. These scenes do not qualify Meta or backend persistence.
const contained = async (page: Page, width: number) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
};
const fixture = (page: Page) => page.evaluate(() => (window as typeof window & {
  formResponseFullFixture: ReturnType<typeof createFormResponseFullFixtures>;
}).formResponseFullFixture.queries);
async function open(page: Page, screen: string, language: string, scenario: string) {
  await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen, lang: language, scenario }));
}
async function closeNav(page: Page, en: boolean, width: number) {
  if (width >= 768) return;
  const menu = page.getByRole("button", { name: en ? "Navigation menu" : "Menú de navegación", exact: true });
  if (await menu.getAttribute("aria-expanded") === "true") await menu.click();
}
for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  const en = language === "en";
  const label = (es: string, english: string) => en ? english : es;
  for (const catalog of [false, true]) test("CA4 multiplicity " + (catalog ? "catalog " : "own ") + language + " " + width, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, "/formularios/" + fixtureFormId, language, catalog ? "forms-catalog-multiple" : "forms-multiple-own");
    await expect(page.getByRole("heading", { name: label("Registrar visita", "Register visit"), exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await closeNav(page, en, width);
    await page.getByRole("button", { name: label("Editar Fallas", "Edit Faults"), exact: true }).click();
    const editor = page.locator("[data-question-local-id]").first();
    const toggleText = label("Permitir elegir varias", "Allow choosing several");
    await editor.getByText(toggleText, { exact: true }).click();
    const confirm = page.getByRole("dialog", { name: label("¿Crear una pregunta nueva?", "Create a new question?"), exact: true });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: label("Cancelar", "Cancel"), exact: true }).click();
    await expect(editor.getByRole("checkbox", { name: toggleText, exact: true })).toBeFocused();
    await expect(editor.getByRole("checkbox", { name: toggleText, exact: true })).not.toBeChecked();
    await editor.getByText(toggleText, { exact: true }).click();
    await confirm.getByRole("button", { name: label("Crear la pregunta nueva", "Create the new question"), exact: true }).click();
    await expect(editor.locator("[data-question-control=label]")).toBeFocused();
    const minimum = editor.getByRole("spinbutton", { name: label("Mínimo", "Minimum"), exact: true });
    const maximum = editor.getByRole("spinbutton", { name: label("Máximo", "Maximum"), exact: true });
    await expect(minimum).toHaveValue("1"); await expect(maximum).toHaveValue("3");
    await maximum.fill("0");
    await expect(page.getByRole("button", { name: label("Guardar borrador", "Save draft"), exact: true })).toBeDisabled();
    await maximum.fill("3");
    await expect(page.getByRole("button", { name: label("Guardar borrador", "Save draft"), exact: true })).toBeEnabled();
    for (const control of [minimum, maximum]) {
      const box = (await control.boundingBox())!;
      expect(box.width).toBeGreaterThan(40);
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    await maximum.scrollIntoViewIfNeeded(); await contained(page, width);
    await page.screenshot({ path: info.outputPath("editor.png"), fullPage: true });
    const preview = page.getByRole("region", { name: label("Vista previa", "Preview"), exact: true });
    await preview.scrollIntoViewIfNeeded();
    if (catalog) {
      await expect(preview.getByRole("checkbox")).toHaveCount(3);
      await preview.getByText("Pérez", { exact: true }).click();
      await expect(preview.getByRole("checkbox", { name: "Pérez", exact: true })).toBeChecked();
      const calls = await page.evaluate(() => (window as typeof window & { catalogsFixture: { calls: { path: string }[] } }).catalogsFixture.calls);
      expect(calls.some(call => call.path.endsWith("/items"))).toBe(true);
      expect(calls.some(call => call.path.includes("catalog-previews") || call.path.includes("catalog-filter-options"))).toBe(false);
    } else {
      await expect(preview.getByText(label("Elegí hasta 3", "Choose up to 3"), { exact: true })).toBeVisible();
      await preview.getByText(label("Frío", "Cold"), { exact: true }).click();
      await preview.getByText(label("Ruido", "Noise"), { exact: true }).click();
      await expect(preview.getByRole("checkbox", { name: label("Frío", "Cold"), exact: true })).toBeChecked();
      await expect(preview.getByRole("checkbox", { name: label("Ruido", "Noise"), exact: true })).toBeChecked();
    }
    await contained(page, width);
    await page.screenshot({ path: info.outputPath("preview.png"), fullPage: true });
    expect(await page.evaluate(() => (window as typeof window & { formsFixture: { writes: unknown[] } }).formsFixture.writes)).toEqual([]);
  });

  test("CA5 ordered choices and any-of filter " + language + " " + width, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const sheetPath = "/formularios/" + responseFullFixtureIds.form + "/respuestas";
    await open(page, sheetPath, language, "responses-full-multiple");
    await expect(page.getByRole("heading", { name: label("Informe de entregas", "Delivery report"), level: 1, exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await closeNav(page, en, width);
    const column = page.getByRole("columnheader", { name: label("Fallas", "Faults"), exact: true });
    await expect(column.getByRole("button")).toHaveCount(0);
    const table = page.locator('[data-slot="table-container"]').first();
    const bounds = (await table.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    if (width < 640) expect(await table.evaluate(node => node.scrollWidth)).toBeGreaterThan(await table.evaluate(node => node.clientWidth));
    await expect(page.getByText(label("Frío, Ruido", "Cold, Noise"), { exact: true })).toBeVisible();
    const longText = label("Refrigeración del mostrador, Ruido en compresor principal, Pérdida de agua en caño", "Counter refrigeration, Noise in main compressor, Water leak in pipe");
    const longCell = page.getByText(longText, { exact: true });
    await longCell.scrollIntoViewIfNeeded();
    const textGeometry = await longCell.evaluate(node => {
      const cell = node.closest("td")!; const bounds = cell.getBoundingClientRect();
      const range = document.createRange(); range.selectNodeContents(node);
      const rects = Array.from(range.getClientRects());
      return { lines: rects.length, contained: rects.every(rect => rect.left >= bounds.left && rect.right <= bounds.right),
        noClip: node.parentElement!.scrollWidth <= node.parentElement!.clientWidth };
    });
    expect(textGeometry.contained).toBe(true); expect(textGeometry.noClip).toBe(true);
    if (width < 640) expect(textGeometry.lines).toBeGreaterThan(1);
    await contained(page, width);
    await page.screenshot({ path: info.outputPath("sheet.png"), fullPage: true });
    const filter = page.getByRole("button", { name: label("Fallas", "Faults"), exact: true });
    await filter.focus(); await page.keyboard.press("Enter");
    await page.getByRole("menuitemcheckbox", { name: new RegExp(label("Frío", "Cold")) }).click();
    await page.keyboard.press("Escape");
    await expect.poll(async () => (await fixture(page)).some(query => query.conditions?.some(condition => condition.operator === "anyOf"))).toBe(true);
    await expect(page.getByRole("link", { name: "TEST-000001", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: label("Fallas: alguna de 1", "Faults: any of 1"), exact: true })).toBeVisible();
    await table.evaluate(node => { node.scrollLeft = 0; });
    await page.getByRole("link", { name: "TEST-000002", exact: true }).click();
    const detail = width < 640 ? page.getByRole("region", { name: label("Respuesta", "Response"), exact: true })
      : page.getByRole("region", { name: label("Detalle de la respuesta", "Response details"), exact: true });
    await expect(detail.getByText(label("Frío", "Cold"), { exact: true })).toBeVisible();
    await expect(detail.getByText(label("Ruido", "Noise"), { exact: true })).toBeVisible();
    await contained(page, width);
    await page.screenshot({ path: info.outputPath("detail.png"), fullPage: true });
    const calls = await page.evaluate(() => (window as typeof window & { formResponseFullFixture: { calls: { method: string; path: string }[] } }).formResponseFullFixture.calls);
    expect(calls.filter(call => call.method !== "GET" &&
      !(call.method === "POST" && /\/records\/(?:search|filter-counts\/search|[^/]+\/navigation)$/.test(call.path)))).toEqual([]);
    expect((await fixture(page)).every(query => query.sortFieldId === undefined)).toBe(true);
  });

  test("CA5 captured choices in chat " + language + " " + width, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, "/whatsapp/chat", language, "forms-chat-multiple");
    await page.getByRole("button", { name: "Juan Gómez", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Juan Gómez", exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const answer = page.getByRole("definition").filter({ hasText: label("Frío, Ruido", "Cold, Noise") });
    await expect(answer).toBeVisible();
    await expect(answer.getByRole("button", { name: /Descargar|Download/ })).toHaveCount(0);
    await contained(page, width);
    await page.screenshot({ path: info.outputPath("chat.png"), fullPage: true });
    expect(await page.evaluate(() => (window as typeof window & { chatFormsFixture: { attempts: unknown[] } }).chatFormsFixture.attempts)).toEqual([]);
  });
}
