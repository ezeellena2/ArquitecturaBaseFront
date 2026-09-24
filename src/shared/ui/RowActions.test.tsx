import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RowActions, type RowAction } from "./RowActions";
import { ShieldIcon } from "./icons";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

function accion(overrides: Partial<RowAction> = {}): RowAction {
  return {
    label: "Roles",
    accessibleName: "Editar los roles de ana@ejemplo.com",
    icon: ShieldIcon,
    onSelect: vi.fn(),
    ...overrides,
  };
}

describe("RowActions", () => {
  it("names each action with the row's own datum", async () => {
    const onSelect = vi.fn();
    renderWithProviders(<RowActions actions={[accion({ onSelect })]} />);

    // Sin el dato de la fila, veinte filas dan veinte botones llamados igual: no hay forma de apretar el de
    // una persona en concreto, ni con el teclado ni en un test.
    await userEvent.click(screen.getByRole("button", { name: "Editar los roles de ana@ejemplo.com" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("hides the icon from the screen reader", () => {
    renderWithProviders(<RowActions actions={[accion()]} />);

    // El botón ya se anuncia con su nombre accesible; el ícono no se etiqueta a sí mismo.
    const boton = screen.getByRole("button", { name: "Editar los roles de ana@ejemplo.com" });
    expect(boton.querySelector("svg")?.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("carries the short label as a tooltip, also hidden from the screen reader", () => {
    renderWithProviders(<RowActions actions={[accion()]} />);

    const boton = screen.getByRole("button", { name: "Editar los roles de ana@ejemplo.com" });
    // El tooltip es para quien ve; para quien no ve, el nombre accesible ya lo dice, y más completo.
    expect(within(boton).getByText("Roles")).toHaveAttribute("aria-hidden", "true");
  });

  it("does not render an action without permission", () => {
    renderWithProviders(
      <RowActions
        actions={[
          accion(),
          accion({ label: "Eliminar", accessibleName: "Eliminar a ana@ejemplo.com", hidden: true }),
        ]}
      />,
    );

    // No se dibuja deshabilitada: un botón deshabilitado no recibe foco, así que con teclado no hay forma
    // de llegar a saber por qué está apagado.
    expect(screen.queryByRole("button", { name: "Eliminar a ana@ejemplo.com" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("puts the destructive action last, even when it comes first", () => {
    renderWithProviders(
      <RowActions
        actions={[
          accion({ label: "Eliminar", accessibleName: "Eliminar a ana@ejemplo.com", destructive: true }),
          accion(),
        ]}
      />,
    );

    // El orden lo garantiza el componente, no quien lo usa: es lo que hace que la memoria muscular sirva
    // en todas las pantallas.
    const nombres = screen.getAllByRole("button").map((boton) => boton.getAttribute("aria-label"));
    expect(nombres).toEqual(["Editar los roles de ana@ejemplo.com", "Eliminar a ana@ejemplo.com"]);
  });

  it("keeps the same button, and its focus, when the row's datum in its name changes", () => {
    const { rerender } = renderWithProviders(
      <RowActions actions={[accion({ label: "Editar", accessibleName: "Editar a +54 9 11 2345-6789" })]} />,
    );
    const boton = screen.getByRole("button", { name: "Editar a +54 9 11 2345-6789" });
    boton.focus();

    // Agregarle el correo a quien solo tenía número cambia el dato de la fila. Si el botón se tirara y se montara
    // otro, el foco que vuelve de un diálogo iría a parar a un nodo que ya no está: a <body>.
    rerender(<RowActions actions={[accion({ label: "Editar", accessibleName: "Editar a juan@example.com" })]} />);

    expect(screen.getByRole("button", { name: "Editar a juan@example.com" })).toBe(boton);
    expect(boton).toHaveFocus();
  });

  it("renders nothing when every action is hidden", () => {
    const { container } = renderWithProviders(<RowActions actions={[accion({ hidden: true })]} />);

    // Así la columna de acciones no deja un borde flotando en las filas donde no hay nada que hacer.
    expect(container.querySelector("button")).toBeNull();
  });
});
