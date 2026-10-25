import { expect, test, type Locator, type Page } from "@playwright/test";
import { personDataFixtureIds } from "./personDataFixtures";

// Evidence against the chosen CE4-A board; no golden is rewritten and no real API is contacted.
async function open(page: Page, language: "es" | "en", scenario = "person-data") {
  await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen: "/datos-de-personas", scenario, lang: language }));
  await expect(page.getByRole("heading", { name: language === "es" ? "Datos de las personas" : "People data", level: 1, exact: true })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(2);
  await page.evaluate(() => document.fonts.ready);
}
async function contained(region: Locator, page: Page, width: number) {
  const bounds = (await region.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
  const geometry = await region.evaluate(node => ({ content: node.scrollWidth, width: node.clientWidth }));
  if (geometry.content > geometry.width) {
    await region.evaluate(node => { node.scrollLeft = node.scrollWidth; });
    expect(await region.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
    await region.evaluate(node => { node.scrollLeft = 0; });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
}
for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test("CE4 people data table and attribute focus " + language + " " + width, async ({ page }) => {
    const es = language === "es";
    await page.setViewportSize({ width, height: 900 });
    await open(page, language);
    const regions = page.locator('[data-slot="table-container"]');
    await expect(regions).toHaveCount(2);
    for (const region of await regions.all()) await contained(region, page, width);
    if (width < 640) expect(await regions.first().evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
    await expect(page.getByRole("table").last().getByRole("row")).toHaveCount(7);
    await expect(page.getByText(es ? "6 personas · 2 sin Zona" : "6 people · 2 without Zone", { exact: true })).toBeVisible();
    await page.screenshot({ path: "test-results/person-data-table-" + language + "-" + width + ".png", fullPage: true });
    const add = page.getByRole("button", { name: es ? "Agregar dato" : "Add attribute", exact: true });
    await add.click();
    const dialog = page.getByRole("dialog", { name: es ? "Agregar dato" : "Add attribute", exact: true });
    const name = dialog.getByRole("textbox", { name: es ? "Nombre" : "Name", exact: true });
    await expect(name).toBeFocused();
    // One name in the menu language, where a new attribute is born: no separate English name.
    await expect(dialog.getByRole("textbox", { name: es ? "Nombre en inglés" : "Name in English", exact: true })).toHaveCount(0);
    await name.fill(es ? "Región" : "Region");
    // Save is not turned off by the empty key or catalog: trying it marks them (decision V28).
    await expect(dialog.getByRole("button", { name: es ? "Guardar" : "Save", exact: true })).toBeEnabled();
    await page.screenshot({ path: "test-results/person-data-attribute-" + language + "-" + width + ".png", fullPage: true });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(add).toBeFocused();
    const calls = await page.evaluate(() => (window as unknown as Window & { personDataFixture: { calls: { method: string; path: string }[] } }).personDataFixture.calls);
    expect(calls.filter(call => call.method !== "GET")).toEqual([]);
  });
  test("CE4 independent data failure keeps the user editor open and restores focus " + language + " " + width, async ({ page }) => {
    const es = language === "es";
    await page.setViewportSize({ width, height: 900 });
    await open(page, language, "person-data-save-error");
    const edit = page.getByRole("button", { name: es ? "Editar a Juan Gómez" : "Edit Juan Gómez", exact: true });
    await edit.click();
    const dialog = page.getByRole("dialog", { name: es ? "Editar usuario" : "Edit user", exact: true });
    const zone = dialog.getByRole("combobox", { name: es ? "Zona" : "Zone", exact: true });
    await expect(zone).toHaveValue(es ? "Centro" : "Central");
    await zone.click();
    await page.getByRole("option", { name: es ? "Norte" : "North", exact: true }).click();
    await expect(zone).toHaveValue(es ? "Norte" : "North");
    await dialog.getByRole("button", { name: es ? "Guardar" : "Save", exact: true }).click();
    const alert = dialog.getByRole("alert");
    await expect(alert).toContainText(es ? "El resto del usuario ya se guardó." : "The rest of the account has already been saved.");
    await expect(dialog).toBeVisible();
    await expect(zone).toHaveValue(es ? "Norte" : "North");
    const reload = dialog.getByRole("button", { name: es ? "Volver a cargar los datos" : "Reload data", exact: true });
    await reload.focus();
    await expect(reload).toBeFocused();
    expect(await reload.evaluate(node => { const box = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)); })).toBe(true);
    const dialogBounds = (await dialog.boundingBox())!, reloadBounds = (await reload.boundingBox())!;
    expect(reloadBounds.y).toBeGreaterThanOrEqual(dialogBounds.y);
    expect(reloadBounds.y + reloadBounds.height).toBeLessThanOrEqual(dialogBounds.y + dialogBounds.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    await page.screenshot({ path: "test-results/person-data-partial-failure-" + language + "-" + width + ".png", fullPage: true });
    const observed = await page.evaluate(() => (window as unknown as Window & { personDataFixture: { calls: { method: string; path: string }[]; writes: { path: string }[] } }).personDataFixture);
    expect(observed.writes.map(write => write.path)).toEqual(["/api/users/" + personDataFixtureIds.person, "/api/forms/person-data/" + personDataFixtureIds.person]);
    expect(observed.calls.filter(call => call.path.startsWith("/api/forms/catalogs"))).toEqual([]);
    expect(observed.calls.some(call => call.path === "/api/forms/person-attributes/" + personDataFixtureIds.zone + "/options")).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(edit).toBeFocused();
  });
}
