import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { ForbiddenPage } from "./ForbiddenPage";

// SP1-B (2026-11-24): the screen keeps its name in the band and the standard empty state says there is no permission.
describe("ForbiddenPage", () => {
  it("names the screen in its band and says there is no permission, with the way back home", () => {
    render(<MemoryRouter initialEntries={["/configuracion/negocio"]}><ForbiddenPage title="Información del negocio" /></MemoryRouter>);

    expect(screen.getByRole("heading", { level: 1, name: "Información del negocio" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "No tenés permiso" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver al inicio" })).toHaveAttribute("href", "/");
    expect(screen.queryByText(/permiso necesario/)).not.toBeInTheDocument();
  });

  it("offers no way back on home itself", () => {
    render(<MemoryRouter initialEntries={["/"]}><ForbiddenPage title="Inicio" /></MemoryRouter>);

    expect(screen.getByRole("heading", { level: 3, name: "No tenés permiso" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
