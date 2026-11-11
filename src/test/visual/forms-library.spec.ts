import { expect, test } from "@playwright/test";
// BI1-A: «Biblioteca» and «Agregar», evidence without golden, es/en at 1440, 390 and 320 px.
for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test("library and its add dialog in " + language + " at " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/src/test/visual/index.html?screen=/formularios/biblioteca&scenario=forms-library&lang=" + language);
    const name = language === "es" ? "Factura" : "Invoice";
    await expect(page.getByRole("heading", { name: language === "es" ? "Biblioteca" : "Library", exact: true })).toBeVisible();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    // The table carries one piece of data per column (UD1); a phone's card, its line in grey.
    if (width >= 640) for (const header of language === "es" ? ["Versión", "Origen", "Formularios", "Acciones"] : ["Version", "Source", "Forms", "Actions"])
      await expect(page.getByRole("columnheader", { name: header, exact: true })).toBeVisible();
    else await expect(page.getByText(language === "es" ? "Versión 1 · ARCA · En 1 formulario" : "Version 1 · ARCA · In 1 form", { exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    await page.screenshot({ path: "test-results/visual/forms-library-" + language + "-" + width + ".png", fullPage: true });
    await page.getByRole("button", { name: (language === "es" ? "Agregar «" : "Add “") + name + (language === "es" ? "»" : "”"), exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("textbox", { name: language === "es" ? /^Prefijo de numeración/ : /^Numbering prefix/ })).toHaveValue("FAC2");
    await page.screenshot({ path: "test-results/visual/forms-library-add-" + language + "-" + width + ".png", fullPage: true });
  });
}
