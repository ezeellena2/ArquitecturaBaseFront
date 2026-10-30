import { expect, test, type Page } from "@playwright/test";
import { responseFormId } from "../responseFixtures";
import { formEntryFixtureIds } from "./formEntryFixtures";

// Evidence of loading from the app (CW1-B to CW6-A), without goldens: each capture is compared with its board.
const open = (page: Page, screen: string, scenario: string, language: string) =>
  page.goto("/src/test/visual/index.html?screen=" + encodeURIComponent(screen) + "&scenario=" + scenario + "&lang=" + language);
const routePath = (page: Page) => page.evaluate(() => (window as unknown as { visualRouterLocation: { pathname: string } }).visualRouterLocation.pathname);

async function assertNoPageScroll(page: Page, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}

async function photo(page: Page, name: string, fill: string) {
  const base64 = await page.evaluate(async color => {
    const canvas = new OffscreenCanvas(320, 240);
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#dfe8d9"; context.fillRect(0, 0, 320, 240);
    context.fillStyle = color; context.fillRect(60, 50, 200, 140);
    const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 })).arrayBuffer());
    let text = "";
    for (const byte of bytes) text += String.fromCharCode(byte);
    return btoa(text);
  }, fill);
  return { name, mimeType: "image/jpeg", buffer: Buffer.from(base64, "base64") };
}

/** The send travels by XMLHttpRequest, outside the fetch double: the scene answers it here, after a moment of progress. */
async function answerSend(page: Page, number: string) {
  const sends: string[] = [];
  await page.route(url => url.pathname.startsWith("/api/forms/entries/"), async route => {
    if (route.request().method() !== "POST") return route.fallback();
    sends.push(route.request().url());
    await new Promise(resolve => setTimeout(resolve, 400));
    await route.fulfill({ json: { recordId: "0199a0c0-0000-7000-8000-000000000690", number, state: "Received", submittedAtUtc: "2026-10-30T13:52:00Z" } });
  });
  return sends;
}

const questionsPerRow = (page: Page) => page.locator("[data-entry-row]").evaluateAll(rows => rows.map(row => row.children.length));

async function assertControlsInsideRows(page: Page) {
  const outside = await page.locator("[data-entry-row]").evaluateAll(rows => rows.flatMap(row => {
    const bounds = row.getBoundingClientRect();
    return [...row.querySelectorAll("input:not([type=file]), textarea, select, button")].filter(control => control.getBoundingClientRect().right > bounds.right + 1)
      .map(control => control.getAttribute("aria-label") ?? control.id);
  }));
  expect(outside).toEqual([]);
}

async function choose(page: Page, label: string, option: string, phone: boolean) {
  if (phone) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.getByRole("dialog", { name: label }).getByRole("option").filter({ hasText: option }).first().click();
  } else {
    await page.getByRole("combobox", { name: label, exact: true }).click();
    await page.getByRole("listbox", { name: label }).getByRole("option").filter({ hasText: option }).first().click();
  }
}

