import { expect, test, type Page } from "@playwright/test";
import { responseFullFixtureIds } from "./formResponseFullFixtures";

const sheetPath = "/formularios/" + responseFullFixtureIds.form + "/respuestas";
const firstPath = sheetPath + "/" + responseFullFixtureIds.first + "/completa";
const secondPath = sheetPath + "/" + responseFullFixtureIds.second + "/completa";
const fixtureCalls = (page: Page) => page.evaluate(() => (window as typeof window & {
  formResponseFullFixture: { calls: { method: string; path: string }[] };
}).formResponseFullFixture.calls);
const routerLocation = (page: Page) => page.evaluate(() => (window as typeof window & {
  visualRouterLocation: { pathname: string; search: string };
}).visualRouterLocation);
async function assertReadOnly(page: Page) {
  const calls = await fixtureCalls(page);
  expect(calls.filter(call => call.method !== "GET" &&
    !(call.method === "POST" && /^\/api\/forms\/definitions\/[^/]+\/records\/(?:search|[^/]+\/navigation)$/.test(call.path)))).toEqual([]);
}
async function assertContained(page: Page, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}
/** What the breadcrumbs show: the displayed items, none squeezed to nothing, and the leaf whole inside the bar. */
async function shownCrumbs(page: Page, language: string) {
  return page.getByRole("navigation", { name: language === "en" ? "Breadcrumb" : "Migas de pan", exact: true }).locator("ol").evaluate(list => {
    const shown = [...list.children].filter(item => item.checkVisibility());
    const leaf = list.querySelector('[aria-current="page"]')!;
    return {
      items: shown.map(item => item.textContent!.trim()),
      squeezed: shown.filter(item => item.getBoundingClientRect().width < 1).length,
      leafCut: leaf.getBoundingClientRect().right > list.getBoundingClientRect().right + 1 || leaf.scrollWidth > leaf.clientWidth + 1,
    };
  });
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
    const search = page.getByRole("searchbox", { name: en ? "Search long text answers" : "Buscar en textos largos", exact: true });
    const privateSearch = "Texto"; // Matches the observed long-text fixture while remaining private route state.
    const searches = async () => (await fixtureCalls(page)).filter(call => call.method === "POST" && call.path.endsWith("/records/search")).length;
    const beforeSearch = await searches();
    await search.fill(privateSearch);
    await expect.poll(searches).toBe(beforeSearch + 1);
    await page.getByRole("link", { name: "TEST-000002", exact: true }).click();
    if (!mobile) {
      const quick = page.getByRole("region", { name: en ? "Response details" : "Detalle de la respuesta", exact: true });
      await expect(quick.getByRole("link", { name: en ? "Open in full view" : "Abrir en pantalla completa", exact: true })).toHaveAttribute("href", new RegExp(firstPath + "(?:\\?|$)"));
      await page.screenshot({ path: "test-results/response-full-quick-" + language + "-" + width + ".png", fullPage: true });
      await quick.getByRole("link", { name: en ? "Open in full view" : "Abrir en pantalla completa", exact: true }).click();
    }
    await expect(page.getByRole("heading", { name: "TEST-000002", level: 1, exact: true })).toBeVisible();
    expect(await routerLocation(page)).toEqual({ pathname: firstPath, search: "" });
    // The whole trail on the computer; with a header as narrow as a phone's, only the form and the number.
    await expect.poll(() => shownCrumbs(page, language)).toEqual({ items: mobile ? [formName, "/", "TEST-000002"]
      : [en ? "Home" : "Inicio", "/", en ? "Form management" : "Gestión de formularios", "/", en ? "Forms" : "Formularios", "/", formName, "/", "TEST-000002"], squeezed: 0, leafCut: false });
    if (mobile) {
      const breadcrumbs = page.getByRole("navigation", { name: en ? "Breadcrumb" : "Migas de pan", exact: true });
      const parent = breadcrumbs.getByRole("link", { name: formName, exact: true }).locator("..");
      const leaf = breadcrumbs.locator('[aria-current="page"]');
      await expect(parent).toBeVisible();
      await expect(leaf).toHaveText("TEST-000002");
      expect(await parent.evaluate(node => {
        const range = document.createRange();
        const text = node.querySelector("a")!.firstChild!;
        range.setStart(text, 0); range.setEnd(text, text.textContent!.indexOf(" "));
        return node.clientWidth >= range.getBoundingClientRect().width;
      })).toBe(true);
      expect(await leaf.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    }
    await expect(page.getByRole("table", { includeHidden: true })).toHaveCount(0);
    const answer = page.getByRole("region", { name: en ? "Response" : "Respuesta", exact: true });
    const activity = page.getByRole("region", { name: en ? "Activity" : "Actividad", exact: true });
    await expect(answer.getByRole("button", { name: en ? "Collapse response" : "Plegar respuesta", exact: true })).toHaveAttribute("aria-expanded", "true");
    await expect(activity.getByRole("button", { name: en ? mobile ? "Expand activity" : "Collapse activity" : mobile ? "Expandir actividad" : "Plegar actividad", exact: true })).toHaveAttribute("aria-expanded", String(!mobile));
    await page.evaluate(() => document.fonts.ready);
    if (mobile) expect((await fixtureCalls(page)).filter(call => call.path.includes("/documents/"))).toEqual([]);
    const attachmentName = answer.getByText("comprobante.pdf", { exact: true });
    const fileBounds = (await attachmentName.boundingBox())!;
    const valueBounds = (await attachmentName.locator("xpath=ancestor::dd").boundingBox())!;
    const attachmentRow = attachmentName.locator("..").locator("..");
    const downloadBounds = (await attachmentRow.getByRole("button", { name: en ? "Download" : "Descargar", exact: true }).boundingBox())!;
    expect(fileBounds.width).toBeGreaterThanOrEqual(valueBounds.width * 0.7);
    expect(fileBounds.x).toBeGreaterThanOrEqual(valueBounds.x);
    expect(fileBounds.x + fileBounds.width).toBeLessThanOrEqual(valueBounds.x + valueBounds.width);
    expect(fileBounds.x + fileBounds.width <= downloadBounds.x || fileBounds.y + fileBounds.height <= downloadBounds.y).toBe(true);
    expect(await attachmentRow.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
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
    // Board TL3-A: the copy is a row of «Al aprobarla», with its file and language under the action and «Ver PDF» and
    // «Descargar» in Acciones, without a small preview: nothing is read until it is opened.
    await expect(pdfAction.getByText(new RegExp("^" + docName.replace(".", "\\.") + " · "))).toBeVisible();
    await expect(pdfAction.locator("iframe")).toHaveCount(0);
    expect((await fixtureCalls(page)).filter(call => call.path.includes("/documents/"))).toEqual([]);
    await answer.getByRole("button", { name: en ? "Collapse response" : "Plegar respuesta", exact: true }).click();
    await activity.scrollIntoViewIfNeeded();
    await assertContained(page, width);
    await page.screenshot({ path: "test-results/response-full-activity-" + language + "-" + width + ".png", fullPage: true });
    const view = pdfAction.getByRole("button", { name: en ? "View PDF" : "Ver PDF", exact: true });
    const fullLocation = await routerLocation(page);
    await view.click();
    const dialog = page.getByRole("dialog", { name: en ? "Fixed copy" : "Copia fija", exact: true });
    await expect(dialog.locator("iframe")).toBeVisible();
    expect(await routerLocation(page)).toEqual(fullLocation);
    expect((await fixtureCalls(page)).filter(call => call.path.includes("/documents/"))).toHaveLength(1);
    await page.screenshot({ path: "test-results/response-full-pdf-" + language + "-" + width + ".png", fullPage: true });
    await dialog.focus(); // The native PDF frame otherwise owns keyboard events.
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0); await expect(view).toBeFocused();
    const headerDownload = page.getByRole("button", { name: en ? "Download" : "Descargar", exact: true, expanded: false });
    await headerDownload.click();
    await expect(page.getByRole("menuitem", { name: docName, exact: true })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "comprobante.pdf", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(headerDownload).toBeFocused();
    const focusOwner = page.locator("main [tabindex='-1'][aria-busy]");
    await expect(focusOwner).toHaveAttribute("aria-busy", "false");
    await focusOwner.focus(); await expect(focusOwner).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("heading", { name: "TEST-000001", level: 1, exact: true })).toBeVisible();
    expect((await routerLocation(page)).pathname).toBe(secondPath);
    await expect(focusOwner).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(page.getByRole("heading", { name: "TEST-000002", level: 1, exact: true })).toBeVisible();
    await page.getByRole("link", { name: en ? "Back to responses" : "Volver a las respuestas", exact: true }).click();
    const row = page.getByRole("link", { name: "TEST-000002", exact: true });
    await expect(row).toBeFocused();
    await expect(page.getByRole("searchbox", { name: en ? "Search long text answers" : "Buscar en textos largos", exact: true })).toHaveValue(privateSearch);
    await expect(row.locator("xpath=ancestor::tr")).toHaveAttribute("aria-selected", "true");
    await assertSheetScroll(page, width); await assertReadOnly(page);
  });

  test("DC0 DC1 pending keyboard with Read and Decide " + language + " " + width, async ({ page }) => {
    const en = language === "en", mobile = width < 640;
    const formName = en ? "Delivery report" : "Informe de entregas";
    const reviewName = (en ? "Review" : "Revisar") + " TEST-000002";
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/src/test/visual/index.html?screen=/formularios/respuestas&scenario=responses-full-read-decide&lang=" + language);
    await expect(page.getByRole("heading", { name: en ? "Forms" : "Formularios", level: 1, exact: true })).toBeVisible();
    await page.getByRole("link", { name: formName, exact: true }).click();
    await expect(page.getByRole("heading", { name: formName, level: 1, exact: true })).toBeVisible();
    const pending = page.getByRole("region", { name: en ? "To approve · 2" : "Por aprobar · 2", exact: true });
    await expect(pending.getByRole("link", { name: reviewName, exact: true })).toBeVisible();
    for (const table of await page.locator('[data-slot="table-container"]').all()) {
      const bounds = (await table.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    }
    await pending.getByRole("link", { name: reviewName, exact: true }).click();
    if (!mobile) {
      const quick = page.getByRole("region", { name: en ? "Response details" : "Detalle de la respuesta", exact: true });
      await expect(quick.getByRole("heading", { name: "TEST-000002", exact: true })).toBeVisible();
      await expect(quick.getByRole("button", { name: en ? "Approve" : "Aprobar", exact: true })).toBeVisible();
      await page.screenshot({ path: "test-results/response-full-pending-quick-" + language + "-" + width + ".png", fullPage: true });
      await quick.getByRole("link", { name: en ? "Open in full view" : "Abrir en pantalla completa", exact: true }).click();
    }
    await expect(page.getByRole("heading", { name: "TEST-000002", level: 1, exact: true })).toBeVisible();
    expect(await routerLocation(page)).toEqual({ pathname: firstPath, search: "" });
    await expect(page.getByText(en ? "1 of 2 to approve" : "1 de 2 por aprobar", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: en ? "Approve" : "Aprobar", exact: true })).toBeVisible();
    const owner = page.locator("main [tabindex='-1'][aria-busy]");
    await expect(owner).toHaveAttribute("aria-busy", "false");
    await owner.focus(); await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("heading", { name: "TEST-000001", level: 1, exact: true })).toBeVisible();
    expect((await routerLocation(page)).pathname).toBe(secondPath);
    await expect(page.getByText(en ? "2 of 2 to approve" : "2 de 2 por aprobar", { exact: true })).toBeVisible();
    await expect(owner).toHaveAttribute("aria-busy", "false"); await expect(owner).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(page.getByRole("heading", { name: "TEST-000002", level: 1, exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready); await assertContained(page, width);
    await page.screenshot({ path: "test-results/response-full-pending-" + language + "-" + width + ".png", fullPage: true });
    await page.getByRole("link", { name: en ? "Back to responses" : "Volver a las respuestas", exact: true }).click();
    expect((await routerLocation(page)).pathname).toBe(sheetPath);
    const selected = page.getByRole("link", { name: reviewName, exact: true });
    await expect(selected).toBeFocused();
    await expect(selected.locator("xpath=ancestor::tr")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole(mobile ? "dialog" : "region", { name: en ? "Response details" : "Detalle de la respuesta", exact: true })).toHaveCount(0);
    expect((await fixtureCalls(page)).filter(call => call.path.endsWith("/navigation") || call.path.endsWith("/continuation"))).toEqual([]);
    await assertContained(page, width); await assertReadOnly(page);
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
    expect((await routerLocation(page)).pathname).toBe(sheetPath);
    await page.evaluate(() => document.fonts.ready); await assertContained(page, width);
    await page.screenshot({ path: "test-results/response-full-decide-" + language + "-" + width + ".png", fullPage: true });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("link", { name: (en ? "Review" : "Revisar") + " TEST-000002", exact: true })).toBeFocused();
    expect((await fixtureCalls(page)).filter(call => /^\/api\/forms\/(?:records\/|definitions\/[^/]+\/records)/.test(call.path))).toEqual([]);
    await assertReadOnly(page);
  });
}

for (const language of ["es", "en"] as const) {
  test("DC1 breadcrumbs on a tablet with the forms panel " + language, async ({ page }) => {
    const en = language === "en";
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/src/test/visual/index.html?screen=" + encodeURIComponent(firstPath) + "&scenario=responses-full&lang=" + language);
    await expect(page.getByRole("heading", { name: "TEST-000002", level: 1, exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    // With the forms panel open the header is as narrow as a phone's: only the form and the number, nothing empty or cut.
    const short = { items: [en ? "Delivery report" : "Informe de entregas", "/", "TEST-000002"], squeezed: 0, leafCut: false };
    await expect.poll(() => shownCrumbs(page, language)).toEqual(short);
    await assertContained(page, 768);
    await page.screenshot({ path: "test-results/response-full-tablet-" + language + "-768.png" });
    // Closed, the header is still under the phone's 40 rem.
    await page.getByRole("button", { name: en ? "Close the Forms panel" : "Cerrar el panel Formularios", exact: true }).click();
    expect(await shownCrumbs(page, language)).toEqual(short);
    await page.screenshot({ path: "test-results/response-full-tablet-closed-" + language + "-768.png" });
    await assertReadOnly(page);
  });
}
