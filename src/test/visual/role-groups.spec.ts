import { expect, test } from "./test";

for (const language of ["es", "en"] as const) {
  for (const width of [1440, 390, 320]) {
    test(`role groups toggle together without modifying Admin at ${width}px in ${language}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/src/test/visual/index.html?screen=/roles/admin&scenario=role-groups&lang=${language}`);
      const collapse = language === "es" ? "Contraer todo" : "Collapse all";
      const expand = language === "es" ? "Expandir todo" : "Expand all";
      const toggle = page.locator('[data-slot="filter-bar"] button[aria-controls]');
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveAccessibleName(collapse);
      const controls = await toggle.getAttribute("aria-controls");
      expect(await page.getByRole("table").getAttribute("id")).toBe(controls);
      const permissions = page.locator('tbody tr:not([data-section]) [role="checkbox"]');
      await expect(page.locator('tbody tr[data-section]')).toHaveCount(5);
      await expect(permissions).toHaveCount(12);
      await toggle.focus();
      await page.keyboard.press("Enter");
      await expect(permissions).toHaveCount(0);
      await expect(toggle).toHaveAccessibleName(expand);
      await expect(toggle).toBeFocused();
      await page.keyboard.press("Space");
      await expect(permissions).toHaveCount(12);
      await expect(toggle).toHaveAccessibleName(collapse);
      for (const permission of await permissions.all()) {
        await expect(permission).toBeChecked();
        await expect(permission).toBeDisabled();
      }
      const search = page.getByRole("searchbox");
      await search.fill(language === "es" ? "información del negocio" : "business information");
      await toggle.click();
      await expect(permissions).toHaveCount(0);
      await expect(toggle).toHaveAccessibleName(expand);
      await toggle.click();
      await expect(permissions).toHaveCount(2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const bounds = await toggle.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      await expect(page.locator('[data-sonner-toast]')).toHaveCount(0);
      await expect(page.getByText(language === "es" ? "Cambios sin guardar" : "Unsaved changes", { exact: true })).toHaveCount(0);
    });
  }
}
