import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { TableBody, TableHeader, TableRow } from "./table";
import { WideTable, WideTableCell, WideTableHead } from "./WideTable";
import { Button } from "./button";

it("keeps table semantics inside a named keyboard scroll region and preserves interactive cells", async () => {
  const edit = vi.fn();
  await act(async () => { renderWithProviders(<WideTable label="Opciones de catálogo"><TableHeader><TableRow><WideTableHead pinned="start" scope="col">Texto</WideTableHead><WideTableHead scope="col">Detalle</WideTableHead><WideTableHead pinned="end" scope="col">Acciones</WideTableHead></TableRow></TableHeader><TableBody><TableRow><WideTableCell pinned="start">Proveedor Norte</WideTableCell><WideTableCell>Detalle</WideTableCell><WideTableCell pinned="end"><Button onClick={edit}>Editar</Button></WideTableCell></TableRow></TableBody></WideTable>); });
  const region = screen.getByRole("region", { name: "Opciones de catálogo" });
  expect(within(region).getByRole("table")).toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: "Texto" })).toHaveAttribute("scope", "col");
  region.focus();
  expect(region).toHaveFocus();
  await userEvent.tab();
  expect(screen.getByRole("button", { name: "Editar" })).toHaveFocus();
  await userEvent.keyboard("{Enter}");
  expect(edit).toHaveBeenCalledTimes(1);
});

it("marks the pinned cells, which carry the line between columns as the table scrolls", async () => {
  await act(async () => { renderWithProviders(<WideTable label="Planilla"><TableHeader><TableRow><WideTableHead pinned="start" scope="col">Texto</WideTableHead><WideTableHead scope="col">Detalle</WideTableHead><WideTableHead pinned="end" scope="col">Acciones</WideTableHead></TableRow></TableHeader><TableBody><TableRow><WideTableCell pinned="start">Proveedor Norte</WideTableCell><WideTableCell>Zona norte</WideTableCell><WideTableCell pinned="end">—</WideTableCell></TableRow></TableBody></WideTable>); });
  // A pinned cell draws the line on its inner side itself: a common border stays behind when the table scrolls.
  expect(screen.getByRole("columnheader", { name: "Texto" })).toHaveAttribute("data-pinned", "start");
  expect(screen.getByRole("cell", { name: "Proveedor Norte" })).toHaveAttribute("data-pinned", "start");
  expect(screen.getByRole("columnheader", { name: "Acciones" })).toHaveAttribute("data-pinned", "end");
  expect(screen.getByRole("cell", { name: "Zona norte" })).not.toHaveAttribute("data-pinned");
});

it("aligns a column of numbers to the right, header included", async () => {
  await act(async () => { renderWithProviders(<WideTable label="Lotes"><TableHeader><TableRow><WideTableHead scope="col">Lote</WideTableHead><WideTableHead numeric scope="col">Hectáreas</WideTableHead></TableRow></TableHeader><TableBody><TableRow><WideTableCell>Lote 4</WideTableCell><WideTableCell numeric>12,5</WideTableCell></TableRow></TableBody></WideTable>); });
  expect(screen.getByRole("columnheader", { name: "Hectáreas" })).toHaveClass("text-right");
  expect(screen.getByRole("cell", { name: "12,5" })).toHaveClass("text-right");
  expect(screen.getByRole("columnheader", { name: "Lote" })).not.toHaveClass("text-right");
  expect(screen.getByRole("cell", { name: "Lote 4" })).not.toHaveClass("text-right");
});
