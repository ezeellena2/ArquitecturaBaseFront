import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { newCatalogField } from "../catalogFields";
import { CatalogExtraFieldInput } from "./CatalogExtraFieldInput";

it("keeps an unsaved field unavailable and explains why", async () => {
  await act(async () => { renderWithProviders(<CatalogExtraFieldInput field={newCatalogField("new", 1)} label="CUIT" value={null} culture="es" readOnly={false} onChange={vi.fn()} />); });
  expect(screen.getByRole("textbox", { name: "CUIT" })).toBeDisabled();
  expect(screen.getByText("Guardá para cargar valores")).toBeInTheDocument();
});
it("preserves invalid typed input and reports an error on that cell without numeric coercion", async () => {
  const change = vi.fn();
  await act(async () => { renderWithProviders(<CatalogExtraFieldInput field={{ ...newCatalogField("saved", 1), id: "01990000-0000-7000-8000-000000000001", type: "integer" }} label="Fila 1 · Plazo" value="30 días" culture="es" error="No es un número entero." readOnly={false} onChange={change} />); });
  const input = screen.getByRole("textbox", { name: "Fila 1 · Plazo" });
  expect(input).toHaveValue("30 días");
  expect(input).toHaveAttribute("aria-invalid", "true");
  await userEvent.type(input, "x");
  expect(change).toHaveBeenLastCalledWith("30 díasx");
});
it("can clear an optional boolean without turning the empty value into false", async () => {
  const change = vi.fn();
  await act(async () => { renderWithProviders(<CatalogExtraFieldInput field={{ ...newCatalogField("saved", 1), id: "01990000-0000-7000-8000-000000000001", type: "boolean" }} label="Confirmado" value="false" culture="es" readOnly={false} onChange={change} />); });
  await userEvent.click(screen.getByRole("button", { name: "Limpiar Confirmado" }));
  expect(change).toHaveBeenCalledWith(null);
});
