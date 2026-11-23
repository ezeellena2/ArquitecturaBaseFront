import { expect, test, type Page } from "@playwright/test";
import { formOverviewFixtureIds } from "./formOverviewFixtures";

// MF1 evidence only. These scenes exercise reads and never submit a mutation or update a golden.
async function assertContainedTable(page: Page, width: number, mustScroll: boolean) {
  const area = page.locator('[data-slot="table-container"]');
  const bounds = (await area.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
  const geometry = await area.evaluate(node => ({ width: node.clientWidth, content: node.scrollWidth }));
  if (mustScroll) expect(geometry.content).toBeGreaterThan(geometry.width);
  if (geometry.content > geometry.width) {
    await area.evaluate(node => { node.scrollLeft = node.scrollWidth; });
    expect(await area.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await area.evaluate(node => { node.scrollLeft = 0; });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}

async function assertOverviewGeometry(page: Page, width: number) {
  if (width >= 1024) {
    // The state of the bar, the button of the piece to choose (2026-11-22), not the rows per page under the table.
    const controls = [page.getByRole("searchbox"), page.getByRole("button", { name: /^(Estado de los formularios|Form status) / })];
    const bounds = await Promise.all(controls.map(control => control.boundingBox()));
    const boxes = bounds.map(box => box!);
    expect(Math.min(...boxes.map(box => box.y + box.height))).toBeGreaterThan(Math.max(...boxes.map(box => box.y)));
  }
  // These fixture names and values fit on one line; horizontal overflow belongs to the table region.
  for (const row of await page.getByRole("table").locator("tbody tr").all())
    expect((await row.boundingBox())!.height).toBeLessThanOrEqual(40);
}

// The state is the button of the bar of the piece to choose (2026-11-22): it says the chosen one, without counts, and its list
// ticks it among its states: for whoever reads and decides, «Con algo por aprobar» goes between the two (FU4, 2026-11-23).
async function assertStateControls(page: Page, es: boolean, state: "active" | "deactivated", width: number, pending: boolean) {
  const chosen = state === "active" ? (es ? "Activos" : "Active") : (es ? "Dados de baja" : "Deactivated");
  const trigger = page.getByRole("button", { name: (es ? "Estado de los formularios " : "Form status ") + chosen, exact: true });
  await expect(trigger).toBeVisible();
  const bounds = (await trigger.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
  expect(await trigger.evaluate(node => node.scrollWidth)).toBeLessThanOrEqual(await trigger.evaluate(node => node.clientWidth));
  await trigger.click();
  const list = page.getByRole("listbox", { name: es ? "Estado de los formularios" : "Form status", exact: true });
  await expect(list.getByRole("option")).toHaveText(es
    ? ["Activos", ...(pending ? ["Con algo por aprobar"] : []), "Dados de baja"]
    : ["Active", ...(pending ? ["With something to approve"] : []), "Deactivated"]);
  await expect(list.getByRole("option", { name: chosen, exact: true })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");
  await expect(list).toHaveCount(0);
}

async function assertNoWrites(page: Page) {
  expect(await page.evaluate(() => (window as typeof window & { formOverviewFixture: { calls: { method: string; path: string }[] } })
    .formOverviewFixture.calls.filter(call => ["POST", "PUT", "PATCH", "DELETE"].includes(call.method)))).toEqual([]);
}

for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) for (const state of ["active", "deactivated"] as const) {
  test("MF1 overview " + state + " " + language + " " + width, async ({ page }) => {
    const es = language === "es";
    const scenario = state === "active" ? "forms-overview" : "forms-overview-deactivated";
    const screen = "/formularios" + (state === "deactivated" ? "?publicationFilter=Deactivated" : "");
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/src/test/visual/index.html?screen=" + encodeURIComponent(screen) + "&scenario=" + scenario + "&lang=" + language);
    await expect(page.getByRole("heading", { name: es ? "Formularios" : "Forms", level: 1, exact: true })).toBeVisible();
    const table = page.getByRole("table");
    await expect(table).toBeVisible();
    // The last response in three columns: its number, when it arrived and its state (UD1).
    await expect(table.getByRole("columnheader")).toHaveText(es
      ? ["Formulario", "Por aprobar", "Respuestas", "Última respuesta", "Recibida", "Estado"]
      : ["Form", "To approve", "Responses", "Last response", "Received", "State"]);
    await expect(table.getByRole("row")).toHaveCount(state === "active" ? 7 : 3);
    await assertStateControls(page, es, state, width, true);
    const first = table.getByRole("link", { name: state === "active" ? es ? "Registrar visita" : "Register visit" : es ? "Control de vehículo" : "Vehicle inspection", exact: true });
    await expect(first).toHaveAttribute("href", "/formularios/" + (state === "active" ? formOverviewFixtureIds.visit : formOverviewFixtureIds.deactivated) + "/respuestas");
    // The segment and the columns already say what a deactivated form keeps: no banner explains it (2026-10-31).
    if (state === "deactivated") await expect(page.getByText(es
      ? "Los formularios dados de baja conservan sus respuestas y lo que espera una decisión."
      : "Deactivated forms retain their responses and pending decisions.", { exact: true })).toHaveCount(0);
    else await expect(page.getByRole("button", { name: es ? "Ver dados de baja" : "View deactivated forms", exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await assertOverviewGeometry(page, width);
    await assertContainedTable(page, width, width < 640);
    await page.screenshot({ path: "test-results/form-overview-" + state + "-" + language + "-" + width + ".png", fullPage: true });
    if (state === "active") {
      const menuToggle = page.getByRole("button", { name: es ? "Menú de navegación" : "Navigation menu", exact: true });
      if (width < 640) await menuToggle.click();
      const overviewLink = page.getByRole("link", { name: es ? /^Formularios(?: \(\d+\))?$/ : /^Forms(?: \(\d+\))?$/ });
      await expect(overviewLink).toHaveAttribute("href", "/formularios");
      await expect(overviewLink).toHaveAttribute("aria-current", "page");
      // FU1-B: «Diseñar formularios» left the panel; a line apart, the pages used to build forms that this profile sees.
      await expect(page.getByRole("link", { name: es ? "Diseñar formularios" : "Design forms", exact: true })).toHaveCount(0);
      await expect(page.getByRole("link", { name: es ? "Catálogos" : "Catalogs", exact: true })).toHaveAttribute("href", "/catalogos");
      await page.screenshot({ path: "test-results/form-overview-menu-" + language + "-" + width + ".png", fullPage: true });
      if (width < 640) { await page.keyboard.press("Escape"); await expect(menuToggle).toHaveAttribute("aria-expanded", "false"); }
      // FU4: «Con algo por aprobar» is one more state of the filter, and mixes active and deactivated forms.
      const pendingLabel = es ? "Con algo por aprobar" : "With something to approve";
      const states = page.getByRole("listbox", { name: es ? "Estado de los formularios" : "Form status", exact: true });
      await page.getByRole("button", { name: (es ? "Estado de los formularios Activos" : "Form status Active"), exact: true }).click();
      await states.getByRole("option", { name: pendingLabel, exact: true }).click();
      const pendingTrigger = page.getByRole("button", { name: (es ? "Estado de los formularios " : "Form status ") + pendingLabel, exact: true });
      await expect(pendingTrigger).toBeVisible();
      const inactiveRow = table.getByRole("link", { name: es ? "Control de vehículo" : "Vehicle inspection", exact: true }).locator("xpath=ancestor::tr");
      await expect(inactiveRow.getByText(es ? "Dado de baja" : "Deactivated", { exact: true })).toBeVisible();
      await expect(table.getByRole("row")).toHaveCount(4);
      await pendingTrigger.click();
      await expect(states.getByRole("option", { name: pendingLabel, exact: true })).toHaveAttribute("aria-selected", "true");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: es ? "Ver dados de baja" : "View deactivated forms", exact: true })).toHaveCount(0);
      await assertOverviewGeometry(page, width);
      await assertContainedTable(page, width, width < 640);
      await page.screenshot({ path: "test-results/form-overview-pending-" + language + "-" + width + ".png", fullPage: true });
    }
    await assertNoWrites(page);
  });
}

for (const language of ["es", "en"] as const) for (const width of [390, 320]) for (const profile of ["read", "decide"] as const) {
  test("MF1 overview " + profile + " permission " + language + " " + width, async ({ page }) => {
    const es = language === "es";
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/src/test/visual/index.html?screen=/formularios&scenario=forms-overview-" + profile + "&lang=" + language);
    await expect(page.getByRole("heading", { name: es ? "Formularios" : "Forms", level: 1, exact: true })).toBeVisible();
    const table = page.getByRole("table");
    await expect(table).toBeVisible();
    await expect(table.getByRole("columnheader")).toHaveText(profile === "read"
      ? es ? ["Formulario", "Respuestas", "Última respuesta", "Recibida", "Estado"] : ["Form", "Responses", "Last response", "Received", "State"]
      : es ? ["Formulario", "Por aprobar"] : ["Form", "To approve"]);
    await expect(table.getByRole("row")).toHaveCount(profile === "read" ? 7 : 3);
    await assertStateControls(page, es, "active", width, false);
    await page.evaluate(() => document.fonts.ready);
    await assertOverviewGeometry(page, width);
    await assertContainedTable(page, width, profile === "read");
    await page.screenshot({ path: "test-results/form-overview-" + profile + "-" + language + "-" + width + ".png", fullPage: true });
    await assertNoWrites(page);
  });
}

// The menu count arrives after the menu. While it loads, «Formularios» keeps its row and nothing under it moves when the
// number appears (2026-11-05): in the panel at 1440 and in the drawer at 390.
type HeldCount = { formOverviewFixture: { holdCount(): void; releaseCount(): void } };
for (const width of [1440, 390]) {
  test("MF1 menu count loads without moving the menu " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/src/test/visual/index.html?screen=" + encodeURIComponent("/perfil") + "&scenario=forms-overview&lang=es");
    await expect(page.getByRole("heading", { name: "Mi perfil", level: 1, exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => (window as typeof window & HeldCount).formOverviewFixture.holdCount());
    if (width < 768) await page.getByRole("button", { name: "Menú de navegación", exact: true }).click();
    await page.getByRole("button", { name: "Gestión de formularios", exact: true }).click();
    const overview = page.getByRole("link", { name: /^Formularios(?: \(\d+\))?$/ });
    await expect(overview).toHaveAccessibleName("Formularios");
    const rows = [overview, page.getByRole("link", { name: "Catálogos", exact: true })];
    const geometry = () => Promise.all(rows.map(async row => { const box = (await row.boundingBox())!; return { y: box.y, height: box.height }; }));
    const loading = await geometry();
    await page.screenshot({ path: "test-results/form-overview-menu-count-loading-" + width + ".png" });
    await page.evaluate(() => (window as typeof window & HeldCount).formOverviewFixture.releaseCount());
    await expect(overview).toHaveAccessibleName("Formularios (4)");
    expect(await geometry()).toEqual(loading);
    await page.screenshot({ path: "test-results/form-overview-menu-count-loaded-" + width + ".png" });
    await assertNoWrites(page);
  });
}
