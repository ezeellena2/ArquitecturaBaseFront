import { expect, test } from "./test";

for (const language of ["es", "en"] as const) {
  for (const width of [1440, 390, 320]) {
    test(`place link proposal remains usable at ${width}px in ${language}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/design-lab/whatsapp-chat/?screen=ubicacion-lugar&lang=${language}`);
      const save = page.getByRole("button", { name: language === "es" ? "Guardar en la maqueta" : "Save in mockup", exact: true });
      const search = page.getByRole("searchbox", { name: language === "es" ? "Buscar un lugar" : "Find a place" });
      await expect(search).toBeVisible();
      await expect(save).toBeDisabled();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await search.fill("Sanatorio Plaza, mi ciudad");
      const find = page.getByRole("link", { name: language === "es" ? "Buscar en Google Maps" : "Search on Google Maps", exact: true });
      const url = new URL((await find.getAttribute("href"))!);
      expect(url.searchParams.get("query")).toBe("Sanatorio Plaza, mi ciudad");
      await expect(find).toHaveAttribute("target", "_blank");
      await expect(save).toBeDisabled();
      const link = page.getByRole("textbox", { name: language === "es" ? "Enlace del lugar" : "Place link", exact: true });
      await link.fill("https://evil.example/maps/place/Example");
      await link.press("Tab");
      await expect(link).toHaveAttribute("aria-invalid", "true");
      await expect(save).toBeDisabled();
      const fixtureLink = "https://maps.app.goo.gl/fictional-test-place";
      await link.fill(fixtureLink);
      await page.getByRole("textbox", { name: language === "es" ? "Nombre para mostrar" : "Display name", exact: true }).fill("Lugar de prueba");
      const verify = page.getByRole("link", { name: language === "es" ? "Comprobar en Google Maps" : "Check on Google Maps" });
      await expect(verify).toHaveAttribute("href", fixtureLink);
      const preview = page.getByRole("link", { name: language === "es" ? "Ver en Google Maps" : "View on Google Maps" });
      await expect(preview).toHaveAttribute("href", fixtureLink);
      for (const action of [find, verify, preview]) {
        expect(await action.evaluate(element => {
          const bounds = element.getBoundingClientRect();
          const surface = element.closest('[data-slot="surface"]')!.getBoundingClientRect();
          return bounds.left >= surface.left && bounds.right <= surface.right;
        })).toBe(true);
      }
      await expect(page.getByRole("heading", { name: "Lugar de prueba", exact: true })).toBeVisible();
      const panels = page.locator('#business-place-proposal > [data-slot="surface"]');
      const editorBounds = (await panels.nth(0).boundingBox())!;
      const previewBounds = (await panels.nth(1).boundingBox())!;
      if (width === 1440) {
        expect(Math.abs(editorBounds.y - previewBounds.y)).toBeLessThanOrEqual(1);
        expect(previewBounds.x).toBeGreaterThanOrEqual(editorBounds.x + editorBounds.width);
      } else {
        expect(previewBounds.y).toBeGreaterThanOrEqual(editorBounds.y + editorBounds.height);
      }
      await expect(save).toBeEnabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await save.click();
      await expect(page.locator('[data-sonner-toast]')).toHaveCount(1);
      await expect(save).toBeDisabled();
      await link.fill("https://maps.app.goo.gl/another-fictional-place");
      await page.getByRole("button", { name: language === "es" ? "Descartar" : "Discard", exact: true }).click();
      await expect(link).toHaveValue(fixtureLink);
      await expect(page.getByRole("link", { name: language === "es" ? "Ver en Google Maps" : "View on Google Maps" })).toHaveAttribute("href", fixtureLink);
    });
  }
}
