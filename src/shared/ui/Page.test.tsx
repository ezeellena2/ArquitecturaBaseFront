import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
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

  // Una pantalla hija (el rol en /roles/{id}) cambia el ícono por un enlace de volver. Un `Link` necesita un
  // router alrededor; alcanza con uno de memoria, como en UserMenu.test.tsx.
  describe("in a child screen", () => {
    it("draws a link back to its parent instead of the section icon", () => {
      const { container } = renderWithProviders(
        <MemoryRouter>
          <Page
            icon={UsersIcon}
            title="Editar el rol Soporte"
            backTo={{ to: "/roles", label: "Volver a Roles y permisos" }}
          >
            <p>contenido</p>
          </Page>
        </MemoryRouter>,
      );

      const volver = screen.getByRole("link", { name: "Volver a Roles y permisos" });
      const banda = screen.getByRole("heading", { level: 1 }).closest("header");

      expect(volver).toHaveAttribute("href", "/roles");
      expect(banda).toContainElement(volver);
      // En lugar del ícono, no además: dos marcas al lado del título compiten por el mismo lugar.
      expect(container.querySelectorAll("header svg")).toHaveLength(1);
      expect(volver.querySelector("svg")).not.toBeNull();
    });

    it("puts the status next to the title without renaming the heading", () => {
      renderWithProviders(
        <MemoryRouter>
          <Page
            title="Editar el rol Soporte"
            backTo={{ to: "/roles", label: "Volver a Roles y permisos" }}
            status={<span>· Cambios sin guardar</span>}
          >
            <p>contenido</p>
          </Page>
        </MemoryRouter>,
      );

      const titulo = screen.getByRole("heading", { level: 1, name: "Editar el rol Soporte" });
      const estado = screen.getByText("· Cambios sin guardar");

      // Al lado, no adentro: si fuera parte del h1, el nombre de la pantalla cambiaría con cada tecla.
      expect(titulo).not.toContainElement(estado);
      expect(titulo.parentElement).toContainElement(estado);
    });
  });

  it("keeps the section icon and has no way back when the screen is not a child", () => {
    const { container } = renderWithProviders(
      <MemoryRouter>
        <Page icon={UsersIcon} title="Usuarios">
          <p>contenido</p>
        </Page>
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(container.querySelector("header [aria-hidden='true'] svg")).not.toBeNull();
  });
});
