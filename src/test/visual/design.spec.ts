import { expect, test, type Page } from "@playwright/test";

for (const width of [1440, 320]) {
  test(`an operational notice remains accessible above an open dialog at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openScreen(page, "/usuarios", "es", "dialog-error");
    await page.getByRole("button", { name: "Nuevo usuario", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo usuario", exact: true });
    const email = dialog.getByRole("textbox", { name: "Correo electrónico", exact: true });
    await email.fill("draft@example.test");
    await dialog.getByRole("button", { name: "Crear", exact: true }).click();
    const notice = page.locator("[data-sonner-toast]");
    await expect(notice).toHaveCount(1);
    await expect(notice).toContainText("No pudimos confirmar el resultado");
    await expect(email).toHaveValue("draft@example.test");
    expect(await notice.evaluate(element => element.closest('[aria-hidden="true"]') === null)).toBe(true);
    const close = notice.getByRole("button", { name: "Cerrar aviso", exact: true });
    await close.focus();
    await expect(close).toBeFocused();
    if (width === 320) await close.click();
    else await page.keyboard.press("Enter");
    await expect(notice).toHaveCount(0);
    await expect(dialog).toBeVisible();
    const geometry = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    expect(geometry.scroll).toBeLessThanOrEqual(geometry.width + 1);
  });
}

async function openScreen(page: Page, screen: string, language = "es", scenario?: string) {
  const parameters = new URLSearchParams({ screen, lang: language, ...(scenario ? { scenario } : {}) });
  await page.goto(`/src/test/visual/index.html?${parameters}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const screens = [
  { id: "users", path: "/usuarios", ready: "table" },
  { id: "roles", path: "/roles", ready: "table" },
  { id: "editor", path: "/roles/support", ready: "table" },
  { id: "settings", path: "/configuracion", ready: "combobox" },
  { id: "profile", path: "/perfil", ready: "textbox" },
  { id: "catalog", path: "/catalogo", ready: "table" },
] as const;

for (const width of [1440, 320]) {
  for (const screen of screens) {
    test(`${screen.id} at ${width}px uses the approved system`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openScreen(page, screen.path);
      await expect(page.getByRole(screen.ready).first()).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", "es");
      const geometry = await page.evaluate(() => ({
        viewport: innerWidth, document: document.documentElement.scrollWidth,
        main: document.querySelector("main")?.getBoundingClientRect().width,
      }));
      expect(geometry.document).toBeLessThanOrEqual(geometry.viewport + 1);
      expect(geometry.main).toBeGreaterThan(0);
      await expect(page).toHaveScreenshot(`${screen.id}-${width}.png`, { fullPage: true });
    });
  }
}

test("English fits at 390px without changing control dimensions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openScreen(page, "/catalogo", "en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const input = page.getByRole("textbox").first();
  const button = page.getByRole("button", { name: "Save", exact: true }).first();
  expect((await input.boundingBox())?.height).toBe(30);
  expect((await button.boundingBox())?.height).toBe(30);
  await expect(page).toHaveScreenshot("catalog-en-390.png", { fullPage: true });
});

