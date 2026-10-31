import { expect, test } from "@playwright/test";
import { visualCatalogId } from "./catalogFixtures";

// CA3 production editor with an explicitly synthetic typed catalog; no raw producer bodies or goldens.
for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test("Typed catalog CA3 " + language + " " + width, async ({ page }, info) => {
    const english = language === "en";
    const label = (es: string, en: string) => english ? en : es;
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen: "/catalogos/" + visualCatalogId, lang: language, scenario: "catalogs-typed" }));
    await expect(page.getByRole("heading", { name: label("Recargo por zona", "Zone surcharge"), exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    // Origin and value type are a read-only line above the name, without a box or an explanation.
    await expect(page.getByText(label("Escritas a mano · Decimal", "Written manually · Decimal"), { exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: label("Tipo de valor", "Value type"), exact: true })).toHaveCount(0);
    await expect(page.getByRole("columnheader", { name: label("Valor", "Value"), exact: true })).toBeVisible();
    // Option labels are shown in the menu language and, without a translation, in the original.
    await page.getByRole("button", { name: label("Editar Interior", "Edit Inland"), exact: true }).click();
    const value = page.getByRole("textbox", { name: label("Valor · Decimal", "Value · Decimal"), exact: true });
    await value.fill("mil");
    await expect(value).toHaveAttribute("aria-invalid", "true");
    await value.scrollIntoViewIfNeeded();
    const bounds = await value.boundingBox(); expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: info.outputPath("catalog-typed-invalid.png"), fullPage: true });
    // «Listo» of the options modal keeps the invalid value in the draft; on the phone it is in the list.
    const options = page.getByRole("dialog", { name: english ? /^Options of/ : /^Opciones de/ });
    if (width < 640) await options.getByRole("button", { name: label("Volver a la lista", "Back to the list"), exact: true }).click();
    await options.getByRole("button", { name: label("Listo", "Done"), exact: true }).click();
    // Beside the title goes only the catalog's state, never «Cambios sin guardar»: an enabled Save says there are changes.
    const header = page.locator("header").filter({ has: page.getByRole("heading", { level: 1 }) });
    await expect(header).toContainText(label("Activo", "Active"));
    await expect(header).not.toContainText(label("Cambios sin guardar", "Unsaved changes"));
    const save = page.getByRole("button", { name: label("Guardar", "Save"), exact: true });
    await expect(save).toBeEnabled();
    // Save stays enabled: trying it with the invalid value writes nothing (checked at the end) and opens the option again,
    // with the focus on the marked value, brought into view.
    await save.click();
    const reopened = page.getByRole("dialog").getByRole("textbox", { name: label("Valor · Decimal", "Value · Decimal"), exact: true });
    await expect(reopened).toHaveValue("mil"); await expect(reopened).toHaveAttribute("aria-invalid", "true");
    await expect(reopened).toBeFocused(); await expect(reopened).toBeInViewport();
    await reopened.fill(english ? "3,200.00" : "3.200,00");
    await expect(reopened).not.toHaveAttribute("aria-invalid", "true");
    await page.screenshot({ path: info.outputPath("catalog-typed-valid.png"), fullPage: true });
    expect(await page.evaluate(() => (globalThis as unknown as { catalogsFixture: { writes: unknown[] } }).catalogsFixture.writes)).toEqual([]);
  });
}
