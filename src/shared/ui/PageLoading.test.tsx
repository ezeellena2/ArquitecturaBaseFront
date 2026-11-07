import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageLoading } from "./PageLoading";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

describe("PageLoading", () => {
  it("keeps the header band of a screen while it loads (ES2)", () => {
    const { container } = renderWithProviders(<PageLoading />);

    // La banda ya está: el título es un bloque de carga y no un texto, pero la pantalla conserva un único h1 para el lector.
    expect(container.querySelector("header")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Cargando…" })).toBeInTheDocument();
  });

  it("announces a single loading status", () => {
    renderWithProviders(<PageLoading />);

    expect(screen.getAllByRole("status")).toHaveLength(1);
  });
});
