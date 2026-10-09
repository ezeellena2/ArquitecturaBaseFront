import { expect, test } from "@playwright/test";

for (const language of ["es", "en"]) {
  for (const width of [1440, 390, 320]) {
    test(`appearance fits and saves at ${width}px in ${language}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/src/test/visual/index.html?screen=/configuracion/apariencia&lang=${language}`);
      const input = page.getByLabel(language === "es" ? "Botones y enlaces" : "Buttons and links");
      await expect(input).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await expect(page).toHaveScreenshot(`appearance-${language}-${width}.png`, { fullPage: true });
      await input.fill("#335f85");
      expect(await page.evaluate(() => document.documentElement.style.getPropertyValue("--primary"))).toBe("");
      await page.getByRole("button", { name: language === "es" ? "Guardar cambios" : "Save changes", exact: true }).click();
      await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--primary"))).toBe("#335f85");
      await page.getByRole("button", { name: language === "es" ? "Restaurar colores iniciales" : "Restore initial colors" }).click();
      await expect(input).toHaveValue("#285a3d");
      const preview = page.getByRole("region", { name: language === "es" ? "Vista previa" : "Preview" });
      await expect(preview.getByRole("button", { name: language === "es" ? "Nuevo usuario" : "New user" })).toHaveCSS("background-color", "rgb(40, 90, 61)");
      await page.getByRole("button", { name: language === "es" ? "Guardar cambios" : "Save changes", exact: true }).click();
      await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--primary"))).toBe("");
    });
  }
}

test("custom colors keep dark row identities and light action groups readable", async ({ page }) => {
  await page.goto("/src/test/visual/index.html?screen=/usuarios&scenario=dark-palette");
  const row = page.getByRole("row").nth(2);
  await expect(row).toBeVisible();
  const identity = row.locator("span.truncate").first();
  expect(await identity.evaluate(element => getComputedStyle(element).color)).toBe("rgb(255, 255, 255)");
  expect(await row.evaluate(element => getComputedStyle(element).backgroundColor)).toBe("rgb(0, 0, 0)");
  const action = row.getByRole("button", { name: /Editar/ });
  expect(await action.evaluate(element => getComputedStyle(element).color)).toBe("rgb(72, 89, 77)");
  await action.focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  expect(await page.getByRole("tooltip").evaluate(element => getComputedStyle(element).color)).toBe("rgb(255, 255, 255)");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.getByRole("dialog").evaluate(element => getComputedStyle(element).backgroundColor)).toBe("rgb(255, 255, 255)");
  await expect(page).toHaveScreenshot("appearance-dark-table.png", { fullPage: true });
});
