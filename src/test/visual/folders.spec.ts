import { expect, test, type Locator, type Page } from "@playwright/test";

// CM1 to CM6 with the real routes and the synthetic folders of `folderFixtures` («*-folders» scenarios): each folder of the first
// level is a menu after WhatsApp, with its panel (on the phone, a group of the drawer) and «Nueva carpeta»; the dialogs to create,
// put forms in, move and delete; the «Carpeta» filter and «Carpetas…» of a row; whoever only loads, the drawer and the collapsed
// menu; and the states. Evidence without golden in es/en at 1440, 390 and 320, to compare with the boards.
const texts = {
  es: {
    forms: "Diseñar formularios", catalogs: "Catálogos", crumbs: "Migas de pan", mainMenu: "Navegación principal", drawer: "Menú de navegación", collapse: "Contraer menú",
    billing: "Facturación", delivery: "Repartos", north: "Norte", south: "Sur", sowing: "Siembra y cosecha", control: "Control de carga",
    whatsapp: "WhatsApp", administration: "Administración", newFolder: "Nueva carpeta", name: "Nombre", icon: "Ícono", create: "Crear", purchases: "Compras",
    empty: "Todavía no hay formularios en «Compras»", addForms: "Agregar formularios", formsOf: "Formularios de «Compras»", formsField: "Formularios", foldersField: "Carpetas", draft: "Borrador",
    actions: (name: string) => `Acciones de «${name}»`, move: /^Mover a…/, moveReason: "Tiene subcarpetas: no puede ir adentro de otra.", addFormsItem: "Agregar formularios…",
    moveTitle: "Mover «Norte» a…", where: "Dónde va", into: (name: string) => `Adentro de «${name}»`, delete: "Borrar", deleteTitle: "¿Borrar «Repartos»?", deleteConfirm: "Borrar carpeta",
    filter: "Carpeta Todas las carpetas", withoutFolder: "Sin carpeta", rowFolders: /^Carpetas de «/, catalogsLink: "Ver sus 2 catálogos", loadError: "No pudimos cargar tu menú.", retry: "Reintentar",
  },
  en: {
    forms: "Design forms", catalogs: "Catalogs", crumbs: "Breadcrumb", mainMenu: "Main navigation", drawer: "Navigation menu", collapse: "Collapse menu",
    billing: "Billing", delivery: "Deliveries", north: "North", south: "South", sowing: "Sowing and harvest", control: "Load check",
    whatsapp: "WhatsApp", administration: "Administration", newFolder: "New folder", name: "Name", icon: "Icon", create: "Create", purchases: "Purchases",
    empty: "There are no forms in “Purchases” yet", addForms: "Add forms", formsOf: "Forms of “Purchases”", formsField: "Forms", foldersField: "Folders", draft: "Draft",
    actions: (name: string) => `Actions of “${name}”`, move: /^Move to…/, moveReason: "It has subfolders: it can't go inside another one.", addFormsItem: "Add forms…",
    moveTitle: "Move “North” to…", where: "Where it goes", into: (name: string) => `Inside “${name}”`, delete: "Delete", deleteTitle: "Delete “Deliveries”?", deleteConfirm: "Delete folder",
    filter: "Folder All folders", withoutFolder: "No folder", rowFolders: /^Folders of “/, catalogsLink: "See its 2 catalogs", loadError: "We couldn't load your menu.", retry: "Retry",
  },
} as const;
type Texts = (typeof texts)[keyof typeof texts];

