import { expect, test } from "./test";
import { visualCatalogId } from "./catalogFixtures";

// Separate journeys preserve all assertions and the default timeout without accumulating reloads.
for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test("Manual catalog " + language + " " + width, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const english = language === "en";
    const enter = async (screen: string, scenario = "catalogs-manage") => {
      await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen, lang: language, scenario }));
      await page.getByRole("heading", { name: screen === "/catalogos" ? english ? "Catalogs" : "Catálogos" : screen === "/catalogos/nuevo" ? english ? "New catalog" : "Nuevo catálogo" : english ? "Customers" : "Clientes", exact: true }).waitFor();
      await page.evaluate(() => document.fonts.ready);
    };
    await enter("/catalogos");
    await expect(page.getByRole("link", { name: english ? "Customers" : "Clientes", exact: true })).toBeVisible();
    await page.getByRole("button", { name: english ? "New catalog" : "Nuevo catálogo", exact: true }).click();
    await expect(page.getByRole("radio", { name: english ? "Write a query" : "Escribir una consulta" })).toHaveCount(0);
    await page.getByRole("button", { name: english ? "Continue" : "Continuar", exact: true }).click();
    await page.getByRole("textbox", { name: english ? "Name" : "Nombre", exact: true }).fill("Depósitos");
    await page.getByRole("textbox", { name: english ? "Description" : "Descripción", exact: true }).fill("Dónde guardar");
    await page.getByRole("button", { name: english ? "English" : "Inglés", exact: true }).click();
    await page.getByRole("textbox", { name: english ? "Name" : "Nombre", exact: true }).fill("Warehouses");
    await page.getByRole("textbox", { name: english ? "Description" : "Descripción", exact: true }).fill("Where to store");
    await page.getByRole("button", { name: english ? "Spanish" : "Español", exact: true }).click();
    await page.getByRole("button", { name: english ? "Add option" : "Agregar opción", exact: true }).click();
    await page.getByRole("textbox", { name: english ? "Text" : "Texto", exact: true }).fill("Central");
    await page.getByRole("textbox", { name: english ? "Code" : "Código", exact: true }).fill("D1");
    await expect(page.getByRole("button", { name: /Central.*(Guardá|Save)/ }).first()).toBeDisabled();
    await page.screenshot({ path: info.outputPath("manual-new.png"), fullPage: true });
    await page.getByRole("button", { name: english ? "Save" : "Guardar", exact: true }).click();
    await expect(page.getByRole("button", { name: english ? "Edit Central" : "Editar Central", exact: true })).toBeVisible();
    await page.getByRole("button", { name: english ? "Edit Central" : "Editar Central", exact: true }).click();
    await page.getByRole("textbox", { name: english ? "Code" : "Código", exact: true }).fill("D2");
    await page.getByRole("button", { name: english ? "Save" : "Guardar", exact: true }).click();
    await expect(page.getByText("D2", { exact: true })).toBeVisible();
    const saved = await page.evaluate(() => {
      const fixture = (globalThis as unknown as { catalogsFixture: { writes: { method: string; body: { items: { itemId: string | null; position?: number }[] } }[] } }).catalogsFixture;
      return fixture.writes.map(write => ({ method: write.method, items: write.body.items }));
    });
    expect(saved.map(write => write.method)).toEqual(["POST", "PUT"]);
    expect(saved[0]!.items[0]!.itemId).toBeNull();
    expect(saved[1]!.items[0]!.itemId).toBeTruthy();
    expect(saved[1]!.items[0]).not.toHaveProperty("position");
    await page.screenshot({ path: info.outputPath("manual-saved.png"), fullPage: true });
  });
  test("Manual catalog movements " + language + " " + width, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const english = language === "en";
    const enter = async (screen: string, scenario = "catalogs-manage") => {
      await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen, lang: language, scenario }));
      await page.getByRole("heading", { name: screen === "/catalogos" ? english ? "Catalogs" : "Catálogos" : screen === "/catalogos/nuevo" ? english ? "New catalog" : "Nuevo catálogo" : english ? "Customers" : "Clientes", exact: true }).waitFor();
      await page.evaluate(() => document.fonts.ready);
    };
    await enter("/catalogos/" + visualCatalogId + "?pageSize=1");
    await page.getByRole("button", { name: english ? "Move Pérez down" : "Bajar Pérez", exact: true }).click();
    await page.getByRole("button", { name: english ? "Next page" : "Página siguiente", exact: true }).click();
    await expect(page.getByText("López", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: english ? "Next page" : "Página siguiente", exact: true }).click();
    await page.getByRole("button", { name: english ? "Move Ríos up" : "Subir Ríos", exact: true }).click();
    expect(await page.evaluate(() => (globalThis as unknown as { catalogsFixture: { writes: unknown[] } }).catalogsFixture.writes.length)).toBe(0);
    await page.screenshot({ path: info.outputPath("manual-moves-pending.png"), fullPage: true });
    await page.getByRole("button", { name: english ? "Save" : "Guardar", exact: true }).click();
    await expect(page.getByText("Pérez", { exact: true })).toBeVisible();
    const moves = await page.evaluate(() => (globalThis as unknown as { catalogsFixture: { writes: { body: { moves: { itemId: string; direction: string }[] } }[] } }).catalogsFixture.writes.map(write => write.body.moves));
    expect(moves).toEqual([[{ itemId: "01990000-0000-7000-8000-000000000081", direction: "down" }, { itemId: "01990000-0000-7000-8000-000000000083", direction: "up" }]]);
    await page.getByRole("button", { name: english ? "Previous page" : "Página anterior", exact: true }).click();
    await expect(page.getByText("Ríos", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: english ? "Previous page" : "Página anterior", exact: true }).click();
    await expect(page.getByRole("button", { name: english ? "Move López up" : "Subir López", exact: true })).toBeDisabled();
  });
  test("Manual catalog conflict " + language + " " + width, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const english = language === "en";
    const enter = async (screen: string, scenario = "catalogs-manage") => {
      await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen, lang: language, scenario }));
      await page.getByRole("heading", { name: screen === "/catalogos" ? english ? "Catalogs" : "Catálogos" : screen === "/catalogos/nuevo" ? english ? "New catalog" : "Nuevo catálogo" : english ? "Customers" : "Clientes", exact: true }).waitFor();
      await page.evaluate(() => document.fonts.ready);
    };
    await enter("/catalogos/" + visualCatalogId, "catalogs-conflict");
    await page.getByRole("textbox", { name: english ? "Name" : "Nombre", exact: true }).fill("Mi borrador");
    await page.getByRole("button", { name: english ? "Save" : "Guardar", exact: true }).click();
    await page.getByRole("button", { name: english ? "Review" : "Revisar", exact: true }).click();
    await page.getByRole("button", { name: english ? "Reread" : "Releer", exact: true }).click();
    const reviewDialog = page.getByRole("dialog", { name: english ? "Catalog review" : "Revisión del catálogo", exact: true });
    await expect(reviewDialog.getByText("Clientes actuales", { exact: true })).toBeVisible();
    await expect(reviewDialog.getByText("Mi borrador", { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath("manual-conflict.png"), fullPage: true });
    await page.getByRole("button", { name: english ? "Use the current revision" : "Usar la revisión actual", exact: true }).click();
    await expect(page.getByRole("textbox", { name: english ? "Name" : "Nombre", exact: true })).toHaveValue("Clientes actuales");
  });
  test("Manual catalog permissions " + language + " " + width, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const english = language === "en";
    const enter = async (screen: string, scenario = "catalogs-manage") => {
      await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen, lang: language, scenario }));
      await page.getByRole("heading", { name: screen === "/catalogos" ? english ? "Catalogs" : "Catálogos" : screen === "/catalogos/nuevo" ? english ? "New catalog" : "Nuevo catálogo" : english ? "Customers" : "Clientes", exact: true }).waitFor();
      await page.evaluate(() => document.fonts.ready);
    };
    await enter("/catalogos/" + visualCatalogId, "catalogs-read");
    await expect(page.getByRole("textbox", { name: english ? "Name" : "Nombre", exact: true })).toHaveAttribute("readonly", "");
    await expect(page.getByRole("button", { name: english ? "Save" : "Guardar", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: english ? "Add option" : "Agregar opción", exact: true })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath("manual-read.png"), fullPage: true });
    await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen: "/catalogos", lang: language, scenario: "catalogs-denied" }));
    await expect(page.getByRole("heading", { name: english ? "You don't have permission" : "No tenés permiso", exact: true })).toBeVisible();
    expect(await page.evaluate(() => (globalThis as unknown as { catalogsFixture: { reads: string[]; writes: unknown[] } }).catalogsFixture)).toMatchObject({ reads: [], writes: [] });
    const geometry = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport);
  });
}
