import { expect, test, type Locator, type Page } from "@playwright/test";
import { fixtureFormId } from "./formFixtures";

// LR2-A (2026-11-03): a comparison names each datum once and puts both versions in their own column, only what differs. On a
// phone the datum takes its line and both versions go under it, in two columns, without scrolling sideways.
async function expectSideBySide(page: Page, table: Locator, width: number) {
  await page.evaluate(() => document.fonts.ready);
  expect(await table.locator("xpath=..").evaluate(box => box.scrollWidth <= box.clientWidth + 1)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  const versions = await table.locator("thead th").evaluateAll(headers => headers.filter(header => getComputedStyle(header).display !== "none").map(header => header.getBoundingClientRect().width));
  if (width < 640) expect(versions).toHaveLength(2);
  else expect(versions.length).toBeGreaterThan(2);
}

for (const width of [1440, 390, 320]) {
  test(`the draft review reads side by side at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1600 });
    await page.goto(`/src/test/visual/index.html?screen=/formularios/${fixtureFormId}&scenario=forms-conflict&lang=es`);
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Mis cambios");
    await page.getByRole("button", { name: "Guardar borrador", exact: true }).click();
    await page.getByRole("main").getByRole("button", { name: "Revisar", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Revisión del borrador", exact: true });
    const table = dialog.getByRole("table");
    await expect(table.getByRole("rowheader", { name: "Obligatoria", exact: true })).toBeVisible();
    await expect(table.getByRole("rowheader", { name: "Máximo de caracteres", exact: true })).toBeVisible();
    await expect(table.getByRole("rowheader", { name: "Cliente · la opción «Distribuidora Norte» · Español", exact: true })).toBeVisible();
    await expect(table).not.toContainText("español:");
    await dialog.screenshot({ path: info.outputPath(`draft-review-es-${width}.png`) });
    await expectSideBySide(page, table, width);
  });

  test(`a business conflict reads side by side at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1200 });
    await page.goto("/src/test/visual/index.html?screen=/configuracion/negocio&scenario=business-conflict-hours&lang=es");
    await page.getByRole("textbox", { name: "Nombre del negocio" }).fill("Mi negocio");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    const review = page.getByRole("region", { name: "Revisar cambios de otro administrador" });
    await review.getByRole("button", { name: "Revisar cambios", exact: true }).click();
    const table = review.getByRole("table");
    await expect(table.getByRole("rowheader", { name: "Lunes", exact: true })).toBeVisible();
    await expect(table.getByRole("rowheader", { name: "Sábado", exact: true })).toBeVisible();
    await expect(table.getByRole("rowheader", { name: "Martes", exact: true })).toHaveCount(0);
    await expect(table).not.toContainText("Lunes:");
    await review.screenshot({ path: info.outputPath(`business-conflict-es-${width}.png`) });
    await expectSideBySide(page, table, width);
  });
}

// LR3-A: the chosen form of another page stays first in the list, with its chosen card, never «Elegido: …».
test("the chosen form of another page stays first in the list at 390px", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 1100 });
  await page.goto("/src/test/visual/index.html?screen=/whatsapp/chat&scenario=forms-chat-recipient-en&lang=es");
  await page.getByRole("button", { name: "Juan Gómez", exact: true }).click();
  await page.getByRole("button", { name: "Enviar formulario", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "Register visit", exact: true }).click();
  await dialog.getByRole("button", { name: "Página siguiente", exact: true }).click();
  await expect(dialog.getByRole("radio", { name: "Form 5", exact: true })).toBeFocused();
  await expect(dialog.getByRole("radio").first()).toHaveAccessibleName("Register visit");
  await expect(dialog.getByRole("radio", { name: "Register visit", exact: true })).toBeChecked();
  await expect(dialog).not.toContainText("Elegido");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await dialog.screenshot({ path: info.outputPath("form-chosen-elsewhere-es-390.png") });
});
