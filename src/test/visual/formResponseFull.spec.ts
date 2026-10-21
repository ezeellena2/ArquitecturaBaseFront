import { expect, test, type Page } from "@playwright/test";
import { responseFullFixtureIds } from "./formResponseFullFixtures";

const sheetPath = "/formularios/" + responseFullFixtureIds.form + "/respuestas";
const firstPath = sheetPath + "/" + responseFullFixtureIds.first + "/completa";
const secondPath = sheetPath + "/" + responseFullFixtureIds.second + "/completa";
const fixtureCalls = (page: Page) => page.evaluate(() => (window as typeof window & {
  formResponseFullFixture: { calls: { method: string; path: string }[] };
}).formResponseFullFixture.calls);
async function assertReadOnly(page: Page) {
  const calls = await fixtureCalls(page);
  expect(calls.filter(call => call.method !== "GET" &&
    !(call.method === "POST" && /^\/api\/forms\/definitions\/[^/]+\/records\/(?:search|[^/]+\/navigation)$/.test(call.path)))).toEqual([]);
}
async function assertContained(page: Page, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}
async function assertSheetScroll(page: Page, width: number) {
  const box = page.locator('[data-slot="table-container"]');
  const bounds = (await box.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
  if (width < 640) {
    expect(await box.evaluate(node => node.scrollWidth)).toBeGreaterThan(await box.evaluate(node => node.clientWidth));
    await box.evaluate(node => { node.scrollLeft = node.scrollWidth; });
    expect(await box.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
    await box.evaluate(node => { node.scrollLeft = 0; });
  }
  await assertContained(page, width);
}

for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test("DC0 DC1 real routes and fixed PDF " + language + " " + width, async ({ page }) => {
    const en = language === "en";
    const formName = en ? "Delivery report" : "Informe de entregas";
    const docName = en ? "Receipt-TEST-000002.pdf" : "Comprobante-TEST-000002.pdf";
    const mobile = width < 640;
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/src/test/visual/index.html?screen=/formularios/respuestas&scenario=responses-full&lang=" + language);
    await expect(page.getByRole("heading", { name: en ? "Forms" : "Formularios", level: 1, exact: true })).toBeVisible();
    await page.getByRole("link", { name: formName, exact: true }).click();
    await expect(page.getByRole("heading", { name: formName, level: 1, exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await assertSheetScroll(page, width);
    await page.getByRole("link", { name: "TEST-000002", exact: true }).click();
    if (!mobile) {
      const quick = page.getByRole("region", { name: en ? "Response details" : "Detalle de la respuesta", exact: true });
      await expect(quick.getByRole("link", { name: en ? "Open in full view" : "Abrir en pantalla completa", exact: true })).toHaveAttribute("href", new RegExp(firstPath + "(?:\\?|$)"));
      await page.screenshot({ path: "test-results/response-full-quick-" + language + "-" + width + ".png", fullPage: true });
      await quick.getByRole("link", { name: en ? "Open in full view" : "Abrir en pantalla completa", exact: true }).click();
    }
    await expect(page.getByRole("heading", { name: "TEST-000002", level: 1, exact: true })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(firstPath);
    await expect(page.getByRole("table", { includeHidden: true })).toHaveCount(0);
    const answer = page.getByRole("region", { name: en ? "Response" : "Respuesta", exact: true });
    const activity = page.getByRole("region", { name: en ? "Activity" : "Actividad", exact: true });
    await expect(answer.getByRole("button", { name: en ? "Collapse response" : "Plegar respuesta", exact: true })).toHaveAttribute("aria-expanded", "true");
    await expect(activity.getByRole("button", { name: en ? mobile ? "Expand activity" : "Collapse activity" : mobile ? "Expandir actividad" : "Plegar actividad", exact: true })).toHaveAttribute("aria-expanded", String(!mobile));
    await page.evaluate(() => document.fonts.ready);
    if (mobile) expect((await fixtureCalls(page)).filter(call => call.path.includes("/documents/"))).toEqual([]);
    await assertContained(page, width);
    await page.screenshot({ path: "test-results/response-full-initial-" + language + "-" + width + ".png", fullPage: true });
    const fold = answer.getByRole("button", { name: en ? "Collapse response" : "Plegar respuesta", exact: true });
    await fold.focus(); await page.keyboard.press("Enter");
    const unfold = answer.getByRole("button", { name: en ? "Expand response" : "Expandir respuesta", exact: true });
    await expect(unfold).toBeFocused();
    await expect(unfold).toHaveAttribute("aria-expanded", "false");
    await unfold.click();
    if (mobile) await activity.getByRole("button", { name: en ? "Expand activity" : "Expandir actividad", exact: true }).click();
    const pdfAction = activity.getByRole("listitem").filter({ has: page.getByText(en ? "Generate PDF" : "Armar el PDF", { exact: true }) }).last();
    await expect(pdfAction.getByText(docName, { exact: true })).toBeVisible();
    const mini = pdfAction.locator('iframe[title="' + (en ? "PDF preview" : "Vista previa del PDF") + '"]');
    await expect(mini).toBeVisible();
    const miniBounds = (await mini.boundingBox())!;
    expect(miniBounds.width).toBeLessThanOrEqual(320);
    expect(miniBounds.height).toBeLessThanOrEqual(180);
    await expect.poll(async () => (await fixtureCalls(page)).filter(call => call.path.includes("/documents/")).length).toBe(1);
    await answer.getByRole("button", { name: en ? "Collapse response" : "Plegar respuesta", exact: true }).click();
    await activity.scrollIntoViewIfNeeded();
    await assertContained(page, width);
    await page.screenshot({ path: "test-results/response-full-activity-" + language + "-" + width + ".png", fullPage: true });
    const view = pdfAction.getByRole("button", { name: en ? "View PDF" : "Ver PDF", exact: true });
    const fullUrl = page.url();
    await view.click();
    const dialog = page.getByRole("dialog", { name: en ? "Fixed copy" : "Copia fija", exact: true });
    await expect(dialog.locator("iframe")).toBeVisible();
    expect(page.url()).toBe(fullUrl);
    expect((await fixtureCalls(page)).filter(call => call.path.includes("/documents/"))).toHaveLength(1);
    await page.screenshot({ path: "test-results/response-full-pdf-" + language + "-" + width + ".png", fullPage: true });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0); await expect(view).toBeFocused();
    await page.getByRole("button", { name: en ? "Download" : "Descargar", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: docName, exact: true })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "comprobante.pdf", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    const focusOwner = page.locator("main [tabindex='-1'][aria-busy]");
    await focusOwner.focus(); await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("heading", { name: "TEST-000001", level: 1, exact: true })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(secondPath);
    await expect(focusOwner).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(page.getByRole("heading", { name: "TEST-000002", level: 1, exact: true })).toBeVisible();
    await page.getByRole("link", { name: en ? "Back to responses" : "Volver a las respuestas", exact: true }).click();
    const row = page.getByRole("link", { name: "TEST-000002", exact: true });
    await expect(row).toBeFocused();
    await expect(row.locator("xpath=ancestor::tr")).toHaveAttribute("aria-selected", "true");
    await assertSheetScroll(page, width); await assertReadOnly(page);
  });

  test("DC0 decision-only keeps metadata instead of full " + language + " " + width, async ({ page }) => {
    const en = language === "en";
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/src/test/visual/index.html?screen=/formularios/respuestas&scenario=responses-full-decide&lang=" + language);
    await expect(page.getByRole("heading", { name: en ? "Forms" : "Formularios", level: 1, exact: true })).toBeVisible();
    await page.getByRole("link", { name: en ? "Delivery report" : "Informe de entregas", exact: true }).click();
    await page.getByRole("link", { name: (en ? "Review" : "Revisar") + " TEST-000002", exact: true }).click();
    const panel = page.getByRole(width < 640 ? "dialog" : "region", { name: en ? "Response details" : "Detalle de la respuesta", exact: true });
    await expect(panel.getByRole("button", { name: en ? "Approve" : "Aprobar", exact: true })).toBeVisible();
    await expect(panel.getByRole("link", { name: en ? "Open in full view" : "Abrir en pantalla completa", exact: true })).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe(sheetPath);
    await page.evaluate(() => document.fonts.ready); await assertContained(page, width);
    await page.screenshot({ path: "test-results/response-full-decide-" + language + "-" + width + ".png", fullPage: true });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("link", { name: (en ? "Review" : "Revisar") + " TEST-000002", exact: true })).toBeFocused();
    expect((await fixtureCalls(page)).filter(call => /^\/api\/forms\/(?:records\/|definitions\/[^/]+\/records)/.test(call.path))).toEqual([]);
    await assertReadOnly(page);
  });
}