for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test("CW2-A to CW5 loading a sowing " + language + " " + width, async ({ page }) => {
    const es = language === "es";
    const phone = width < 640;
    const lot = es ? "Lote" : "Lot";
    await page.setViewportSize({ width, height: 900 });
    await open(page, "/formularios/" + formEntryFixtureIds.sowing + "/cargar", "entries", language);
    await expect(page.getByRole("heading", { name: es ? "Nueva respuesta" : "New response", level: 1 })).toBeVisible();
    await expect(page.getByText(es ? "Solo los lotes de tu campo en la campaña 2026/27." : "Only the lots of your field in the 2026/27 season.")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await assertNoPageScroll(page, width);
    // CW16: the rows are built with the columns in use, so every visible row has its line.
    expect(await questionsPerRow(page)).toEqual(phone ? [1, 1, 1, 1, 1, 1, 1, 1] : [1, 1, 2, 2, 1, 1]);
    await assertControlsInsideRows(page);
    await page.screenshot({ path: "test-results/form-entry-page-" + language + "-" + width + ".png", fullPage: true });

    const send = page.getByRole("button", { name: es ? "Enviar" : "Send", exact: true });
    await send.click();
    await expect(page.getByText(es ? "Elegí una opción." : "Choose an option.").first()).toBeVisible();
    await expect(phone ? page.getByRole("button", { name: lot, exact: true }) : page.getByRole("combobox", { name: lot, exact: true })).toBeFocused();
    await page.screenshot({ path: "test-results/form-entry-errors-" + language + "-" + width + ".png", fullPage: true });

    // CW3: the list is searched in the server, fifty at a time; on the phone it opens full screen.
    if (phone) {
      await page.getByRole("button", { name: lot, exact: true }).click();
      const list = page.getByRole("dialog", { name: lot });
      await expect(list.getByText(es ? "58 opciones" : "58 options")).toBeVisible();
      await expect(list.getByRole("button", { name: es ? "Mostrar 50 más" : "Show 50 more" })).toBeVisible();
      await page.screenshot({ path: "test-results/form-entry-catalog-" + language + "-" + width + ".png" });
      await list.getByRole("option").filter({ hasText: es ? "Lote 2" : "Lot 2" }).first().click();
      await expect(list).toHaveCount(0);
    } else {
      await page.getByRole("combobox", { name: lot, exact: true }).click();
      const list = page.getByRole("listbox", { name: lot });
      await expect(list.getByText(es ? "58 opciones" : "58 options")).toBeVisible();
      await expect(list.getByRole("button", { name: es ? "Mostrar 50 más" : "Show 50 more" })).toBeVisible();
      await page.screenshot({ path: "test-results/form-entry-catalog-" + language + "-" + width + ".png" });
      await list.getByRole("option").filter({ hasText: es ? "Lote 2" : "Lot 2" }).first().click();
    }
    await page.getByRole("radio", { name: es ? "Soja 1ª" : "1st soybean" }).click();
    await choose(page, es ? "Semilla" : "Seed", "DM 46i20", phone);
    await page.getByLabel(es ? "Densidad" : "Density").fill("72,5");
    await page.getByLabel(es ? "Hectáreas sembradas" : "Sown hectares").fill("120");
    await page.getByLabel(es ? "Fecha de siembra" : "Sowing date").fill("2026-10-29");

    // CW4: the photos travel with the send; on the phone the camera comes first.
    if (phone) await expect(page.getByRole("button", { name: es ? "Tomar foto" : "Take a photo" })).toBeVisible();
    await page.locator('input[type="file"]:not([capture])').setInputFiles([await photo(page, "IMG_2231.jpg", "#285943"), await photo(page, "IMG_2232.jpg", "#7a5c2e")]);
    await expect(page.getByRole("img", { name: "IMG_2232.jpg" })).toBeVisible();
    await expect(page.getByText(es ? "2 de 3" : "2 of 3")).toBeVisible();
    await assertNoPageScroll(page, width);
    await page.screenshot({ path: "test-results/form-entry-photos-" + language + "-" + width + ".png", fullPage: true });

    // CW5: the button says the progress, then what was sent.
    const sends = await answerSend(page, "SIE-000013");
    await send.click();
    await expect(page.getByRole("button", { name: es ? /^Enviando…/ : /^Sending…/ })).toBeVisible();
    await page.screenshot({ path: "test-results/form-entry-sending-" + language + "-" + width + ".png" });
    await expect(page.getByRole("heading", { name: "SIE-000013", level: 1 })).toBeVisible();
    await expect(page.getByText(es ? "Enviada" : "Sent", { exact: true })).toBeVisible();
    await expect(page.getByText(es ? "Recibida" : "Received", { exact: true })).toBeVisible();
    expect(sends).toHaveLength(1);
    await assertNoPageScroll(page, width);
    await page.screenshot({ path: "test-results/form-entry-sent-" + language + "-" + width + ".png", fullPage: true });
  });
}

