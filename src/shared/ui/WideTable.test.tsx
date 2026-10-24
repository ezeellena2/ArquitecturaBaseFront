import { act, fireEvent, screen, within } from "@testing-library/react";
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
it("announces more columns to the right until the region is scrolled to its end", async () => {
  const hint = "Hay más columnas a la derecha.";
  await act(async () => { renderWithProviders(<WideTable label="Opciones de catálogo" overflowHint={hint}><TableHeader><TableRow><WideTableHead pinned="start" scope="col">Texto</WideTableHead><WideTableHead scope="col">Plazo</WideTableHead></TableRow></TableHeader><TableBody><TableRow><WideTableCell pinned="start">Proveedor Norte</WideTableCell><WideTableCell>30</WideTableCell></TableRow></TableBody></WideTable>); });
  const region = screen.getByRole("region", { name: "Opciones de catálogo" });
  expect(screen.queryByText(hint)).not.toBeInTheDocument();
  let scrollLeft = 0;
  Object.defineProperties(region, { scrollWidth: { configurable: true, get: () => 900 }, clientWidth: { configurable: true, get: () => 400 }, scrollLeft: { configurable: true, get: () => scrollLeft } });
  fireEvent.scroll(region);
  expect(region).toHaveAccessibleDescription(hint);
  expect(screen.getByText(hint)).toBeInTheDocument();
  scrollLeft = 500; fireEvent.scroll(region);
  expect(region).toHaveAccessibleDescription("");
  scrollLeft = 200; fireEvent.scroll(region);
  expect(region).toHaveAccessibleDescription(hint);
});
