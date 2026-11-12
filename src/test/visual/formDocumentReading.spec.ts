import { expect, test, type Page } from "@playwright/test";
import { fixtureFormId } from "./formFixtures";

// DOC1, evidence without goldens: «Lectura de documentos» in the editor of «Pagos de clientes», a copy of «Comprobante de transferencia»,
// and «Biblioteca» with what each standard reads and the standards of the next stages, es/en at 1440, 390 and 320 px. Each capture is
// compared with the board and the differences written in docs/design/documentos.md.
type Language = "es" | "en";
const text = (language: Language, es: string, en: string) => language === "es" ? es : en;
async function open(page: Page, language: Language, width: number, screen: string, scenario: string) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen, scenario, lang: language }));
}
async function closeMenu(page: Page, language: Language, width: number) {
  if (width >= 768) return;
  const menu = page.getByRole("button", { name: text(language, "Menú de navegación", "Navigation menu"), exact: true });
  if (await menu.getAttribute("aria-expanded") === "true") await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
}
const noPageScroll = async (page: Page, width: number) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);

for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test("DOC1 the reading of documents in the editor " + language + " " + width, async ({ page }) => {
    await open(page, language, width, "/formularios/" + fixtureFormId, "forms-library-reading");
    await expect(page.getByRole("heading", { name: text(language, "Pagos de clientes", "Customer payments"), exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await closeMenu(page, language, width);
    const title = text(language, "Lectura de documentos", "Document reading");
    const zone = page.getByRole("region", { name: title, exact: true });
    // Folded, after «Preguntas», it says what is configured.
    await expect(zone).toContainText(text(language, "Prendida · 1 cruce con catálogos", "On · 1 catalog lookup"));
    await zone.scrollIntoViewIfNeeded();
    await zone.screenshot({ path: "test-results/visual/document-reading-folded-" + language + "-" + width + ".png" });
    await page.getByRole("button", { name: text(language, "Expandir «Lectura de documentos»", "Expand “Document reading”"), exact: true }).click();
    await expect(zone.getByText(text(language, "Documentos confirmados", "Documents confirmed"), { exact: true })).toBeVisible();
    // Each datum with the question that receives it: a table from 640 px, one block per datum on the phone, as the board.
    const data = text(language, "Datos del estándar", "The standard's data");
    if (width >= 640) await expect(zone.getByRole("table", { name: data, exact: true })).toContainText(text(language, "Quién transfirió", "Who transferred"));
    else await expect(zone.getByRole("list", { name: data, exact: true }).getByRole("listitem")).toHaveCount(14);
    // The lookup: in a table from 640 px, in its box on the phone, where what is touched is 44 px tall.
    if (width >= 640) await expect(zone.getByRole("combobox", { name: text(language, "Cruce 1 · Se busca por", "Lookup 1 · Matched by"), exact: true })).toHaveValue(/.+/);
    else {
      await expect(zone.getByRole("heading", { name: text(language, "Cruce 1", "Lookup 1"), exact: true })).toBeVisible();
      const targets = [zone.getByRole("button", { name: text(language, "Agregar cruce", "Add lookup"), exact: true }), zone.getByRole("button", { name: text(language, "Quitar el cruce 1", "Remove lookup 1"), exact: true }),
        zone.getByRole("button", { name: text(language, "Ver los ejemplos (3)", "See the examples (3)"), exact: true }), ...await zone.getByRole("combobox").all()];
      for (const target of targets) expect((await target.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    await noPageScroll(page, width);
    await page.screenshot({ path: "test-results/visual/document-reading-page-" + language + "-" + width + ".png", fullPage: true });
    // The page scrolls inside its frame: a window as tall as the zone shows it whole in one capture.
    await page.setViewportSize({ width, height: width >= 640 ? 2400 : 4200 });
    await zone.scrollIntoViewIfNeeded();
    await noPageScroll(page, width);
    await zone.screenshot({ path: "test-results/visual/document-reading-" + language + "-" + width + ".png" });
    await page.setViewportSize({ width, height: 900 });

    // «Ver los ejemplos»: the latest corrections side by side.
    await zone.getByRole("button", { name: text(language, "Ver los ejemplos (3)", "See the examples (3)"), exact: true }).click();
    const dialog = page.getByRole("dialog", { name: text(language, "Últimas correcciones", "Latest corrections"), exact: true });
    await expect(dialog.getByText("0012345679", { exact: true })).toBeVisible();
    await noPageScroll(page, width);
    await page.screenshot({ path: "test-results/visual/document-reading-examples-" + language + "-" + width + ".png" });
  });

  test("DOC1 the library with what it reads and what is coming " + language + " " + width, async ({ page }) => {
    await open(page, language, width, "/formularios/biblioteca", "forms-library-documents");
    await expect(page.getByRole("heading", { name: text(language, "Biblioteca", "Library"), exact: true })).toBeVisible();
    await expect(page.getByText(text(language, "Comprobante de transferencia", "Transfer receipt"), { exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await closeMenu(page, language, width);
    const segments = page.getByRole("group", { name: text(language, "Estado", "Status"), exact: true });
    await expect(segments.getByRole("button")).toHaveText(text(language, "Todos (13)|Disponibles (2)|Próximamente (11)", "All (13)|Available (2)|Coming soon (11)").split("|"));
    if (width >= 640) for (const header of text(language, "Qué lee|Validaciones fijas|Versión|En tus formularios|Estado", "What it reads|Fixed validations|Version|In your forms|Status").split("|"))
      await expect(page.getByRole("columnheader", { name: header, exact: true })).toBeVisible();
    else await expect(page.getByText(text(language, "Versión 1 · En 2 de tus formularios", "Version 1 · In 2 of your forms"), { exact: true })).toBeVisible();
    await noPageScroll(page, width);
    await page.screenshot({ path: "test-results/visual/document-library-" + language + "-" + width + ".png", fullPage: true });

    // «Próximamente»: rows without an action and without columns of «—»; the filter goes in the address.
    await segments.getByRole("button", { name: text(language, "Próximamente (11)", "Coming soon (11)"), exact: true }).click();
    await expect(page.getByText(text(language, "Nota de crédito o débito", "Credit or debit note"), { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: language === "es" ? /^Agregar «/ : /^Add “/ })).toHaveCount(0);
    if (width >= 640) await expect(page.getByRole("columnheader")).toHaveText([text(language, "Estándar", "Standard")]);
    await expect.poll(() => page.evaluate(() => (window as unknown as { visualRouterLocation?: { search: string } }).visualRouterLocation?.search)).toBe("?availability=Upcoming");
    await noPageScroll(page, width);
    // Right after the click the segments still change colour: the capture ends their transition.
    await page.screenshot({ path: "test-results/visual/document-library-upcoming-" + language + "-" + width + ".png", fullPage: true, animations: "disabled" });
  });
}
