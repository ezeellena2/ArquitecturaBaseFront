import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { PasteGrid } from "./PasteGrid";

// The consumer reads the paste: here each line is a row and each tab a cell, and the third cell is a column it does not take.
function Sheet({ onPaste = () => {}, disabled = false, initial = null }: { onPaste?: (text: string) => void; disabled?: boolean; initial?: string[][] | null }) {
  const [rows, setRows] = useState<string[][] | null>(initial);
  return <PasteGrid label="Grilla" disabled={disabled} rows={rows}
    columns={[{ key: "code", label: "Código", cell: 0 }, { key: "detail", label: "Detalle" }, { key: "text", label: "Texto", cell: 1 }, { key: "phone", label: "Teléfono", cell: 2, invalid: true }]}
    onPaste={text => { onPaste(text); setRows(text.split("\n").map(line => line.split("\t"))); }} />;
}
const cells = () => screen.getAllByRole("row").slice(1).map(row => within(row).getAllByRole("cell").map(cell => cell.textContent));

it("has the columns ready and takes the paste in the first cell of the empty grid, as text for its owner", async () => {
  const onPaste = vi.fn(), user = userEvent.setup();
  renderWithProviders(<Sheet onPaste={onPaste} />);
  expect(screen.getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Fila", "Código", "Detalle", "Texto", "Teléfono"]);
  expect(cells().map(row => row[0])).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
  const target = screen.getByRole("textbox", { name: "Pegar filas" });
  expect(target).toHaveAttribute("placeholder", "Pegá con Ctrl+V");
  await user.click(target);
  await user.paste("N\tNorte\t0342\nS\tSur");
  expect(onPaste).toHaveBeenCalledExactlyOnceWith("N\tNorte\t0342\nS\tSur");
  // Each column shows its cell of the row; one without a cell stays empty.
  expect(cells()).toEqual([["1", "N", "", "Norte", "0342"], ["2", "S", "", "Sur", ""]]);
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

it("moves the focus to the filled grid, where another paste replaces the rows", async () => {
  const onPaste = vi.fn(), user = userEvent.setup();
  renderWithProviders(<Sheet onPaste={onPaste} />);
  await user.click(screen.getByRole("textbox", { name: "Pegar filas" }));
  await user.paste("N\tNorte");
  expect(screen.getByRole("region", { name: "Grilla" })).toHaveFocus();
  await user.paste("C\tCentro");
  expect(onPaste).toHaveBeenLastCalledWith("C\tCentro");
  expect(cells()).toEqual([["1", "C", "", "Centro", ""]]);
});

it("draws the line between its columns as every table does and aligns a column of numbers to the right", () => {
  renderWithProviders(<PasteGrid label="Grilla" rows={[["N", "30"]]} columns={[{ key: "code", label: "Código", cell: 0 }, { key: "days", label: "Plazo", cell: 1, numeric: true }]} onPaste={() => {}} />);
  // The line is the common one of every table: no cell brings its own border.
  for (const cell of [...screen.getAllByRole("columnheader"), ...screen.getAllByRole("cell")]) expect(cell.className).not.toMatch(/\bborder-r\b/);
  expect(screen.getByRole("columnheader", { name: "Plazo" })).toHaveClass("text-right");
  expect(screen.getByRole("cell", { name: "30" })).toHaveClass("text-right");
  expect(screen.getByRole("cell", { name: "1" })).toHaveClass("text-right");
  expect(screen.getByRole("columnheader", { name: "Código" })).not.toHaveClass("text-right");
  expect(screen.getByRole("cell", { name: "N" })).not.toHaveClass("text-right");
});

it("shows the first 100 rows and says how many more there are", () => {
  renderWithProviders(<Sheet initial={Array.from({ length: 102 }, (_, index) => ["C" + index, "Opción " + index])} />);
  expect(screen.getAllByRole("row")).toHaveLength(1 + 100 + 1);
  expect(screen.getByText("Y 2 filas más")).toBeInTheDocument();
});

it("does not take a paste while its owner works", async () => {
  const onPaste = vi.fn(), user = userEvent.setup();
  const { unmount } = renderWithProviders(<Sheet onPaste={onPaste} disabled />);
  expect(screen.getByRole("textbox", { name: "Pegar filas" })).toBeDisabled();
  unmount();
  renderWithProviders(<Sheet onPaste={onPaste} disabled initial={[["N", "Norte"]]} />);
  screen.getByRole("region", { name: "Grilla" }).focus();
  await user.paste("C\tCentro");
  expect(onPaste).not.toHaveBeenCalled();
  expect(cells()).toEqual([["1", "N", "", "Norte", ""]]);
});
