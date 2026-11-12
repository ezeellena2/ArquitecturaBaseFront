import { expect, test } from "@playwright/test";

// RO1-A (2026-11-11): Admin, with modules installed, reads as a matrix on a desktop and as one band per area on a phone,
// with a tick where it has the permission and nothing to change.
for (const language of ["es", "en"] as const) {
  for (const width of [1440, 390, 320]) {
    test(`role groups read without modifying Admin at ${width}px in ${language}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/src/test/visual/index.html?screen=/roles/admin&scenario=role-groups&lang=${language}`);
      const es = language === "es";
      const table = page.getByRole("table", { name: es ? "Permisos" : "Permissions" });
      await expect(table).toBeVisible();
      // Read-only: no checkbox to touch, no button to save and no search, filter or folding.
      await expect(page.getByRole("checkbox")).toHaveCount(0);
      await expect(page.getByRole("button", { name: es ? "Guardar" : "Save", exact: true })).toHaveCount(0);
      await expect(page.getByRole("searchbox")).toHaveCount(0);
      await expect(page.locator('[data-slot="filter-bar"]')).toHaveCount(0);
      await expect(page.getByRole("main").getByRole("button", { expanded: false })).toHaveCount(0);
      if (width === 1440) {
        await expect(table.getByRole("columnheader")).toHaveText(es ? ["Área", "Ver", "Administrar", "Otros permisos"] : ["Area", "View", "Manage", "Other permissions"]);
        await expect(table.getByRole("rowheader")).toHaveCount(5);
        const chats = table.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "WhatsApp" }) });
        await expect(chats.getByRole("cell").last()).toContainText(es ? "Responder chats" : "Reply to chats");
        if (es) {
          await page.evaluate(() => document.fonts.ready);
          await expect(page).toHaveScreenshot("role-groups-admin-1440.png", { fullPage: true });
        }
      } else {
        await expect(table.getByRole("columnheader")).toHaveCount(0);
        await expect(table.getByRole("rowgroup")).toHaveCount(5);
        await expect(table.getByRole("rowgroup", { name: "WhatsApp" })).toContainText(es ? "Configurar el asistente" : "Configure the assistant");
      }
      // The area's (i) says what each of its permissions allows, one per line.
      const info = page.getByRole("button", { name: es ? "Más información sobre WhatsApp" : "More about WhatsApp" });
      await info.hover();
      const tooltip = page.locator('[data-slot="tooltip-content"]');
      await expect(tooltip).toContainText(es ? "Ver chats — Leer las conversaciones del negocio." : "View chats — Read business conversations.");
      expect(await tooltip.evaluate(element => getComputedStyle(element).whiteSpace)).toBe("pre-line");
      await page.mouse.move(0, 0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
      await expect(page.getByText(es ? "Cambios sin guardar" : "Unsaved changes", { exact: true })).toHaveCount(0);
    });
  }
}

// The real case, with modules: a role picks the permissions that are not to view or to manage in «Otros permisos» of its
// row on a desktop, and under its area's band on a phone.
for (const width of [1440, 390]) {
  test(`a role with modules picks its other permissions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/src/test/visual/index.html?screen=/roles/support&scenario=role-groups&lang=es");
    await expect(page.getByRole("table", { name: "Permisos" })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page).toHaveScreenshot(`role-groups-editor-${width}.png`, { fullPage: true });
    const reply = page.getByRole("checkbox", { name: "Responder chats" });
    await expect(reply).not.toBeChecked();
    await page.getByText("Responder chats", { exact: true }).click();
    await expect(reply).toBeChecked();
    await expect(page.getByRole("button", { name: "Guardar", exact: true })).toBeEnabled();
  });
}
