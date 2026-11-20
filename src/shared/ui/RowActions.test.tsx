import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter, useLocation } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { RowActions, type RowAction } from "./RowActions";
import { PlusIcon, ShieldIcon } from "./icons";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

function accion(overrides: Partial<Extract<RowAction, { to?: undefined }>> = {}): RowAction {
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

  it("shows the action tooltip outside the clipped group and dismisses it with Escape", async () => {
    renderWithProviders(<RowActions actions={[accion()]} />);

    const boton = screen.getByRole("button", { name: "Editar los roles de ana@ejemplo.com" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await userEvent.hover(boton);
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Roles");
    expect(boton.closest("span")?.contains(tooltip)).toBe(false);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows the action tooltip on keyboard focus without triggering the action", async () => {
    const onSelect = vi.fn();
    renderWithProviders(<RowActions actions={[accion({ onSelect })]} />);
    await userEvent.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Roles");
    expect(onSelect).not.toHaveBeenCalled();
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

  it("goes to another place with a real link, its state and what it remembers before leaving", async () => {
    const onSelect = vi.fn();
    function Destino() {
      const { state } = useLocation();
      return <p>{(state as { seed: string } | null)?.seed}</p>;
    }
    const router = createMemoryRouter([
      { path: "/", element: <RowActions actions={[{ label: "Crear formulario", accessibleName: "Crear formulario Reclamos de clientes", icon: PlusIcon, to: "/formularios/nuevo", state: { seed: "Reclamos de clientes" }, onSelect }]} /> },
      { path: "/formularios/nuevo", element: <Destino /> },
    ]);
    renderWithProviders(<RouterProvider router={router} />);

    // Ir a otro lado es un enlace de verdad: se abre en otra pestaña con Ctrl o con la rueda, y el lector lo anuncia
    // como enlace. Lleva el mismo dibujo, el mismo tooltip y el mismo lugar en el grupo que un botón.
    const enlace = screen.getByRole("link", { name: "Crear formulario Reclamos de clientes" });
    expect(enlace).toHaveAttribute("href", "/formularios/nuevo");
    await userEvent.hover(enlace);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Crear formulario");
    await userEvent.click(enlace);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(router.state.location.pathname).toBe("/formularios/nuevo");
    expect(await screen.findByText("Reclamos de clientes")).toBeInTheDocument();
  });

  it("keeps an action in sight but off while another one works", async () => {
    const onSelect = vi.fn();
    renderWithProviders(<RowActions actions={[accion({ onSelect, disabled: true })]} />);

    // Lo que ya se está guardando en otra fila apaga ésta un momento; no la esconde, porque vuelve enseguida.
    const boton = screen.getByRole("button", { name: "Editar los roles de ana@ejemplo.com" });
    expect(boton).toBeDisabled();
    await userEvent.click(boton);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("swaps its drawing for the ring while its own action works", () => {
    renderWithProviders(<RowActions actions={[accion({ pending: true }), accion({ label: "Eliminar", accessibleName: "Eliminar a ana@ejemplo.com" })]} />);

    // LC1-A: un ícono de fila cambia su dibujo por el aro, en el mismo lugar y sin otro clic; el resto del grupo sigue igual.
    const boton = screen.getByRole("button", { name: "Editar los roles de ana@ejemplo.com" });
    expect(boton).toHaveAttribute("aria-busy", "true");
    expect(boton).toBeDisabled();
    expect(boton.querySelector("svg")).toBeNull();
    expect(boton.querySelector("[data-slot='button-spinner']")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Eliminar a ana@ejemplo.com" }).querySelector("svg")).not.toBeNull();
  });
});
