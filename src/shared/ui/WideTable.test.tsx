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
