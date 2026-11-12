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
    test(`business opening hours show the whole text of each select at ${width}px in ${language}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/src/test/visual/index.html?screen=/configuracion/negocio&scenario=business-normal&lang=${language}`);
      const hours = page.getByRole("group", { name: language === "es" ? "Horario de atención" : "Opening hours", exact: true });
      await expect(hours).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      // An open day adds its times: neither they nor the status of each day are narrower than their widest option.
      await hours.getByRole("combobox", { name: language === "es" ? "Lunes · Atención" : "Monday · Opening", exact: true }).selectOption("open");
      const selects = hours.getByRole("combobox", { name: language === "es" ? / · (Atención|Desde|Hasta)$/ : / · (Opening|From|Until)$/ });
      await expect(selects).toHaveCount(9);
      expect(await selects.evaluateAll(found => found.filter(select => {
        const probe = select.cloneNode(true) as HTMLSelectElement;
        probe.style.cssText = "position: absolute; visibility: hidden; width: auto";
        select.after(probe);
        const needed = probe.getBoundingClientRect().width;
        probe.remove();
        return select.getBoundingClientRect().width + 0.5 < needed;
      }).map(select => select.getAttribute("aria-label")))).toEqual([]);
    });
  }
  // RO1-A: the business permissions are IA's second pair, so on a desktop they go in «Otros permisos» of its row, with
  // their names; on a phone each area is a band in the tone of a section and its permissions are white rows under it.
  test(`business permissions read in the row of IA and under its band in ${language}`, async ({ page }) => {
    const es = language === "es";
    await page.goto(`/src/test/visual/index.html?screen=/roles/admin&scenario=business-roles&lang=${language}`);
    const table = page.getByRole("table");
    const ai = table.getByRole("row").filter({ has: page.getByRole("rowheader", { name: es ? "Inteligencia artificial" : "Artificial intelligence" }) });
    await expect(ai.getByRole("cell").last()).toContainText(es ? "Ver información del negocio" : "View business information");
    await expect(ai.getByRole("cell").last()).toContainText(es ? "Administrar información del negocio" : "Manage business information");
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 900 });
    const bands = table.locator('tbody tr[data-tone="section"]');
    await expect(bands).toHaveCount(4);
    const bandColor = await bands.first().evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bandColor).not.toBe("rgb(255, 255, 255)");
    for (const row of await bands.all()) expect(await row.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(bandColor);
    for (const row of await table.locator('tbody tr:not([data-tone="section"])').all()) expect(await row.evaluate(el => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 255, 255)");
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
