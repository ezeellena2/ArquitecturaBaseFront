import { within } from "@testing-library/react";
import { expect } from "vitest";

/// One piece of data per column (UD, 2026-11-09): the cell of a row under a header, found by the position of that header.
export function cellUnder(table: HTMLElement, row: HTMLElement, header: string): HTMLElement {
  const index = within(table).getAllByRole("columnheader").findIndex(cell => cell.textContent === header);
  expect(index, header).toBeGreaterThanOrEqual(0);
  return within(row).getAllByRole("cell")[index];
}