test("surface actions stay on the right edge of their header when they wrap", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await openScreen(page, "/catalogo");
  const surface = page.getByRole("region", { name: "Modales y tooltips", exact: true });
  const title = surface.getByRole("heading", { name: "Modales y tooltips", exact: true });
  const header = title.locator("..");
  const first = surface.getByRole("button", { name: "Abrir formulario", exact: true });
  const last = surface.getByRole("button", { name: "Exportar ejemplo", exact: true });
  await last.scrollIntoViewIfNeeded();
  const measure = async () => {
    const [band, heading, start, action] = await Promise.all([header.boundingBox(), title.boundingBox(), first.boundingBox(), last.boundingBox()]);
    return { right: band!.x + band!.width - (action!.x + action!.width), titleBottom: heading!.y + heading!.height,
      titleCenter: heading!.y + heading!.height / 2, firstTop: start!.y, actionTop: action!.y, actionCenter: action!.y + action!.height / 2 };
  };
  // A 320 las acciones bajan de renglón y no entran juntas en una fila: la última sigue al borde derecho, con el
  // mismo margen de 16 px que el título a la izquierda (lo resuelve justify-end).
  const narrow = await measure();
  expect(narrow.firstTop).toBeGreaterThanOrEqual(narrow.titleBottom);
  expect(narrow.actionTop).toBeGreaterThan(narrow.firstTop);
  expect(Math.abs(narrow.right - 16)).toBeLessThanOrEqual(1);
  // A 390 el bloque no entra al lado del título pero sí entero en su propia fila: queda al borde derecho y no a la
  // izquierda, donde lo dejaría justify-between (lo resuelve ml-auto).
  await page.setViewportSize({ width: 390, height: 900 });
  await last.scrollIntoViewIfNeeded();
  const whole = await measure();
  expect(whole.firstTop).toBeGreaterThanOrEqual(whole.titleBottom);
  expect(whole.actionTop).toBe(whole.firstTop);
  expect(Math.abs(whole.right - 16)).toBeLessThanOrEqual(1);
  // A 1440 entran en el renglón del título, al borde derecho y a su altura. En escritorio la escala es 75 %:
  // el margen de 1rem mide 12.
  await page.setViewportSize({ width: 1440, height: 900 });
  await last.scrollIntoViewIfNeeded();
  const wide = await measure();
  expect(Math.abs(wide.right - 12)).toBeLessThanOrEqual(1);
  expect(Math.abs(wide.actionCenter - wide.titleCenter)).toBeLessThanOrEqual(1);
});

test("listing and editor share actual header typography and row sizes", async ({ page }) => {
  // Escritorio a escala 75 %: cabecera de 11 px y 32 de alto, fila de 36, medidas sobre la raíz de 12.
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const screen of ["/usuarios", "/roles", "/roles/support"]) {
    await openScreen(page, screen);
    const heading = page.getByRole("columnheader").first();
    await expect(heading).toBeVisible();
    expect(await heading.evaluate(element => getComputedStyle(element).fontSize)).toBe("8.25px");
    expect((await heading.boundingBox())?.height).toBe(24);
    if (screen !== "/roles/support") {
      const row = page.getByRole("row").nth(1);
      expect((await row.boundingBox())?.height).toBe(27);
    }
  }
});

test("table scrolling stays inside the table on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await openScreen(page, "/roles/support");
  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  const scroll = page.locator('[data-slot="table-container"]');
  expect(await scroll.evaluate(element => element.scrollWidth)).toBeGreaterThan(await scroll.evaluate(element => element.clientWidth));
  await scroll.evaluate(element => { element.scrollLeft = element.scrollWidth; });
  expect(await scroll.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  await expect(page.getByRole("columnheader", { name: "Asignado" })).toBeVisible();
});

test("table bodies alternate colors while headers and hover keep their hierarchy", async ({ page }) => {
  for (const screen of ["/usuarios", "/roles"]) {
    await openScreen(page, screen);
    const rows = page.locator('[data-slot="table-body"] > tr');
    await expect(rows.first()).toBeVisible();
    await page.mouse.move(0, 0);
    const background = (index: number) => rows.nth(index).evaluate(element => getComputedStyle(element).backgroundColor);
    expect(await background(0)).toBe("rgb(255, 255, 255)");
    expect(await background(1)).toBe("rgb(244, 246, 240)");
    expect(await background(2)).toBe(await background(0));
    expect(await page.locator("thead tr").evaluate(element => getComputedStyle(element).backgroundColor)).toBe("rgb(223, 232, 217)");
    await rows.nth(1).hover();
    await expect.poll(() => background(1)).toBe("rgb(231, 237, 234)");
  }
});

