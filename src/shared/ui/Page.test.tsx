import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Page } from "./Page";
import { UsersIcon } from "./icons";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

describe("Page", () => {
  it("names the screen with a single level-one heading", () => {
    renderWithProviders(
      <Page icon={UsersIcon} title="Usuarios">
        <p>contenido</p>
      </Page>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Usuarios" })).toBeInTheDocument();
    // Uno por ruta: si una pantalla agrega otro, el lector pierde el punto de referencia.
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("hides the section icon from the screen reader", () => {
    const { container } = renderWithProviders(
      <Page icon={UsersIcon} title="Usuarios">
        <p>contenido</p>
      </Page>,
    );

    // Es identidad visual, no información: el título ya dice dónde estás.
    expect(container.querySelector("svg")?.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("renders the primary action", () => {
    renderWithProviders(
      <Page icon={UsersIcon} title="Usuarios" actions={<button type="button">Nuevo usuario</button>}>
        <p>contenido</p>
      </Page>,
    );

    expect(screen.getByRole("button", { name: "Nuevo usuario" })).toBeInTheDocument();
  });

  it("puts the content inside its own padded area, outside the band", () => {
    renderWithProviders(
      <Page icon={UsersIcon} title="Usuarios">
        <p>contenido</p>
      </Page>,
    );

    // La banda llega a los bordes y el contenido no: por eso el padding lo pone este componente y no cada
    // pantalla. Un padding que hay que acordarse de poner es un criterio que se pierde.
    const contenido = screen.getByText("contenido");
    const banda = screen.getByRole("heading", { level: 1 }).closest("header");

    expect(banda).not.toBeNull();
    expect(banda?.contains(contenido)).toBe(false);
  });
});
