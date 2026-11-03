import { expect, type Locator } from "@playwright/test";

// The A of 2026-11-02, in the browser: every table draws a thin line between its columns and aligns its numbers to the
// right. Each line is an inset shadow of one of the two cells beside it, so a pinned cell carries its own as it scrolls.

/** By row, how many lines each boundary between two columns has: the left cell's right side plus the right cell's left side. */
export function columnBoundaries(table: Locator) {
  return table.evaluate(node => Array.from(node.querySelectorAll("tr"), row => {
    const sides = Array.from(row.children, cell => {
      const offsets = Array.from(getComputedStyle(cell).boxShadow.matchAll(/(-?[\d.]+)px 0px 0px 0px inset/g), match => Number(match[1]));
      return { start: offsets.some(offset => offset > 0), end: offsets.some(offset => offset < 0) };
    });
    return sides.slice(1).map((cell, index) => Number(sides[index]!.end) + Number(cell.start));
  }));
}

/** Every boundary between two columns, in the header and in the body, has exactly one line. */
export async function expectColumnLines(table: Locator) {
  const boundaries = (await columnBoundaries(table)).flat();
  expect(boundaries.length).toBeGreaterThan(0);
  expect(boundaries.every(lines => lines === 1)).toBe(true);
}

/** The cell aligns to the right and its text ends at its right edge, even inside a narrower block. */
export async function expectRightAligned(cell: Locator) {
  const geometry = await cell.evaluate(node => {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let text = -Infinity;
    for (let current = walker.nextNode(); current; current = walker.nextNode()) {
      if (!current.textContent?.trim()) continue;
      const range = document.createRange(); range.selectNodeContents(current);
      for (const rect of range.getClientRects()) text = Math.max(text, rect.right);
    }
    const style = getComputedStyle(node);
    return { align: style.textAlign, text, edge: node.getBoundingClientRect().right - parseFloat(style.paddingRight) };
  });
  expect(geometry.align).toBe("right");
  expect(Math.abs(geometry.edge - geometry.text)).toBeLessThanOrEqual(1.5);
}

/** Scrolled to the end, a cell pinned at the start stays at the region's left edge with its line at its right side. */
export async function expectPinnedLineWhileScrolled(region: Locator, pinned: Locator) {
  await region.evaluate(node => { node.scrollLeft = node.scrollWidth; });
  expect(await region.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
  const [cell, area] = [(await pinned.boundingBox())!, (await region.boundingBox())!];
  expect(Math.abs(cell.x - area.x)).toBeLessThanOrEqual(1.5);
  expect(await pinned.evaluate(node => /-1px 0px 0px 0px inset/.test(getComputedStyle(node).boxShadow))).toBe(true);
  await region.evaluate(node => { node.scrollLeft = 0; });
}
