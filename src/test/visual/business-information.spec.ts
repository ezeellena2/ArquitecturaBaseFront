import { expect, test } from "@playwright/test";
for (const language of ["es", "en"] as const) {
  for (const width of [1440, 390, 320]) {
    test(`business information saves without overflow at ${width}px in ${language}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/src/test/visual/index.html?screen=/configuracion/negocio&scenario=business-normal&lang=${language}`);
      const name = page.getByRole("textbox", { name: language === "es" ? "Nombre del negocio" : "Business name" });
      await expect(name).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      if (width === 1440) await expect(page.getByRole("link", { name: language === "es" ? "Información del negocio" : "Business information", exact: true })).toBeVisible();
      await expect(page).toHaveScreenshot(`business-information-${language}-${width}.png`, { fullPage: true });
      await name.fill(language === "es" ? "Negocio actualizado" : "Updated business");
      await page.getByRole("combobox", { name: language === "es" ? "Agregar una pregunta predefinida" : "Add a predefined question", exact: true }).selectOption("booking");
      const faq = page.getByRole("textbox", { name: language === "es" ? "Respuesta del negocio" : "Business answer", exact: true });
      await faq.fill("Confirmed answer");
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.getByRole("button", { name: language === "es" ? "Guardar" : "Save", exact: true }).click();
      await expect(page.locator("[data-sonner-toast]")).toHaveCount(1);
      await expect(page.getByRole("button", { name: language === "es" ? "Guardar" : "Save", exact: true })).toBeDisabled();
      await expect(name).toHaveValue(language === "es" ? "Negocio actualizado" : "Updated business");
      await expect(faq).toHaveValue("Confirmed answer");
    });
  }
  test(`business permissions distinguish area headings from plain permission rows in ${language}`, async ({ page }) => {
    await page.goto(`/src/test/visual/index.html?screen=/roles/admin&scenario=business-roles&lang=${language}`);
    const permission = page.getByRole("checkbox", { name: language === "es" ? "Ver información del negocio" : "View business information", exact: true });
    await expect(permission).toBeChecked();
    await expect(permission).toBeDisabled();
    const table = page.getByRole("table");
    const rows = table.locator('tbody tr:not([data-section])');
    for (const row of await rows.all()) expect(await row.evaluate(el => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 255, 255)");
    const sections = table.locator('tbody tr[data-section]');
    await expect(sections).toHaveCount(4);
    const sectionColor = await sections.first().evaluate(el => getComputedStyle(el).backgroundColor);
    expect(sectionColor).not.toBe("rgb(255, 255, 255)");
    expect(sectionColor).not.toBe(await table.locator("thead").evaluate(el => getComputedStyle(el).backgroundColor));
    for (const row of await sections.all()) expect(await row.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(sectionColor);
    expect(await table.locator("thead").evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe("rgb(255, 255, 255)");
  });
  test(`lost replies recover by receipt in ${language}`, async ({ page }) => {
    await page.goto(`/src/test/visual/index.html?screen=/configuracion/negocio&scenario=business-uncertain&lang=${language}`);
    const name = page.getByRole("textbox", { name: language === "es" ? "Nombre del negocio" : "Business name" });
    await name.fill("Updated");
    await page.getByRole("button", { name: language === "es" ? "Guardar" : "Save", exact: true }).click();
    await expect(name).toBeDisabled();
    await page.getByRole("button", { name: language === "es" ? "Revisar guardado" : "Review save", exact: true }).click();
    await expect(name).toBeEnabled();
    await expect(name).toHaveValue("Updated");
    await expect(page.getByRole("button", { name: language === "es" ? "Guardar" : "Save", exact: true })).toBeDisabled();
  });
}
test("business conflicts preserve edited fields and incorporate current facts on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 1000 });
  await page.goto("/src/test/visual/index.html?screen=/configuracion/negocio&scenario=business-conflict");
  const name = page.getByRole("textbox", { name: "Nombre del negocio" });
  await name.fill("Mi negocio");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("button", { name: "Revisar cambios", exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByRole("button", { name: "Conservar mis cambios" }).click();
  await expect(name).toHaveValue("Mi negocio");
  await expect(page.getByRole("textbox", { name: "Horario de atención" })).toHaveValue("10–17");
});
test("business read permission hides all writing actions", async ({ page }) => {
  await page.goto("/src/test/visual/index.html?screen=/configuracion/negocio&scenario=business-read");
  await expect(page.getByRole("textbox", { name: "Nombre del negocio" })).toHaveAttribute("readonly", "");
  await expect(page.getByRole("button", { name: "Guardar", exact: true })).toHaveCount(0);
});
test("connection permissions do not expose the business screen or menu", async ({ page }) => {
  await page.goto("/src/test/visual/index.html?screen=/configuracion/negocio&scenario=business-denied");
  await expect(page.getByRole("heading", { name: "No tenés permiso" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Nombre del negocio" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Información del negocio", exact: true })).toHaveCount(0);
});
