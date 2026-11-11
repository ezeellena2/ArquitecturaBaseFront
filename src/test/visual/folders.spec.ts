import { expect, test, type Page } from "@playwright/test";

// CP1-A to CP5-A with the real routes and the synthetic folders of `folderFixtures` («*-folders» scenarios): the panel to the
// left of the listings and the phone's selector with its sheet, the «…» of a folder, «En el menú…», «Carpetas…» of a row and
// the menus of their own in the side menu. Evidence without golden in es/en at 1440, 390 and 320, to compare with the board.
const texts = {
  es: { catalogs: "Catálogos", forms: "Diseñar formularios", overview: "Formularios", folders: "Carpetas", delivery: "Repartos", north: "Norte", all: "Carpeta: Todos", actions: "Acciones de «Repartos»", menu: "En el menú…", menuTitle: "«Repartos» en el menú", own: "Un menú propio", rowFolders: /^Carpetas de «/, navigation: "Menú de navegación" },
  en: { catalogs: "Catalogs", forms: "Design forms", overview: "Forms", folders: "Folders", delivery: "Deliveries", north: "North", all: "Folder: All", actions: "Actions of “Deliveries”", menu: "In the menu…", menuTitle: "“Deliveries” in the menu", own: "A menu of its own", rowFolders: /^Folders of “/, navigation: "Navigation menu" },
} as const;
const noSideScroll = async (page: Page, width: number) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);

for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  const text = texts[language];
  const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/visual/folders-${name}-${language}-${width}.png`, fullPage: true });

  test(`catalogs with their folders in ${language} at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/src/test/visual/index.html?screen=/catalogos&scenario=catalogs-folders&lang=${language}`);
    await expect(page.getByRole("heading", { name: text.catalogs, exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    if (width === 1440) {
      const panel = page.getByRole("region", { name: text.folders, exact: true });
      await expect(panel.getByRole("button", { name: text.delivery, exact: true })).toBeVisible();
      await panel.getByRole("button", { name: text.delivery, exact: true }).click();
      await expect(panel.getByRole("button", { name: text.delivery, exact: true })).toHaveAttribute("aria-current", "true");
      await shot(page, "catalogs-panel");
      await panel.getByRole("button", { name: text.actions, exact: true }).focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("menuitem", { name: text.menu, exact: true })).toBeVisible();
      await shot(page, "catalogs-folder-actions");
      await page.getByRole("menuitem", { name: text.menu, exact: true }).click();
      const dialog = page.getByRole("dialog", { name: text.menuTitle, exact: true });
      await expect(dialog.getByRole("radio", { name: text.own, exact: true })).toBeChecked();
      await shot(page, "catalogs-folder-menu");
      await page.keyboard.press("Escape");
    } else {
      await page.getByRole("button", { name: text.all, exact: true }).click();
      const sheet = page.getByRole("dialog", { name: text.folders, exact: true });
      await expect(sheet.getByRole("button", { name: text.delivery, exact: true })).toBeVisible();
      await noSideScroll(page, width);
      await shot(page, "catalogs-sheet");
      await sheet.getByRole("button", { name: text.delivery, exact: true }).click();
      await expect(sheet).toBeHidden();
    }
    await noSideScroll(page, width);
  });

  test(`«Carpetas…» of a form in ${language} at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/src/test/visual/index.html?screen=/formularios&scenario=forms-folders&lang=${language}`);
    await expect(page.getByRole("heading", { name: text.forms, exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole("button", { name: text.rowFolders }).first().click();
    const dialog = page.getByRole("dialog", { name: text.rowFolders });
    await expect(dialog.getByRole("checkbox", { name: text.north, exact: true })).toBeVisible();
    await noSideScroll(page, width);
    await shot(page, "form-item-dialog");
  });

  test(`menus of their own in the side menu in ${language} at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/src/test/visual/index.html?screen=/formularios/respuestas&scenario=forms-overview-folders&lang=${language}`);
    await expect(page.getByRole("heading", { name: text.overview, exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    if (width === 1440) {
      // The side menu, not the folder of the same name in the listing's panel.
      await page.getByRole("complementary").getByRole("button", { name: text.delivery, exact: true }).click();
      await expect(page.getByRole("navigation", { name: text.delivery, exact: true })).toBeVisible();
      await shot(page, "own-menu-panel");
    } else {
      await page.getByRole("button", { name: text.navigation, exact: true }).click();
      await page.getByRole("complementary").getByRole("button", { name: text.delivery, exact: true }).click();
      await expect(page.getByRole("button", { name: text.north, exact: true })).toBeVisible();
      await shot(page, "own-menu-drawer");
    }
    await noSideScroll(page, width);
  });
}
