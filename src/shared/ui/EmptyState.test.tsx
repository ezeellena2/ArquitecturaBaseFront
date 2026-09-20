import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("shows the message and the action", () => {
    render(<EmptyState title="No hay usuarios" description="Probá con otra búsqueda." action={<button>Limpiar</button>} />);

    expect(screen.getByRole("heading", { name: "No hay usuarios" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Limpiar" })).toBeInTheDocument();
  });
});
