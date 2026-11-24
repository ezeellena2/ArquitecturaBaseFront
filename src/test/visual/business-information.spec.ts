import { expect, test, type Locator } from "@playwright/test";
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
      // A predefined question is chosen in the Picker (DS1-A): on the phone its list takes the screen.
      const preset = language === "es" ? "Agregar una pregunta predefinida" : "Add a predefined question";
      await page.getByRole("button", { name: new RegExp(`^${preset} `) }).click();
      await page.getByRole("listbox", { name: preset, exact: true }).getByRole("option", { name: language === "es" ? "¿Hace falta reservar?" : "Do I need to book?", exact: true }).click();
      const faq = page.getByRole("textbox", { name: language === "es" ? "Respuesta del negocio" : "Business answer", exact: true });
      await faq.fill("Confirmed answer");
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.getByRole("button", { name: language === "es" ? "Guardar" : "Save", exact: true }).click();
      await expect(page.locator("[data-sonner-toast]")).toHaveCount(1);
      await expect(page.getByRole("button", { name: language === "es" ? "Guardar" : "Save", exact: true })).toBeDisabled();
      await expect(name).toHaveValue(language === "es" ? "Negocio actualizado" : "Updated business");
      await expect(faq).toHaveValue("Confirmed answer");
    });
    test(`business opening hours read in a table and the dialog of a day shows the whole text of each control at ${width}px in ${language}`, async ({ page }) => {
      const es = language === "es";
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/src/test/visual/index.html?screen=/configuracion/negocio&scenario=business-normal&lang=${language}`);
      const hours = page.getByRole("group", { name: es ? "Horario de atención" : "Opening hours", exact: true });
      await expect(hours).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      // IN2 (2026-11-22): the week reads in a table, a day per row, without going past the hours.
      const week = hours.getByRole("table", { name: es ? "Semana" : "Week", exact: true });
      await expect(week.getByRole("row")).toHaveCount(8);
      const bounds = (await hours.boundingBox())!, weekBox = (await week.boundingBox())!;
      expect(weekBox.x + weekBox.width).toBeLessThanOrEqual(bounds.x + bounds.width + 0.5);
      // A day is edited in its dialog, opened by the pencil of its row: the status and the times go in the shared piece
      // (DS1-A, 2026-11-22), and none cuts its text or goes past the dialog.
      await hours.getByRole("button", { name: es ? "Editar el horario del lunes" : "Edit Monday opening hours", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: es ? "Horario del lunes" : "Monday opening hours", exact: true });
      await dialog.getByRole("button", { name: new RegExp("^" + (es ? "Atención" : "Opening") + " ") }).click();
      await page.getByRole("option", { name: es ? "Abierto" : "Open", exact: true }).click();
      const controls = dialog.getByRole("button", { name: es ? /^(Atención|Lunes 1 · (Desde|Hasta)) / : /^(Opening|Monday 1 · (From|Until)) / });
      await expect(controls).toHaveCount(3);
      const box = (await dialog.boundingBox())!;
      const cut = (found: Locator) => found.evaluateAll((elements, right) => elements.filter(control => {
        const texts = [...control.querySelectorAll<HTMLElement>("button, span.truncate")];
        return control.getBoundingClientRect().right > right + 0.5 || texts.some(text => text.scrollWidth > text.clientWidth + 0.5);
      }).map(control => control.getAttribute("aria-label") ?? control.textContent), box.x + box.width);
      expect(await cut(controls)).toEqual([]);
    });
  }
  // RO3-D: the business permissions are IA's second pair, so Admin reads them as rows of that area, with their names and a
  // tick, once it opens; each area is a band in the tone of a section and its permissions are white rows under it.
  test(`business permissions read as rows of IA under its band in ${language}`, async ({ page }) => {
    const es = language === "es";
    await page.goto(`/src/test/visual/index.html?screen=/roles/admin&scenario=business-roles&lang=${language}`);
    const table = page.getByRole("table");
    const area = es ? "Inteligencia artificial" : "Artificial intelligence";
    await table.getByRole("button", { name: es ? `Abrir ${area}` : `Open ${area}` }).click();
    const ai = table.getByRole("rowgroup", { name: area });
    await expect(ai).toContainText(es ? "Ver información del negocio" : "View business information");
    await expect(ai).toContainText(es ? "Administrar información del negocio" : "Manage business information");
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    // The pointer leaves the arrow, so no row is under it after the resize: a row under the pointer takes the hover color.
    await page.mouse.move(0, 0);
    await page.setViewportSize({ width: 390, height: 900 });
    const bands = table.locator('tbody tr[data-tone="section"]');
    await expect(bands).toHaveCount(4);
    const color = (row: Locator) => row.evaluate(el => getComputedStyle(el).backgroundColor);
    const bandColor = await color(bands.first());
    expect(bandColor).not.toBe("rgb(255, 255, 255)");
    for (const row of await bands.all()) await expect.poll(() => color(row)).toBe(bandColor);
    for (const row of await table.locator('tbody tr:not([data-tone="section"])').all()) await expect.poll(() => color(row)).toBe("rgb(255, 255, 255)");
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
  // The week reads in its own table too (IN2): the comparison is the one of the review.
  await expect(page.getByRole("region", { name: "Revisar cambios de otro administrador" }).getByRole("table")).toBeVisible();
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
