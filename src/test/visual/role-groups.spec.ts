import { expect, test, type Locator, type Page } from "@playwright/test";

// RO3-D (2026-11-19, RO4 · 1 and 7): Admin, with modules installed, reads as the same folding list on a desktop and on a
// phone. Its areas start closed, with no tick or checkbox on their bands, and each opens to read its permissions, each with
// a tick; nothing to change.
for (const language of ["es", "en"] as const) {
  for (const width of [1440, 390, 320]) {
    test(`role groups read without modifying Admin at ${width}px in ${language}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/src/test/visual/index.html?screen=/roles/admin&scenario=role-groups&lang=${language}`);
      const es = language === "es";
      const table = page.getByRole("table", { name: es ? "Permisos" : "Permissions" });
      await expect(table).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expect(table.getByRole("columnheader")).toHaveText([es ? "Permiso" : "Permission"]);
      // Read-only: no checkbox to touch, no button to save and no search or filter.
      await expect(page.getByRole("checkbox")).toHaveCount(0);
      await expect(page.getByRole("button", { name: es ? "Guardar" : "Save", exact: true })).toHaveCount(0);
      await expect(page.getByRole("searchbox")).toHaveCount(0);
      await expect(page.locator('[data-slot="filter-bar"]')).toHaveCount(0);
      // Every area starts closed: only its band, with the arrow, the name and the (i).
      await expect(table.locator('tbody tr[data-tone="section"]')).toHaveCount(5);
      await expect(table.getByRole("button", { name: es ? /^Abrir / : /^Open / })).toHaveCount(5);
      await expect(table.locator('tbody tr:not([data-tone="section"])')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      if (es && width !== 320) await expect(page).toHaveScreenshot(`role-groups-admin-${width}.png`, { fullPage: true });
      // The arrow opens an area to read its permissions, each with its whole name and a tick.
      await table.getByRole("button", { name: es ? "Abrir WhatsApp" : "Open WhatsApp" }).click();
      const chats = table.getByRole("rowgroup", { name: "WhatsApp" });
      await expect(chats.locator('tr:not([data-tone="section"])')).toHaveText(es
        ? ["Ver chats", "Responder chats", "Configurar el asistente"]
        : ["View chats", "Reply to chats", "Configure the assistant"]);
      await expect(chats.locator('tr:not([data-tone="section"]) svg')).toHaveCount(3);
      await expect(page.getByRole("checkbox")).toHaveCount(0);
      await page.mouse.move(0, 0);
      if (es && width === 1440) await expect(page).toHaveScreenshot("role-groups-admin-open-1440.png", { fullPage: true });
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

// RO3-D: a role with modules opens the areas where it has something and leaves the rest closed, 44 px to touch on a
// phone. The arrow opens another, and checking a permission checks what it includes and leaves it off.
for (const width of [1440, 390]) {
  test(`a role with modules opens its areas and picks a permission with what it includes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/src/test/visual/index.html?screen=/roles/support&scenario=role-groups&lang=es");
    const table = page.getByRole("table", { name: "Permisos" });
    await expect(table).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    for (const area of ["Usuarios", "Roles"]) await expect(table.getByRole("button", { name: `Cerrar ${area}` })).toHaveAttribute("aria-expanded", "true");
    for (const area of ["Configuración", "WhatsApp", "Inteligencia artificial"]) await expect(table.getByRole("button", { name: `Abrir ${area}` })).toHaveAttribute("aria-expanded", "false");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page).toHaveScreenshot(`role-groups-editor-${width}.png`, { fullPage: true });
    if (width === 390) for (const row of await table.locator("tbody tr").all()) expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await table.getByRole("button", { name: "Abrir WhatsApp" }).click();
    const reply = page.getByRole("checkbox", { name: "Responder chats" });
    await expect(reply).not.toBeChecked();
    await page.getByText("Responder chats", { exact: true }).click();
    await expect(reply).toBeChecked();
    const view = page.getByRole("checkbox", { name: "Ver chats" });
    await expect(view).toBeChecked();
    await expect(view).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByRole("button", { name: "Guardar", exact: true })).toBeEnabled();
  });
}

const included = {
  es: {
    area: "Formularios", view: "Ver formularios", manage: "Administrar formularios", publish: "Publicar formularios", save: "Guardar",
    both: "Lo incluyen «Administrar formularios» y «Publicar formularios».", one: "Lo incluye «Administrar formularios».",
  },
  en: {
    area: "Forms", view: "View forms", manage: "Manage forms", publish: "Publish forms", save: "Save",
    both: "Included in “Manage forms” and “Publish forms”.", one: "Included in “Manage forms”.",
  },
} as const;

// The reason opens above its square and over its middle, never next to it (MA1-A).
async function expectReasonAbove(page: Page, control: Locator, reason: string) {
  const tooltip = page.locator('[data-slot="tooltip-content"]');
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText(reason);
  const [box, tip] = [(await control.boundingBox())!, (await tooltip.boundingBox())!];
  expect(tip.y + tip.height).toBeLessThanOrEqual(box.y + 1);
  const middle = box.x + box.width / 2;
  expect(tip.x).toBeLessThanOrEqual(middle);
  expect(tip.x + tip.width).toBeGreaterThanOrEqual(middle);
}

// The middle of the name of a permission, the text of its label: the label also holds the reason, hidden, so `getByText`
// with the name alone does not find it.
const nameOf = (label: Locator) => label.evaluate(node => {
  const range = document.createRange();
  range.selectNodeContents([...node.childNodes].find(child => child.nodeType === Node.TEXT_NODE && child.textContent!.trim())!);
  const box = range.getBoundingClientRect();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
});

// RO3-D with «Administrar incluye Ver» (RO4 · 4): Soporte manages and publishes forms, and both include «Ver formularios»,
// which stays checked and off. Its reason names both above its square with the mouse anywhere on its row, a click that
// does not change it, or the focus on the square itself; removing one leaves it off while the other includes it.
for (const language of ["es", "en"] as const) {
  for (const width of [1440, 390, 320]) {
    test(`what a permission includes stays checked and off with its reason at ${width}px in ${language}`, async ({ page }) => {
      const text = included[language];
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/src/test/visual/index.html?screen=/roles/support&scenario=role-included&lang=${language}`);
      const table = page.getByRole("table", { name: language === "es" ? "Permisos" : "Permissions" });
      const forms = table.getByRole("rowgroup", { name: text.area });
      const view = forms.getByRole("checkbox", { name: text.view });
      await expect(view).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expect(view).toBeChecked();
      await expect(view).toHaveAttribute("aria-disabled", "true");
      await expect(forms.getByRole("checkbox", { name: text.manage })).toBeChecked();
      await expect(forms.getByRole("checkbox", { name: text.publish })).toBeChecked();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const scroll = table.locator("xpath=..");
      expect(await scroll.evaluate(element => element.scrollWidth)).toBeLessThanOrEqual(await scroll.evaluate(element => element.clientWidth));

      // The whole row answers: its name shows the reason above the square, and a click there does not uncheck it.
      await view.scrollIntoViewIfNeeded();
      const onName = await nameOf(forms.locator("label").filter({ has: page.getByRole("checkbox", { name: text.view }) }));
      await page.mouse.move(onName.x, onName.y);
      await expectReasonAbove(page, view, text.both);
      await page.mouse.click(onName.x, onName.y);
      await expectReasonAbove(page, view, text.both);
      await expect(view).toBeChecked();
      if (language === "es") await expect(page).toHaveScreenshot(`role-included-${width}.png`);
      // Out to the right of «Permiso», where nothing has a tooltip, because at 320 the reason covers the band of the area:
      // Radix closes it with a move out of its grace area, so the pointer leaves in steps.
      const head = (await table.getByRole("columnheader").boundingBox())!;
      await page.mouse.move(head.x + head.width - 8, head.y + head.height / 2, { steps: 12 });
      await expect(page.locator('[data-slot="tooltip-content"]')).toHaveCount(0);

      // With the keyboard the square itself takes the focus, between the (i) of the area and «Administrar formularios».
      await forms.getByRole("checkbox", { name: text.manage }).focus();
      await page.keyboard.press("Shift+Tab");
      await expect(view).toBeFocused();
      await expectReasonAbove(page, view, text.both);
      await page.keyboard.press("Escape");
      await expect(page.locator('[data-slot="tooltip-content"]')).toHaveCount(0);

      if (width !== 1440) return;
      // Removing one leaves it checked and off, now by the other; removing both leaves it checked and on.
      await forms.getByText(text.publish, { exact: true }).click();
      await expect(forms.getByRole("checkbox", { name: text.publish })).not.toBeChecked();
      await expect(view).toHaveAttribute("aria-disabled", "true");
      await page.mouse.move(onName.x, onName.y, { steps: 4 });
      await expectReasonAbove(page, view, text.one);
      await forms.getByText(text.manage, { exact: true }).click();
      await expect(forms.getByRole("checkbox", { name: text.manage })).not.toBeChecked();
      await expect(view).toBeChecked();
      await expect(view).not.toHaveAttribute("aria-disabled");
      await expect(page.getByRole("button", { name: text.save, exact: true })).toBeEnabled();
    });
  }
}
