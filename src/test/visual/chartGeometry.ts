import { expect, type Locator } from "@playwright/test";

// DOC7-A in the browser: a chart fits its card with any number of buckets, and nothing scrolls sideways. The content scrolls
// inside the layout (`main` and the page's own box), not the document, so the document's width says nothing: what counts is
// every box around the chart that scrolls or cuts, up to the document.

/** How far the widest box around an element that scrolls or cuts (or the document) runs past its own width, in pixels. */
export function sideOverflow(element: Locator) {
  return element.evaluate(node => {
    let overflow = 0;
    for (let current = node.parentElement; current; current = current.parentElement) {
      if (getComputedStyle(current).overflowX !== "visible") overflow = Math.max(overflow, current.scrollWidth - current.clientWidth);
    }
    const root = document.scrollingElement ?? document.documentElement;
    return Math.max(overflow, root.scrollWidth - root.clientWidth);
  });
}

/** Nothing around the element scrolls sideways (a pixel of rounding aside). */
export async function expectNoSideScroll(element: Locator) {
  expect(await sideOverflow(element)).toBeLessThanOrEqual(1);
}

/**
 * The bars of a `BarChart` fit its plot: the plot does not run past its width, the last bar ends inside it and the last date
 * of the axis sits under that bar, at the plot's right edge.
 */
export async function expectLastBarInPlot(plot: Locator, lastDate: string) {
  // The bar of the last bucket: the soft one of a bucket without responses, or the one with its height.
  const lastBar = plot.getByRole("listitem").last().locator('[aria-hidden]:is([data-quiet], [style*="height"])');
  const lastTick = plot.locator("xpath=following-sibling::div[1]").locator("span").last();
  await expect(lastTick).toHaveText(lastDate);
  expect(await plot.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(0);
  const [plotBox, barBox, tickBox] = [(await plot.boundingBox())!, (await lastBar.boundingBox())!, (await lastTick.boundingBox())!];
  const plotEnd = plotBox.x + plotBox.width;
  expect(barBox.x).toBeGreaterThanOrEqual(plotBox.x);
  expect(barBox.x + barBox.width).toBeLessThanOrEqual(plotEnd + 0.5);
  expect(tickBox.x).toBeLessThanOrEqual(barBox.x + 0.5);
  expect(tickBox.x + tickBox.width).toBeGreaterThanOrEqual(barBox.x + barBox.width - 0.5);
  expect(tickBox.x + tickBox.width).toBeLessThanOrEqual(plotEnd + 0.5);
}
