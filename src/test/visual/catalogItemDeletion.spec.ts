import { expect, test } from "@playwright/test";
import { visualCatalogId } from "./catalogFixtures";

// Eliminar una opción guardada: la confirmación y la fila marcada hasta Guardar, que deja las flechas apagadas.
for (const language of ["es", "en"] as const) for (const width of [1440, 390]) {
  test("Manual catalog option deletion " + language + " " + width, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const english = language === "en";
    await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen: "/catalogos/" + visualCatalogId, lang: language, scenario: "catalogs-manage" }));
    await page.getByRole("heading", { name: english ? "Customers" : "Clientes", exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole("button", { name: english ? "Delete López" : "Eliminar López", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: english ? "Delete “López”?" : "¿Eliminar «López»?", exact: true });
    await expect(dialog).toBeVisible();
    await page.screenshot({ path: info.outputPath("deletion-confirm.png"), fullPage: true });
    await dialog.getByRole("button", { name: english ? "Delete option" : "Eliminar opción", exact: true }).click();
    await expect(page.getByText(english ? "Deleted when saving" : "Se elimina al guardar", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: english ? "Restore López" : "Restaurar López", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: english ? "Move Pérez down" : "Bajar Pérez", exact: true })).toBeDisabled();
    await page.screenshot({ path: info.outputPath("deletion-marked.png"), fullPage: true });
  });
}
