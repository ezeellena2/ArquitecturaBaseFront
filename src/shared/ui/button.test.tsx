import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";
import { IconButton } from "./IconButton";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

describe("a button whose action is working", () => {
  it("shows the spinner with what it is doing and takes no second click", async () => {
    const onClick = vi.fn();
    render(<Button pending onClick={onClick}>Guardando…</Button>);
    const button = screen.getByRole("button", { name: "Guardando…" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
    expect(button.querySelector('[data-slot="button-spinner"]')).not.toBeNull();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("has no spinner while it waits for a click", () => {
    render(<Button>Guardar</Button>);
    const button = screen.getByRole("button", { name: "Guardar" });
    expect(button).not.toHaveAttribute("aria-busy");
    expect(button.querySelector('[data-slot="button-spinner"]')).toBeNull();
  });

  it("keeps lending its look to a single child, such as a link", () => {
    render(<Button asChild><a href="/formularios/nuevo">Nuevo formulario</a></Button>);
    expect(screen.getByRole("link", { name: "Nuevo formulario" })).toHaveAttribute("data-slot", "button");
  });

  it("changes the drawing of an icon button for the spinner and keeps its name", () => {
    renderWithProviders(<IconButton label="Descargando el PDF" pending><span data-testid="drawing" aria-hidden="true">↓</span></IconButton>);
    const button = screen.getByRole("button", { name: "Descargando el PDF" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector('[data-slot="button-spinner"]')).not.toBeNull();
    expect(screen.queryByTestId("drawing")).toBeNull();
  });
});
