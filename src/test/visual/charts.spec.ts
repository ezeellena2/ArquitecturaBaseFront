import { expect, test } from "@playwright/test";
import { expectLastBarInPlot, expectNoSideScroll } from "./chartGeometry";
import { expectColumnLines, expectRightAligned } from "./tableColumns";

// DOC7-A in the UI catalog: the number with its change, the bars by period (four hundred days included) and the bars of a
// distribution, with their tables. Evidence es/en at 1440, 390 and 320 px, without golden: the captures go to test-results to
// compare them with the board.
for (const lang of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test(`chart pieces ${lang} at ${width}px`, async ({ page }) => {
    const es = lang === "es";
    await page.setViewportSize({ width, height: 2400 });
    await page.goto(`/src/test/visual/index.html?screen=/catalogo&scenario=charts&lang=${lang}`);
    const bars = page.getByRole("list", { name: es ? "Cuántas llegaron, por día" : "How many arrived, by day", exact: true });
    await expect(bars).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    // Thirty-one buckets on one baseline; the Sundays are short bars in the soft tone, never a hole.
    await expect(bars.getByRole("listitem")).toHaveCount(31);
    const quiet = bars.locator("[data-quiet]").first();
    expect((await quiet.boundingBox())!.height).toBeGreaterThan(0);
    // A cap shows only where its bar's slot fits it: on the wide card, the highest; never wider than the slot.
    const highest = bars.getByRole("listitem").nth(14);
    const cap = highest.locator("span", { hasText: /^10$/ });
    if (width === 1440) await expect(cap).toBeVisible();
    if (await cap.isVisible()) expect((await cap.boundingBox())!.width).toBeLessThanOrEqual((await highest.boundingBox())!.width + 1);
    // The axis names the first and the last day with their dates in numbers.
    await expect(page.getByText(es ? "01/10/2026" : "10/01/2026", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(es ? "31/10/2026" : "10/31/2026", { exact: true }).first()).toBeVisible();
    // Hovering a bar says its day and its value, inside the card.
    await highest.hover();
    const readout = highest.getByText(es ? "15/10/2026: 10" : "10/15/2026: 10", { exact: true }).last();
    await expect(readout).toBeVisible();
    const card = page.getByRole("region", { name: es ? "Cuántas llegaron, por día" : "How many arrived, by day", exact: true });
    const [readoutBox, cardBox] = [(await readout.boundingBox())!, (await card.boundingBox())!];
    expect(readoutBox.x).toBeGreaterThanOrEqual(cardBox.x);
    expect(readoutBox.x + readoutBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
    await card.screenshot({ path: `test-results/charts/bars-${lang}-${width}.png` });

    // Four hundred days in one card: the space between bars narrows, the last bar ends inside the plot and the last date sits
    // under it, at the plot's edge.
    const longName = es ? "Cuántas llegaron, por día · 400 días" : "How many arrived, by day · 400 days";
    const long = page.getByRole("list", { name: longName, exact: true });
    await expect(long.getByRole("listitem")).toHaveCount(400);
    await expectLastBarInPlot(long, es ? "31/10/2026" : "10/31/2026");
    await expectNoSideScroll(long);
    await page.getByRole("region", { name: longName, exact: true }).screenshot({ path: `test-results/charts/bars-400-${lang}-${width}.png` });

    // A distribution: the name, its bar and «38 · 31 %»; where the list is narrow, the bar goes under the name.
    const banks = page.getByRole("list", { name: es ? "Por banco o billetera de origen" : "By bank or wallet of origin", exact: true });
    const galicia = banks.getByRole("listitem").first();
    await expect(galicia).toHaveText(/^Banco Galicia38 · 31\s?%$/);
    const name = (await galicia.getByText("Banco Galicia", { exact: true }).boundingBox())!;
    const track = (await galicia.locator("[aria-hidden]").first().boundingBox())!;
    if (width === 1440) expect(track.x).toBeGreaterThan(name.x + name.width);
    else expect(track.y).toBeGreaterThan(name.y);

    // The tables: one datum per column, the numbers to the right, a line between columns.
    const weekly = page.getByRole("region", { name: es ? "Total de Monto (pesos), por semana · como tabla" : "Total of Amount (pesos), by week · as a table", exact: true });
    await expectColumnLines(weekly.locator("table"));
    await expectRightAligned(weekly.getByRole("columnheader", { name: es ? "Total de Monto (pesos)" : "Total of Amount (pesos)", exact: true }));
    await expectRightAligned(weekly.getByRole("cell", { name: es ? "4.400.000" : "4,400,000", exact: true }));
    // Nothing scrolls sideways: neither the cards nor the layout's scroll container (the document's width says nothing).
    await expectNoSideScroll(bars);
    await expectNoSideScroll(banks);

    await page.getByRole("region", { name: es ? "Números · StatCard" : "Numbers · StatCard", exact: true }).screenshot({ path: `test-results/charts/stats-${lang}-${width}.png` });
    await page.screenshot({ path: `test-results/charts/pieces-${lang}-${width}.png`, fullPage: true });
  });
}
