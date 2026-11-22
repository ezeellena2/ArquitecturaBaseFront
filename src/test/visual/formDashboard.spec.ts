import { expect, test, type Page } from "@playwright/test";
import { responseFormId } from "../responseFixtures";
import { expectLastBarInPlot, expectNoSideScroll } from "./chartGeometry";

// DOC7-A with the real route: «Respuestas (N) · Tablero» on the page of «Pagos de clientes», the bar and the skeleton in place
// while the dashboard's chunk arrives, the numbers against September once «Recibida» holds October, a card per chart, a card's
// ⋮, «Ver como tabla», the period and, on the phone, the cards one under the other and the filters behind «Filtros». Evidence
// es/en at 1440, 390 and 320 px, without golden; double in dashboardVisualFixtures.
const screen = encodeURIComponent(`/formularios/${responseFormId}/respuestas?view=dashboard`);

/** «Recibida» from October 1st to 31st, the filter of the sheet that the dashboard shares, from «Filtros». */
async function receivedInOctober(page: Page, es: boolean, phone: boolean) {
  await page.getByRole("button", { name: es ? "Filtros" : "Filters", exact: true }).click();
  const filters = page.getByRole("dialog", { name: es ? "Filtros" : "Filters" });
  await expect(filters).toBeVisible();
  if (phone) await filters.getByRole("button", { name: es ? "Recibida" : "Received", exact: true }).click();
  await filters.getByLabel(es ? "Recibida desde" : "Received from", { exact: true }).fill("2026-10-01");
  await filters.getByLabel(es ? "Recibida hasta" : "Received until", { exact: true }).fill("2026-10-31");
  if (phone) await filters.getByRole("button", { name: es ? "Listo" : "Done", exact: true }).click();
  else await page.keyboard.press("Escape");
  await expect(filters).toBeHidden();
}