test("role fields, filters and permissions have separate shared containers", async ({ page }) => {
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await openScreen(page, "/roles/support");
    const name = page.getByRole("textbox", { name: /^Nombre/ });
    await expect(name).toBeVisible();
    const fields = page.locator('[data-slot="surface"]').filter({ has: name });
    const filters = page.locator('[data-slot="filter-bar"]');
    const permissions = page.locator('[data-slot="surface"]').filter({ has: page.getByRole("table") });
    await expect(fields).toHaveCount(1);
    expect(await fields.evaluate(element => getComputedStyle(element).borderTopWidth)).toBe("1px");
    expect((await filters.boundingBox())!.y).toBeGreaterThan((await fields.boundingBox())!.y + (await fields.boundingBox())!.height);
    expect((await permissions.boundingBox())!.y).toBeGreaterThan((await filters.boundingBox())!.y + (await filters.boundingBox())!.height);
  }
});

test("the sticky header preserves keyboard focus in a long editor", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 600 });
  await openScreen(page, "/roles/support", "es", "tall");
  await expect(page.getByRole("table")).toBeVisible();
  const main = page.getByRole("main");
  const header = main.locator("header");
  const before = (await header.boundingBox())!;
  await main.evaluate(element => { element.scrollTop = 350; });
  expect(await main.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  expect((await header.boundingBox())?.y).toBe(before.y);
  const description = page.getByRole("textbox", { name: "Descripción" });
  await description.focus();
  await page.keyboard.press("Shift+Tab");
  const name = page.getByRole("textbox", { name: /^Nombre/ });
  await expect(name).toBeFocused();
  expect((await name.boundingBox())!.y).toBeGreaterThanOrEqual((await header.boundingBox())!.y + (await header.boundingBox())!.height);
});

test("filter menus and removable filters work with keyboard", async ({ page }) => {
  await openScreen(page, "/usuarios");
  const trigger = page.getByRole("button", { name: "Filtrar por rol", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toBeVisible();
  await page.getByRole("menuitem", { name: "Admin" }).click();
  const remove = page.getByRole("button", { name: /Quitar.*[Rr]ol/ });
  await expect(remove).toBeVisible();
  await remove.focus();
  await page.keyboard.press("Enter");
  await expect(remove).toHaveCount(0);
});

test("settings revisit refreshes cached values after another administrator changes them", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openScreen(page, "/configuracion");
  const size = page.getByRole("combobox", { name: "Filas por página", exact: true });
  await expect(size).toHaveValue("20");
  await page.getByRole("link", { name: "Inicio", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Inicio", exact: true, level: 1 })).toBeVisible();
  const status = await page.evaluate(async () => (await fetch("/api/settings", {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ defaultPageSize: 50, expectedRevision: 1 }),
  })).status);
  expect(status).toBe(204);
  expect(await page.evaluate(async () => (await (await fetch("/api/settings")).json()).defaultPageSize)).toBe(50);
  await page.getByRole("button", { name: "Administración", exact: true }).click();
  const configuration = page.getByRole("button", { name: "Configuración", exact: true });
  if (await configuration.getAttribute("aria-expanded") !== "true") await configuration.click();
  await page.locator('a[href="/configuracion"]').click();
  await expect(size).toHaveValue("50");
  await expect(page.getByRole("button", { name: "Guardar cambios", exact: true })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath("settings-fresh.png"), fullPage: true });
});