for (const language of ["es", "en"] as const) {
  test("CW16 rows of two columns on a tablet " + language, async ({ page }) => {
    const es = language === "es";
    await page.setViewportSize({ width: 768, height: 1024 });
    await open(page, "/formularios/" + formEntryFixtureIds.sowing + "/cargar", "entries", language);
    await expect(page.getByRole("heading", { name: es ? "Nueva respuesta" : "New response", level: 1 })).toBeVisible();
    await expect(page.getByText(es ? "Solo los lotes de tu campo en la campaña 2026/27." : "Only the lots of your field in the 2026/27 season.")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await assertNoPageScroll(page, 768);
    // With the forms panel open the zone is as narrow as a phone: one question per row and nothing out of its row.
    expect(await questionsPerRow(page)).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
    await assertControlsInsideRows(page);
    await page.screenshot({ path: "test-results/form-entry-page-" + language + "-768.png", fullPage: true });
    // Closing the panel leaves room for two: Lote, Cultivo and Semilla take both, Densidad and Hectáreas share a row.
    await page.getByRole("button", { name: es ? "Cerrar el panel Formularios" : "Close the Forms panel", exact: true }).click();
    await expect.poll(() => questionsPerRow(page)).toEqual([1, 1, 1, 2, 1, 1, 1]);
    await assertControlsInsideRows(page);
    await page.screenshot({ path: "test-results/form-entry-page-" + language + "-768-two-columns.png", fullPage: true });
  });
}

for (const language of ["es", "en"] as const) for (const width of [1440, 390]) {
  test("CW2-A without the person's datum " + language + " " + width, async ({ page }) => {
    const es = language === "es";
    await page.setViewportSize({ width, height: 900 });
    await open(page, "/formularios/" + formEntryFixtureIds.sowing + "/cargar", "entries-missing-data", language);
    await expect(page.getByText(es ? "No podés enviar Siembra: te falta el dato «Campo». Pedíselo a quien administra los datos de las personas."
      : "You cannot send Sowing: your «Field» is missing. Ask whoever manages people's data for it.")).toBeVisible();
    await expect(page.getByRole("button", { name: es ? "Enviar" : "Send", exact: true })).toBeDisabled();
    await page.evaluate(() => document.fonts.ready);
    await assertNoPageScroll(page, width);
    await page.screenshot({ path: "test-results/form-entry-missing-data-" + language + "-" + width + ".png", fullPage: true });
  });
}

for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) for (const profile of ["create-only", "read-create"] as const) {
  test("CW1-B overview with «Cargar» " + profile + " " + language + " " + width, async ({ page }) => {
    const es = language === "es";
    const sowing = es ? "Siembra" : "Sowing";
    await page.setViewportSize({ width, height: 900 });
    await open(page, "/formularios/respuestas", profile === "create-only" ? "entries-create-only" : "entries", language);
    await expect(page.getByRole("heading", { name: es ? "Formularios" : "Forms", level: 1, exact: true })).toBeVisible();
    const table = page.getByRole("table");
    const load = table.getByRole("button", { name: (es ? "Cargar " : "Load ") + sowing, exact: true });
    await expect(load).toBeVisible();
    if (profile === "create-only") {
      await expect(table.getByRole("link", { name: sowing, exact: true })).toHaveCount(0);
      await expect(page.getByRole("group", { name: es ? "Estado de los formularios" : "Form status" })).toHaveCount(0);
    } else await expect(table.getByRole("link", { name: sowing, exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const area = page.locator('[data-slot="table-container"]');
    const bounds = (await area.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await assertNoPageScroll(page, width);
    await page.screenshot({ path: "test-results/form-entry-overview-" + profile + "-" + language + "-" + width + ".png", fullPage: true });
    if (profile === "create-only") {
      if (width < 640) await area.evaluate(node => { node.scrollLeft = node.scrollWidth; });
      await load.click();
      await expect(page.getByRole("heading", { name: es ? "Nueva respuesta" : "New response", level: 1 })).toBeVisible();
      expect(await routePath(page)).toBe("/formularios/" + formEntryFixtureIds.sowing + "/cargar");
    }
  });
}

for (const language of ["es", "en"] as const) {
  test("CW2-B loading next to the sheet " + language, async ({ page }) => {
    const es = language === "es";
    const amount = es ? "Importe" : "Amount";
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "/formularios/" + responseFormId + "/respuestas", "responses-app", language);
    await expect(page.getByRole("link", { name: "TEST-000002", exact: true })).toBeVisible();
    await page.getByRole("button", { name: es ? "Agregar respuesta" : "Add response", exact: true }).click();
    const panel = page.getByRole("region", { name: es ? "Nueva respuesta de Informe de entregas" : "New response to Delivery report" });
    await expect(panel.getByLabel(amount)).toBeVisible();
    await expect(page.getByRole("link", { name: "TEST-000002", exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: "test-results/form-entry-panel-" + language + "-1440.png" });
    await panel.getByRole("button", { name: es ? "Enviar" : "Send", exact: true }).click();
    await expect(panel.getByText(es ? "Completá esta respuesta." : "Fill in this answer.")).toBeVisible();
    await page.screenshot({ path: "test-results/form-entry-panel-errors-" + language + "-1440.png" });
    await panel.getByLabel(amount).fill("1250");
    // The label covers the checkbox row, as in CheckboxField.
    await panel.getByText(es ? "Mantener las respuestas para la siguiente" : "Keep the answers for the next one", { exact: true }).click();
    await expect(panel.getByRole("checkbox", { name: es ? "Mantener las respuestas para la siguiente" : "Keep the answers for the next one" })).toBeChecked();
    const sends = await answerSend(page, "TEST-000003");
    await panel.getByRole("button", { name: es ? "Enviar" : "Send", exact: true }).click();
    await expect(page.getByText(es ? "Se guardó TEST-000003" : "TEST-000003 was saved")).toBeVisible();
    await expect(page.getByText(es ? "Informe de entregas · Recibida" : "Delivery report · Received")).toBeVisible();
    expect(sends).toHaveLength(1);
    await expect(panel.getByLabel(amount)).toHaveValue("1250");
    await page.screenshot({ path: "test-results/form-entry-panel-saved-" + language + "-1440.png" });
  });
}

for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test("CW6-A sheet with the app channel " + language + " " + width, async ({ page }) => {
    const es = language === "es";
    const channel = es ? "Canal" : "Channel";
    await page.setViewportSize({ width, height: 900 });
    await open(page, "/formularios/" + responseFormId + "/respuestas", "responses-app", language);
    await expect(page.getByRole("link", { name: "TEST-000002", exact: true })).toBeVisible();
    const table = page.getByRole("table", { includeHidden: true });
    await expect(table.getByRole("columnheader", { name: channel, exact: true })).toBeAttached();
    await expect(table.getByText("App", { exact: true })).toBeAttached();
    await page.evaluate(() => document.fonts.ready);
    await assertNoPageScroll(page, width);
    await page.screenshot({ path: "test-results/form-entry-sheet-" + language + "-" + width + ".png", fullPage: true });
    await page.getByRole("combobox", { name: channel, exact: true }).selectOption({ label: "App" });
    await expect(page.getByRole("button", { name: (es ? "Quitar filtro: " : "Remove filter: ") + channel + ": App", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "TEST-000001", exact: true })).toHaveCount(0);
    await assertNoPageScroll(page, width);
    await page.screenshot({ path: "test-results/form-entry-sheet-app-" + language + "-" + width + ".png", fullPage: true });
    await page.getByRole("link", { name: "TEST-000002", exact: true }).click();
    // On the phone the full response keeps its activity folded.
    const expand = page.getByRole("button", { name: es ? "Expandir actividad" : "Expand activity", exact: true });
    if (width < 640) await expand.click();
    await expect(page.getByText(es ? /en la app, la cargó/i : /in the app, loaded by/i).first()).toBeVisible();
    await page.screenshot({ path: "test-results/form-entry-origin-" + language + "-" + width + ".png", fullPage: true });
  });
}