for (const lang of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test(`form dashboard ${lang} at ${width}px`, async ({ page }) => {
    const es = lang === "es";
    const phone = width < 640;
    // Tall enough for the whole dashboard: the content scrolls inside the layout, not the document.
    await page.setViewportSize({ width, height: phone ? 3600 : 2600 });
    // The first open: the dashboard's chunk waits until the bar and the skeleton are measured.
    let release!: () => void;
    const chunk = new Promise<void>(resolve => { release = resolve; });
    await page.route(/\/FormDashboard-[\w-]+\.js$/, async route => { await chunk; await route.continue(); });
    await page.goto(`/src/test/visual/index.html?screen=${screen}&scenario=responses-dashboard&lang=${lang}`);
    await expect(page.getByRole("tab", { name: es ? "Tablero" : "Dashboard", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: es ? "Respuestas (123)" : "Responses (123)", exact: true })).toBeVisible();
    const tab = page.getByRole("tabpanel", { name: es ? "Tablero" : "Dashboard", exact: true });
    const filtersButton = tab.getByRole("button", { name: es ? "Filtros" : "Filters", exact: true });
    const waiting = tab.getByRole("status", { name: es ? "Cargando…" : "Loading…", exact: true });
    await expect(waiting).toBeVisible();
    await expect(filtersButton).toBeVisible();
    await expect(tab.getByRole("button", { name: es ? "Agregar gráfico" : "Add chart", exact: true })).toBeDisabled();
    const [barBefore, waitingBox] = [(await filtersButton.boundingBox())!, (await waiting.boundingBox())!];
    release();
    await expect(page.getByRole("heading", { name: es ? "Cuántas llegaron, por día" : "How many arrived, by day", exact: true })).toBeVisible();
    // Nothing jumps when the dashboard lands: the bar stays and the numbers take the skeleton's place.
    const [barAfter, numbersBox] = [(await filtersButton.boundingBox())!, (await tab.getByRole("region", { name: es ? "Números" : "Numbers", exact: true }).boundingBox())!];
    expect(Math.abs(barAfter.y - barBefore.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(numbersBox.y - waitingBox.y)).toBeLessThanOrEqual(1);
    await page.evaluate(() => document.fonts.ready);

    // On the phone the quick filters go behind «Filtros»; on a computer they stay in sight, as in «Respuestas».
    // «Canal» is the button of the bar of the only piece to choose (DS1-A).
    await expect(page.getByRole("button", { name: es ? "Canal Todos los canales" : "Channel All channels", exact: true })).toHaveCount(phone ? 0 : 1);
    await receivedInOctober(page, es, phone);
    const numbers = page.getByRole("region", { name: es ? "Números" : "Numbers", exact: true });
    await expect(numbers.getByText(es ? /^\+18\s?% que 01\/09\/2026 – 30\/09\/2026$/ : /^\+18% vs 09\/01\/2026 – 09\/30\/2026$/)).toBeVisible();
    // An amount carries the name of its currency, without a symbol, and the currencies never add up.
    await expect(numbers.getByText(es ? "Total de Monto (pesos)" : "Total of Amount (pesos)", { exact: true })).toBeVisible();
    await expect(numbers.getByText(es ? "Total de Monto (dólares)" : "Total of Amount (dollars)", { exact: true })).toBeVisible();
    // The bars of October fit their card, and nothing scrolls sideways, the layout's scroll container included.
    const received = page.getByRole("list", { name: es ? "Cuántas llegaron, por día" : "How many arrived, by day", exact: true });
    await expectLastBarInPlot(received, es ? "31/10/2026" : "10/31/2026");
    await expectNoSideScroll(numbers);
    await expectNoSideScroll(received);

    // The cards, one under the other on the phone.
    const charts = page.getByRole("region", { name: es ? "Gráficos" : "Charts", exact: true });
    const banks = charts.getByRole("region", { name: es ? "Por Banco o billetera de origen (catálogo Bancos y billeteras)" : "By Bank or wallet of origin (Banks and wallets catalog)", exact: true });
    const people = charts.getByRole("region", { name: es ? "Quién cargó" : "Who submitted", exact: true });
    const [banksBox, peopleBox] = [(await banks.boundingBox())!, (await people.boundingBox())!];
    if (phone) expect(Math.abs(banksBox.x - peopleBox.x)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `test-results/dashboard/form-dashboard-${lang}-${width}.png`, fullPage: true });

    // A card's ⋮: «Contar», «Ver como tabla» and «Quitar del tablero»; the table shows the same numbers, one datum per column.
    await banks.getByRole("button", { name: es ? "Acciones de «Por Banco o billetera de origen (catálogo Bancos y billeteras)»" : "Actions for “By Bank or wallet of origin (Banks and wallets catalog)”", exact: true }).click();
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("group", { name: es ? "Contar" : "Count", exact: true })).toBeVisible();
    await page.screenshot({ path: `test-results/dashboard/form-dashboard-menu-${lang}-${width}.png` });
    await menu.getByRole("menuitem", { name: es ? "Ver como tabla" : "See as table", exact: true }).click();
    await expect(banks.getByRole("table")).toBeVisible();
    await expect(banks.getByRole("columnheader")).toHaveText(es ? ["Opción", "Cantidad", "%"] : ["Option", "Count", "%"]);
    await banks.screenshot({ path: `test-results/dashboard/form-dashboard-table-${lang}-${width}.png` });

    // One period for the whole dashboard.
    await page.getByRole("button", { name: es ? "Período Día" : "Period Day", exact: true }).click();
    await page.getByRole("listbox", { name: es ? "Período" : "Period", exact: true }).getByRole("option", { name: es ? "Semana" : "Week", exact: true }).click();
    await expect(page.getByRole("heading", { name: es ? "Cuántas llegaron, por semana" : "How many arrived, by week", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: es ? "Por semana de Fecha de la transferencia" : "By week of Transfer date", exact: true })).toBeVisible();
    const weekly = page.getByRole("list", { name: es ? "Cuántas llegaron, por semana" : "How many arrived, by week", exact: true });
    await expectLastBarInPlot(weekly, es ? "26/10/2026" : "10/26/2026");
    await expectNoSideScroll(weekly);
    await expectNoSideScroll(banks);
    await page.screenshot({ path: `test-results/dashboard/form-dashboard-week-${lang}-${width}.png`, fullPage: true });
  });
}
