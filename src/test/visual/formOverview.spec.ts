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
    const controls = [page.getByRole("searchbox"), page.getByRole("group"), page.getByRole("checkbox")];
    const bounds = await Promise.all(controls.map(control => control.boundingBox()));
    const boxes = bounds.map(box => box!);
    expect(Math.min(...boxes.map(box => box.y + box.height))).toBeGreaterThan(Math.max(...boxes.map(box => box.y)));
  }
  // These fixture names and values fit on one line; horizontal overflow belongs to the table region.
  for (const row of await page.getByRole("table").locator("tbody tr").all())
    expect((await row.boundingBox())!.height).toBeLessThanOrEqual(40);
}

async function assertStateControls(page: Page, es: boolean, state: "active" | "deactivated", active: number, deactivated: number, width: number) {
  const segment = page.getByRole("group", { name: es ? "Estado de los formularios" : "Form status", exact: true });
  const current = segment.getByRole("button", { name: state === "active" ? (es ? "Activos" : "Active") + " (" + active + ")" : (es ? "Dados de baja" : "Deactivated") + " (" + deactivated + ")", exact: true });
  await expect(current).toHaveAttribute("aria-pressed", "true");
  await expect(segment.getByRole("button")).toHaveCount(2);
  const bounds = (await segment.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
  for (const option of await segment.getByRole("button").all()) {
    const optionBounds = (await option.boundingBox())!;
    expect(optionBounds.x).toBeGreaterThanOrEqual(0);
    expect(optionBounds.x + optionBounds.width).toBeLessThanOrEqual(width);
    expect(await option.evaluate(node => node.scrollWidth)).toBeLessThanOrEqual(await option.evaluate(node => node.clientWidth));
  }
}

async function assertNoWrites(page: Page) {
  expect(await page.evaluate(() => (window as typeof window & { formOverviewFixture: { calls: { method: string; path: string }[] } })
    .formOverviewFixture.calls.filter(call => ["POST", "PUT", "PATCH", "DELETE"].includes(call.method)))).toEqual([]);
}

for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) for (const state of ["active", "deactivated"] as const) {
  test("MF1 overview " + state + " " + language + " " + width, async ({ page }) => {
    const es = language === "es";
    const scenario = state === "active" ? "forms-overview" : "forms-overview-deactivated";
    const screen = "/formularios/respuestas" + (state === "deactivated" ? "?state=Deactivated" : "");
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/src/test/visual/index.html?screen=" + encodeURIComponent(screen) + "&scenario=" + scenario + "&lang=" + language);
    await expect(page.getByRole("heading", { name: es ? "Formularios" : "Forms", level: 1, exact: true })).toBeVisible();
    const table = page.getByRole("table");
    await expect(table).toBeVisible();
    await expect(table.getByRole("columnheader")).toHaveText(es
      ? ["Formulario", "Por aprobar", "Respuestas", "Última respuesta"]
      : ["Form", "To approve", "Responses", "Last response"]);
    await expect(table.getByRole("row")).toHaveCount(state === "active" ? 7 : 3);
    await expect(page.getByRole("checkbox", { name: es ? "Con algo por aprobar" : "With something to approve", exact: true })).not.toBeChecked();
    await assertStateControls(page, es, state, 6, 2, width);
    const first = table.getByRole("link", { name: state === "active" ? es ? "Registrar visita" : "Register visit" : es ? "Control de vehículo" : "Vehicle inspection", exact: true });
    await expect(first).toHaveAttribute("href", "/formularios/" + (state === "active" ? formOverviewFixtureIds.visit : formOverviewFixtureIds.deactivated) + "/respuestas");
    if (state === "deactivated") await expect(page.getByText(es
      ? "Los formularios dados de baja conservan sus respuestas y lo que espera una decisión."
      : "Deactivated forms retain their responses and pending decisions.", { exact: true })).toBeVisible();
    else await expect(page.getByRole("button", { name: es ? "Ver dados de baja" : "View deactivated forms", exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await assertOverviewGeometry(page, width);
    await assertContainedTable(page, width, width < 640);
    await page.screenshot({ path: "test-results/form-overview-" + state + "-" + language + "-" + width + ".png", fullPage: true });
    if (state === "active") {
      const menuToggle = page.getByRole("button", { name: es ? "Menú de navegación" : "Navigation menu", exact: true });
      if (width < 640) await menuToggle.click();
      const overviewLink = page.getByRole("link", { name: es ? /^Formularios(?: \(\d+\))?$/ : /^Forms(?: \(\d+\))?$/ });
      await expect(overviewLink).toHaveAttribute("href", "/formularios/respuestas");
      await expect(overviewLink).toHaveAttribute("aria-current", "page");
      for (const [name, href] of [
        [es ? "Diseñar formularios" : "Design forms", "/formularios"],
        [es ? "Catálogos" : "Catalogs", "/catalogos"],
        [es ? "Formularios que faltan" : "Missing forms", "/formularios/faltantes"],
      ]) await expect(page.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
      await page.screenshot({ path: "test-results/form-overview-all-permissions-" + language + "-" + width + ".png", fullPage: true });
      if (width < 640) { await page.keyboard.press("Escape"); await expect(menuToggle).toHaveAttribute("aria-expanded", "false"); }
      const pendingLabel = es ? "Con algo por aprobar" : "With something to approve";
      const pendingCheckbox = page.getByRole("checkbox", { name: pendingLabel, exact: true });
      const label = page.getByText(pendingLabel, { exact: true });
      await expect(label).toHaveCount(1);
      await label.click();
      await expect(pendingCheckbox).toBeChecked();
      const inactiveRow = table.getByRole("link", { name: es ? "Control de vehículo" : "Vehicle inspection", exact: true }).locator("xpath=ancestor::tr");
      await expect(inactiveRow.getByText(es ? "Dado de baja" : "Deactivated", { exact: true })).toBeVisible();
      await expect(table.getByRole("row")).toHaveCount(4);
      for (const option of await page.getByRole("group", { name: es ? "Estado de los formularios" : "Form status", exact: true }).getByRole("button").all())
        await expect(option).toHaveAttribute("aria-pressed", "false");
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
    await page.goto("/src/test/visual/index.html?screen=/formularios/respuestas&scenario=forms-overview-" + profile + "&lang=" + language);
    await expect(page.getByRole("heading", { name: es ? "Formularios" : "Forms", level: 1, exact: true })).toBeVisible();
    const table = page.getByRole("table");
    await expect(table).toBeVisible();
    await expect(table.getByRole("columnheader")).toHaveText(profile === "read"
      ? es ? ["Formulario", "Respuestas", "Última respuesta"] : ["Form", "Responses", "Last response"]
      : es ? ["Formulario", "Por aprobar"] : ["Form", "To approve"]);
    await expect(table.getByRole("row")).toHaveCount(profile === "read" ? 7 : 3);
    await expect(page.getByRole("checkbox", { name: es ? "Con algo por aprobar" : "With something to approve", exact: true })).toHaveCount(0);
    await assertStateControls(page, es, "active", profile === "read" ? 6 : 2, profile === "read" ? 2 : 1, width);
    await page.evaluate(() => document.fonts.ready);
    await assertOverviewGeometry(page, width);
    await assertContainedTable(page, width, profile === "read");
    await page.screenshot({ path: "test-results/form-overview-" + profile + "-" + language + "-" + width + ".png", fullPage: true });
    await assertNoWrites(page);
  });
}
