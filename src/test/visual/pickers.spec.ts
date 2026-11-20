import { expect, test, type Locator, type Page } from "@playwright/test";

// DS1-A and DS2-A (2026-11-19) in the UI catalog: the only piece to choose from a list, closed, open with and without its
// search, as the button of a listing bar and, on the phone, taking the screen. Evidence es/en at 1440, 390 and 320 px,
// without golden: the captures go to test-results to compare them with the boards «DS1-A · Un botón que abre la lista; el
// buscador, adentro» and «DS2-A · Los nombres y «y 2 más» si no entran».
const copy = {
  es: { title: "Elegir de una lista", roles: "Roles", place: "Campo asignado", timeZone: "Zona horaria", value: "Valor", role: "Rol", close: "Cerrar la lista" },
  en: { title: "Choosing from a list", roles: "Roles", place: "Assigned field", timeZone: "Time zone", value: "Value", role: "Role", close: "Close the list" },
} as const;
type Lang = keyof typeof copy;

async function open(page: Page, lang: Lang, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/src/test/visual/index.html?screen=/catalogo&scenario=pickers&lang=${lang}`);
  const region = page.getByRole("region", { name: copy[lang].title, exact: true });
  await region.scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  return region;
}

// The catalog page has other examples with the same names: each field is looked for in the region of the piece.
const field = (region: Locator, name: string) => region.getByRole("button", { name: new RegExp(`^${name} `) });

for (const lang of ["es", "en"] as const) {
  test(`opens the list under its field, with its search when there are many (${lang})`, async ({ page }) => {
    const text = copy[lang];
    const region = await open(page, lang, 1440);
    await region.screenshot({ path: `test-results/pickers-closed-${lang}-1440.png` });

    // Several: the names that fit and «y N más», in a field that does not grow.
    const value = field(region, text.value);
    expect((await value.boundingBox())!.height).toBeLessThan(40);

    // Roles: the boxes on the left and the grey lines; marking does not close.
    await field(region, text.roles).press("Enter");
    const roles = page.getByRole("listbox", { name: text.roles });
    await expect(roles).toBeFocused();
    await page.keyboard.press("Home");
    await page.keyboard.press("Enter");
    await expect(roles).toBeVisible();
    await page.screenshot({ path: `test-results/pickers-roles-${lang}-1440.png` });
    await page.keyboard.press("Escape");
    await expect(field(region, text.roles)).toBeFocused();

    // Campo asignado: the search on top with the focus, how many there are and «Sin campo asignado» apart.
    await field(region, text.place).press("Enter");
    await expect(page.getByRole("combobox")).toBeFocused();
    await page.screenshot({ path: `test-results/pickers-place-${lang}-1440.png` });
    await page.keyboard.type("es");
    await page.screenshot({ path: `test-results/pickers-place-search-${lang}-1440.png` });
    // Tab closes and goes on to the next field.
    await page.keyboard.press("Tab");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(page.getByRole("button", { name: lang === "es" ? "Zona Sin zona" : "Zone No zone", exact: true })).toBeFocused();

    // The time zone: the city and, in grey, the time of its country and the offset.
    await field(region, text.timeZone).press("Enter");
    await page.keyboard.type("mont");
    await page.screenshot({ path: `test-results/pickers-time-zone-${lang}-1440.png` });
    await page.keyboard.press("Escape");

    // The filter of a listing bar keeps its button and opens the same list.
    await field(region, text.role).press("Enter");
    await expect(page.getByRole("listbox", { name: text.role })).toBeVisible();
    await page.screenshot({ path: `test-results/pickers-bar-${lang}-1440.png` });
    await page.keyboard.press("Escape");
  });

  for (const width of [390, 320]) {
    test(`takes the screen on the phone (${lang}, ${width})`, async ({ page }) => {
      const text = copy[lang];
      const region = await open(page, lang, width);
      await region.screenshot({ path: `test-results/pickers-closed-${lang}-${width}.png` });

      await field(region, text.roles).click();
      const roles = page.getByRole("dialog", { name: text.roles });
      await expect(roles).toBeVisible();
      expect((await roles.boundingBox())!.width).toBeGreaterThanOrEqual(width - 1);
      await page.screenshot({ path: `test-results/pickers-phone-roles-${lang}-${width}.png` });
      await roles.getByRole("button", { name: text.close }).click();
      await expect(roles).toHaveCount(0);

      await field(region, text.place).click();
      const place = page.getByRole("dialog", { name: text.place });
      await expect(place.getByRole("combobox")).toBeFocused();
      await page.screenshot({ path: `test-results/pickers-phone-place-${lang}-${width}.png` });
      // No page scrolls sideways.
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }
}
