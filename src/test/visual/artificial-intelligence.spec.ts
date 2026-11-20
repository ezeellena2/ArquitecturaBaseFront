import { test, expect } from "@playwright/test";

for (const language of ["es", "en"] as const) {
  for (const width of [1440, 390, 320]) {
    test(`AI configuration ${language} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/src/test/visual/index.html?screen=/configuracion/ia&lang=${language}&scenario=ai-normal`);
      await expect(page.getByRole("heading", { name: language === "es" ? "Inteligencia artificial" : "Artificial intelligence", exact: true })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      // A model of the list is chosen in the Picker (DS1-A): its name and, in grey, its identifier; on the phone the list takes the screen.
      const modelLabel = language === "es" ? "Modelo" : "Model";
      const model = page.getByRole("button", { name: new RegExp(`^${modelLabel} `) });
      const chooseModel = async (name: string) => {
        await model.click();
        await page.getByRole("listbox", { name: modelLabel, exact: true }).getByRole("option", { name, exact: true }).click();
      };
      await expect(model).toHaveAccessibleName(`${modelLabel} Fictional model`);
      await chooseModel("Fictional next model");
      await expect(model).toHaveAccessibleName(`${modelLabel} Fictional next model`);
      await chooseModel("Fictional model");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page).toHaveScreenshot(`ai-${language}-${width}.png`, { fullPage: true });
      await page.getByRole("button", { name: language === "es" ? "Reemplazar clave" : "Replace key", exact: true }).click();
      const key = page.getByLabel(language === "es" ? "Nueva clave de API" : "New API key", { exact: true });
      await expect(key).toHaveAttribute("type", "password");
      await expect(key).toHaveValue("");
      await expect(key).toHaveAttribute("autocomplete", "new-password");
      await key.fill("fictional-private-key");
      await page.getByRole("button", { name: language === "es" ? "Probar conexión" : "Test connection", exact: true }).click();
      // El resultado de la prueba va al Toaster, no al lado del botón, y cambiar el borrador lo retira.
      const tested = page.getByText(language === "es" ? "La conexión respondió correctamente." : "The connection responded successfully.", { exact: true });
      await expect(tested).toBeVisible();
      await page.getByRole("button", { name: language === "es" ? "Cargar modelos" : "Load models", exact: true }).click();
      await expect(model).toBeVisible();
      // Con el mouse encima, Sonner pausa el vencimiento del aviso: sólo el cambio del borrador puede quitarlo.
      await tested.hover();
      // With the keyboard, so the mouse stays on the notice: the list opens on the chosen one and the next is the other model.
      await model.focus();
      await page.keyboard.press("Enter");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await expect(tested).toHaveCount(0);
      await page.getByRole("button", { name: language === "es" ? "Guardar cambios" : "Save changes", exact: true }).click();
      await expect(key).toHaveCount(0);
      await expect(model).toHaveAccessibleName(`${modelLabel} Fictional next model`);
    });
  }
  test(`AI empty connection does not prefill model or key ${language}`, async ({ page }) => {
    await page.goto(`/src/test/visual/index.html?screen=/configuracion/ia&lang=${language}&scenario=ai-empty`);
    const model = page.getByRole("textbox", { name: language === "es" ? "Modelo" : "Model", exact: true });
    const key = page.getByLabel(language === "es" ? "Clave de API" : "API key", { exact: true });
    await expect(model).toHaveValue("");
    await expect(key).toHaveValue("");
    await expect(key).toHaveAttribute("autocomplete", "new-password");
    await expect(page.getByRole("button", { name: language === "es" ? "Guardar cambios" : "Save changes", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: language === "es" ? "Probar conexión" : "Test connection", exact: true })).toBeDisabled();
  });
  test(`AI uncertain save and read only ${language}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/src/test/visual/index.html?screen=/configuracion/ia&lang=${language}&scenario=ai-uncertain`);
    await page.getByRole("button", { name: language === "es" ? "Ingresar modelo manualmente" : "Enter model manually", exact: true }).click();
    const model = page.getByRole("textbox", { name: language === "es" ? "Modelo" : "Model", exact: true });
    await model.fill("fictional-next-model");
    await page.getByRole("button", { name: language === "es" ? "Guardar cambios" : "Save changes", exact: true }).click();
    await page.getByRole("button", { name: language === "es" ? "Consultar guardado" : "Check save", exact: true }).click();
    await expect(page.getByRole("button", { name: language === "es" ? "Guardar cambios" : "Save changes", exact: true })).toBeDisabled();
    await page.goto(`/src/test/visual/index.html?screen=/configuracion/ia&lang=${language}&scenario=ai-read`);
    await expect(model).toBeDisabled();
    await expect(page.getByRole("button", { name: language === "es" ? "Probar conexión" : "Test connection", exact: true })).toHaveCount(0);
  });
}