for (const width of [1440, 320]) {
  for (const language of ["es", "en"]) {
    test(`empty pagination at ${width}px omits the page counter in ${language}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await openScreen(page, "/usuarios", language, "empty");
      const english = language === "en";
      const pagination = page.getByRole("navigation", { name: english ? "Pagination" : "Paginado" });
      await expect(pagination).toBeVisible();
      await expect(pagination).toContainText(english ? "0–0 of 0" : "0–0 de 0");
      await expect(pagination.getByText(english ? /Page \d+ of \d+/ : /Página \d+ de \d+/)).toHaveCount(0);
      for (const button of await pagination.getByRole("button").all()) await expect(button).toBeDisabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
      await page.screenshot({ path: testInfo.outputPath("empty-pagination.png"), fullPage: true });
    });
  }
}

test("a user dialog fits a narrow screen and restores focus", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await openScreen(page, "/usuarios");
  const trigger = page.getByRole("button", { name: "Nuevo usuario", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(box.height).toBeLessThanOrEqual(740);
  await expect(dialog.getByRole("button", { name: "Crear", exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot("user-dialog-320.png", { fullPage: true });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("a settings conflict uses the common comparison table", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await openScreen(page, "/configuracion", "es", "conflict");
  await page.getByRole("combobox", { name: "Filas por página", exact: true }).selectOption("100");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await page.getByRole("button", { name: "Revisar valores actuales", exact: true }).first().click();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("rowheader")).toHaveCount(4);
  // Revisar está en la banda y la comparación, al final: la lectura lleva el foco a su título y la deja a la vista.
  const title = page.getByRole("heading", { level: 2, name: "Revisar cambios", exact: true });
  await expect(title).toBeFocused();
  await expect(title).toBeInViewport();
  await page.getByRole("table").scrollIntoViewIfNeeded();
  await expect(page).toHaveScreenshot("settings-review-320.png", { fullPage: true });
});

// Con el menú y el panel de Administración abiertos, Revisar, Descartar y Guardar no entran al lado del título: bajan de
// renglón, al borde derecho de la banda, y el título queda entero. A 800 px también se reparten en dos renglones.
for (const width of [1024, 800]) {
  test(`a settings conflict keeps the whole title with its actions on the right at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await openScreen(page, "/configuracion", "es", "conflict");
    await page.getByRole("combobox", { name: "Filas por página", exact: true }).selectOption("100");
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
    const title = page.getByRole("heading", { level: 1, name: "Configuración", exact: true });
    const header = page.locator("header").filter({ has: title });
    await expect(header.getByRole("button", { name: "Revisar valores actuales", exact: true })).toBeVisible();
    const geometry = await header.evaluate(band => {
      const heading = band.querySelector("h1")!;
      const edge = band.getBoundingClientRect().right - parseFloat(getComputedStyle(band).paddingRight);
      const buttons = [...band.querySelectorAll("button")].map(button => button.getBoundingClientRect());
      return {
        cut: heading.scrollWidth > heading.clientWidth,
        inside: buttons.every(box => box.left >= band.getBoundingClientRect().left && box.right <= edge + 1),
        rightGap: Math.round(edge - Math.max(...buttons.map(box => box.right))),
        overflow: document.querySelector("main")!.scrollWidth > document.querySelector("main")!.clientWidth,
      };
    });
    expect(geometry).toEqual({ cut: false, inside: true, rightGap: 0, overflow: false });
    await page.screenshot({ path: testInfo.outputPath(`settings-conflict-header-${width}.png`) });
  });
}