const noSideScroll = async (page: Page, width: number) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
const open = async (page: Page, screen: string, scenario: string, language: string, ready: (page: Page) => Locator) => {
  await page.goto(`/src/test/visual/index.html?screen=${screen}&scenario=${scenario}&lang=${language}`);
  await expect(ready(page)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
};

/// The drawer slides in: it is read and drawn once it is in its place.
async function openDrawer(page: Page, text: Texts) {
  await page.getByRole("button", { name: text.drawer, exact: true }).click();
  await expect.poll(() => page.locator("aside").evaluate(element => element.getBoundingClientRect().left)).toBe(0);
}
/// The notice of what was done would cover the next capture.
async function dismissNotices(page: Page) {
  for (const close of await page.locator("[data-sonner-toast] [data-close-button]").all()) await close.click();
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
}

/// The menu where the folders are: the side menu on the desktop, the drawer on the phone (opened here).
async function sideMenu(page: Page, text: Texts, mobile: boolean) {
  if (mobile) await openDrawer(page, text);
  const menu = page.getByRole("navigation", { name: text.mainMenu, exact: true });
  await expect(menu).toBeVisible();
  return menu;
}

/// What a folder has: its panel on the desktop, its group of the drawer on the phone (the drawer's list, where the group opens).
async function openFolder(page: Page, text: Texts, mobile: boolean, name: string) {
  const menu = await sideMenu(page, text, mobile);
  await menu.getByRole("button", { name, exact: true }).click();
  if (mobile) {
    await expect(menu.getByRole("button", { name, exact: true })).toHaveAttribute("aria-expanded", "true");
    return { menu, folder: menu };
  }
  const folder = page.getByRole("navigation", { name, exact: true });
  await expect(folder).toBeVisible();
  return { menu, folder };
}

for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) test.describe(`folders in ${language} at ${width}px`, () => {
  const text = texts[language];
  const mobile = width < 768;
  // On the phone the ⋮ of each folder and subfolder is always in sight, as on a touch screen.
  test.use({ viewport: { width, height: 900 }, hasTouch: mobile });
  // A chevron that turns or a drawer that slides is drawn once it stops.
  const shot = async (page: Page, name: string) => {
    await page.waitForFunction(() => document.getAnimations().every(animation => !(animation instanceof CSSTransition) || animation.playState !== "running"));
    await page.screenshot({ path: `test-results/visual/folders-${name}-${language}-${width}.png`, fullPage: true });
  };

  test("CM1 · the folders go after WhatsApp and a form opened from the menu stays marked, with the breadcrumbs naming its folder", async ({ page }) => {
    await open(page, "/perfil", "responses-folders", language, current => current.getByRole("button", { name: mobile ? text.drawer : text.delivery, exact: true }));
    const { menu, folder } = await openFolder(page, text, mobile, text.delivery);
    const names = await menu.locator("a, button").evaluateAll(elements => elements.map(element => element.textContent?.trim() ?? ""));
    const order = [text.whatsapp, text.billing, text.delivery, text.sowing, text.newFolder, text.administration].map(name => names.indexOf(name));
    expect(order.every((position, index) => position >= 0 && (index === 0 || position > order[index - 1]))).toBe(true);
    await folder.getByRole("button", { name: text.north, exact: true }).click();
    await folder.getByRole("link", { name: text.control, exact: true }).click();
    await expect(page.getByRole("heading", { name: text.control, exact: true })).toBeVisible();
    if (mobile) await openDrawer(page, text);
    // Drawn again on the form's screens: its folder open, its group open and the form marked.
    const opened = mobile ? menu : page.getByRole("navigation", { name: text.delivery, exact: true });
    await expect(opened.getByRole("link", { name: text.control, exact: true })).toHaveAttribute("aria-current", "page");
    await expect(opened.getByRole("button", { name: text.north, exact: true })).toHaveAttribute("aria-expanded", "true");
    if (!mobile) {
      await expect(page.getByRole("navigation", { name: text.crumbs, exact: true }).getByRole("listitem")).toHaveText([/./, text.delivery, text.control]);
      // The band of the panel is 3 rem and its ⋮ 1,5 rem, at 75 % on the desktop.
      const band = await opened.locator(":scope > div").first().boundingBox();
      const actions = await opened.getByRole("button", { name: text.actions(text.delivery), exact: true }).boundingBox();
      expect(band?.height).toBeCloseTo(36, 0);
      expect(actions?.width).toBeCloseTo(18, 0);
      expect(actions?.height).toBeCloseTo(18, 0);
    }
    await noSideScroll(page, width);
    await shot(page, "menu");
  });

  test("CM2 · «Nueva carpeta» opens its dialog, the folder appears open and empty, and «Agregar formularios» lists the drafts with their tag", async ({ page }) => {
    await open(page, "/formularios", "forms-folders", language, current => current.getByRole("heading", { name: text.forms, exact: true }));
    const menu = await sideMenu(page, text, mobile);
    await menu.getByRole("button", { name: text.newFolder, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: text.newFolder, exact: true });
    await dialog.getByRole("textbox", { name: text.name, exact: true }).fill(text.purchases);
    // The icon is the only piece to choose: its button says the label and the chosen icon.
    const icon = dialog.getByRole("button", { name: new RegExp(`^${text.icon} `) });
    await expect(icon).toBeVisible();
    await noSideScroll(page, width);
    await shot(page, "new");
    await icon.click();
    await expect(page.getByRole("option").first()).toBeVisible();
    await shot(page, "new-icons");
    await page.keyboard.press("Escape");
    await dialog.getByRole("button", { name: text.create, exact: true }).click();
    await expect(dialog).toBeHidden();
    const folder = mobile ? menu : page.getByRole("navigation", { name: text.purchases, exact: true });
    await expect(folder.getByText(text.empty, { exact: true })).toBeVisible();
    if (mobile) await expect(menu.getByRole("button", { name: text.purchases, exact: true })).toHaveAttribute("aria-expanded", "true");
    await noSideScroll(page, width);
    await shot(page, "empty");
    await dismissNotices(page);
    await folder.getByRole("button", { name: text.addForms, exact: true }).click();
    const forms = page.getByRole("dialog", { name: text.formsOf, exact: true });
    // DS1-A: the forms are chosen with the shared piece, several at a time; its list says a draft in grey.
    await forms.getByRole("button", { name: new RegExp("^" + text.formsField + " ") }).click();
    await expect(page.getByRole("option").filter({ hasText: text.draft }).first()).toBeVisible();
    await noSideScroll(page, width);
    await shot(page, "forms");
  });

  test("CM3 · Diseñar formularios has no panel, with the «Carpeta» filter and «Carpetas…» of two levels", async ({ page }) => {
    await open(page, "/formularios", "forms-folders", language, current => current.getByRole("heading", { name: text.forms, exact: true }));
    await page.getByRole("button", { name: text.filter, exact: true }).click();
    await expect(page.getByRole("option", { name: text.withoutFolder, exact: true })).toBeVisible();
    await expect(page.getByRole("option", { name: text.north, exact: true })).toBeVisible();
    await noSideScroll(page, width);
    await shot(page, "forms-filter");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: text.rowFolders }).first().click();
    const dialog = page.getByRole("dialog", { name: text.rowFolders });
    await expect(dialog.getByRole("button", { name: text.newFolder, exact: true })).toBeVisible();
    // DS1-A: the folders are chosen with the shared piece; a subfolder goes under its folder.
    await dialog.getByRole("button", { name: new RegExp("^" + text.foldersField + " ") }).click();
    await expect(page.getByRole("option", { name: text.north, exact: true })).toBeVisible();
    await noSideScroll(page, width);
    await shot(page, "item");
  });

  test("CM3 · Catálogos has no panel, with the «Carpeta» filter", async ({ page }) => {
    await open(page, "/catalogos", "catalogs-folders", language, current => current.getByRole("heading", { name: text.catalogs, exact: true }));
    await page.getByRole("button", { name: text.filter, exact: true }).click();
    await expect(page.getByRole("option", { name: text.south, exact: true })).toBeVisible();
    await noSideScroll(page, width);
    await shot(page, "catalogs-filter");
  });

  test("CM4 · the ⋮ of a folder and of a subfolder, moving and deleting, with the focus on «Nueva carpeta» once the folder leaves", async ({ page }) => {
    await open(page, "/formularios", "forms-folders", language, current => current.getByRole("heading", { name: text.forms, exact: true }));
    const { menu, folder } = await openFolder(page, text, mobile, text.delivery);
    await folder.getByRole("button", { name: text.north, exact: true }).click();
    if (mobile) await shot(page, "drawer");
    await folder.getByRole("button", { name: text.actions(text.delivery), exact: true }).click();
    const move = page.getByRole("menuitem", { name: text.move });
    await expect(move).toHaveAttribute("aria-disabled", "true");
    await expect(move).toContainText(text.moveReason);
    await noSideScroll(page, width);
    await shot(page, "folder-actions");
    await page.keyboard.press("Escape");
    await folder.getByRole("button", { name: text.actions(text.north), exact: true }).click();
    await expect(page.getByRole("menuitem", { name: text.addFormsItem, exact: true })).toBeVisible();
    await shot(page, "subfolder-actions");
    await page.getByRole("menuitem", { name: text.move }).click();
    const moving = page.getByRole("dialog", { name: text.moveTitle, exact: true });
    await expect(moving.getByRole("button", { name: `${text.where} ${text.into(text.delivery)}`, exact: true })).toBeVisible();
    await noSideScroll(page, width);
    await shot(page, "move");
    await page.keyboard.press("Escape");
    await expect(moving).toBeHidden();
    await folder.getByRole("button", { name: text.actions(text.delivery), exact: true }).click();
    await page.getByRole("menuitem", { name: text.delete, exact: true }).click();
    const deleting = page.getByRole("dialog", { name: text.deleteTitle, exact: true });
    await expect(deleting.getByRole("button", { name: text.deleteConfirm, exact: true })).toBeEnabled();
    await noSideScroll(page, width);
    await shot(page, "delete");
    await deleting.getByRole("button", { name: text.deleteConfirm, exact: true }).click();
    await expect(deleting).toBeHidden();
    await expect(menu.getByRole("button", { name: text.delivery, exact: true })).toHaveCount(0);
    await expect(menu.getByRole("button", { name: text.newFolder, exact: true })).toBeFocused();
  });

  test("CM5 · whoever only loads sees the folders with forms, without «Nueva carpeta», ⋮ or «Agregar formularios»", async ({ page }) => {
    await open(page, "/perfil", "loads-folders", language, current => current.getByRole("button", { name: mobile ? text.drawer : text.delivery, exact: true }));
    const { menu, folder } = await openFolder(page, text, mobile, text.delivery);
    await folder.getByRole("button", { name: text.north, exact: true }).click();
    await expect(folder.getByRole("link", { name: text.control, exact: true })).toBeVisible();
    await expect(menu.getByRole("button", { name: text.newFolder, exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: text.actions(text.delivery), exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: text.addForms, exact: true })).toHaveCount(0);
    await expect(menu.getByRole("button", { name: text.sowing, exact: true })).toHaveCount(0);
    await noSideScroll(page, width);
    await shot(page, "loads");
  });

  if (!mobile) test("CM5 · collapsed, each folder is its icon with its name in a tooltip, and opens its panel", async ({ page }) => {
    await open(page, "/perfil", "forms-folders", language, current => current.getByRole("button", { name: text.collapse, exact: true }));
    await page.getByRole("button", { name: text.collapse, exact: true }).click();
    const trigger = page.getByRole("complementary").getByRole("button", { name: text.delivery, exact: true });
    await trigger.hover();
    await expect(page.getByRole("tooltip", { name: text.delivery })).toBeVisible();
    await shot(page, "collapsed");
    await trigger.click();
    await expect(page.getByRole("navigation", { name: text.delivery, exact: true })).toBeVisible();
    await shot(page, "collapsed-panel");
  });

  test("CM6 · a subfolder without forms has its own «Agregar formularios», and a folder with only catalogs leads to them", async ({ page }) => {
    await open(page, "/formularios", "forms-folders", language, current => current.getByRole("heading", { name: text.forms, exact: true }));
    const { folder } = await openFolder(page, text, mobile, text.delivery);
    await folder.getByRole("button", { name: text.south, exact: true }).click();
    await expect(folder.getByRole("button", { name: text.addForms, exact: true })).toHaveCount(2);
    await noSideScroll(page, width);
    await shot(page, "empty-subfolder");
    const sowing = mobile ? folder : (await openFolder(page, text, false, text.sowing)).folder;
    if (mobile) await sowing.getByRole("button", { name: text.sowing, exact: true }).click();
    await expect(sowing.getByRole("link", { name: text.catalogsLink, exact: true })).toBeVisible();
    await noSideScroll(page, width);
    await shot(page, "catalogs-only");
  });

  test("CM6 · without folders whoever administers sees only «Nueva carpeta», and a menu that could not be read offers Reintentar", async ({ page }) => {
    await open(page, "/formularios", "forms-without-folders", language, current => current.getByRole("heading", { name: text.forms, exact: true }));
    let menu = await sideMenu(page, text, mobile);
    await expect(menu.getByRole("button", { name: text.newFolder, exact: true })).toBeVisible();
    await expect(menu.getByRole("button", { name: text.delivery, exact: true })).toHaveCount(0);
    await noSideScroll(page, width);
    await shot(page, "none");
    await open(page, "/formularios", "forms-failed-folders", language, current => current.getByRole("heading", { name: text.forms, exact: true }));
    menu = await sideMenu(page, text, mobile);
    await expect(menu.getByText(text.loadError, { exact: true })).toBeVisible();
    await expect(menu.getByRole("button", { name: text.retry, exact: true })).toBeVisible();
    await noSideScroll(page, width);
    await shot(page, "error");
  });
});