for (const language of ["es", "en"]) {
  test(`unified settings preserves the draft when confirmation closes in ${language}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await openScreen(page, "/configuracion", language);
    const english = language === "en";
    const culture = page.getByRole("combobox", { name: english ? "Default language" : "Idioma predeterminado", exact: true });
    const zone = page.getByRole("combobox", { name: english ? "Default time zone" : "Zona horaria predeterminada", exact: true });
    const size = page.getByRole("combobox", { name: english ? "Rows per page" : "Filas por página", exact: true });
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(3);
    await culture.selectOption(english ? "es" : "en");
    await zone.selectOption("UTC");
    await size.selectOption("50");
    await page.getByRole("radio", { name: english ? "Open registration" : "Registro abierto", exact: true }).click();
    const save = page.getByRole("button", { name: english ? "Save changes" : "Guardar cambios", exact: true });
    await save.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const bounds = (await dialog.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
    await page.screenshot({ path: testInfo.outputPath("settings-confirmation.png"), animations: "disabled" });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(culture).toHaveValue(english ? "es" : "en");
    await expect(zone).toHaveValue("UTC");
    await expect(size).toHaveValue("50");
    await save.click();
    await dialog.getByRole("button", { name: english ? "Save changes" : "Guardar cambios", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(save).toBeDisabled();
    await expect(size).toHaveValue("50");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  });
}

test("public access uses the explicit larger variant", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openScreen(page, "/login?returnUrl=%2Fconnect%2Fauthorize%3Fclient_id%3Dweb");
  await expect(page.getByRole("textbox", { name: /[Cc]orreo/ })).toBeVisible();
  expect((await page.getByRole("textbox", { name: /[Cc]orreo/ }).boundingBox())?.height).toBeGreaterThanOrEqual(46);
  await expect(page).toHaveScreenshot("login-390.png", { fullPage: true });
});

for (const language of ["es", "en"]) {
  test(`shared selection, tooltips and dialogs work with keyboard in ${language}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await openScreen(page, "/catalogo", language);
    const english = language === "en";
    const single = page.getByRole("combobox", { name: english ? "Role" : "Rol", exact: true });
    await single.scrollIntoViewIfNeeded();
    await single.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("option", { name: "Admin", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    const multiple = page.getByRole("button", { name: "Roles", exact: true });
    await multiple.scrollIntoViewIfNeeded();
    await multiple.focus();
    await page.keyboard.press("Enter");
    const admin = page.getByRole("menuitemcheckbox", { name: "Admin", exact: true });
    await expect(admin).toBeVisible();
    await admin.click();
    await expect(admin).toBeChecked();
    await page.keyboard.press("Escape");
    await expect(multiple).toContainText("Admin, User");
    const group = page.getByRole("radiogroup", { name: english ? "Account registration" : "Registro de cuentas" });
    const invited = group.getByRole("radio", { name: english ? "Invitation only" : "Solo por invitación" });
    await invited.scrollIntoViewIfNeeded();
    await invited.focus();
    await expect(invited).toBeFocused();
    await page.keyboard.down("ArrowDown");
    await expect(group.getByRole("radio", { name: english ? "Open registration" : "Registro abierto" })).toBeChecked();
    await page.keyboard.up("ArrowDown");
    const checkbox = page.getByRole("checkbox", { name: english ? "Send an invitation" : "Mandar una invitación" });
    await checkbox.focus();
    await page.keyboard.press("Space");
    await expect(checkbox).toBeChecked();
    const edit = page.getByRole("button", { name: english ? "Edit example" : "Editar ejemplo", exact: true });
    await edit.scrollIntoViewIfNeeded();
    // El scroll de main despacha su evento en el siguiente frame. Radix cierra
    // un tooltip si todavía se está desplazando su contenedor.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await edit.focus();
    await expect(page.getByRole("tooltip")).toHaveText(english ? "Edit example" : "Editar ejemplo");
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: english ? "Example form" : "Formulario de ejemplo" });
    await expect(dialog).toBeVisible();
    const bounds = (await dialog.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
    await expect(dialog.getByRole("textbox", { name: english ? "Name" : "Nombre", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(edit).toBeFocused();
  });
}

test("a complete email uses the common tooltip inside the actual user editor", async ({ page }) => {
  await openScreen(page, "/usuarios");
  await page.getByRole("button", { name: "Editar a ana@example.com", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Editar usuario" });
  await expect(dialog).toBeVisible();
  const email = dialog.locator('span[tabindex="0"]').filter({ hasText: "ana@example.com" });
  await email.focus();
  await expect(page.getByRole("tooltip")).toHaveText("ana@example.com");
  await page.keyboard.press("Tab");
  await expect(dialog).toBeVisible();
  await expect(page.locator(":focus")).toBeVisible();
});

