import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// MA1-A (2026-11-09): a button or a box off with its reason keeps aria-disabled instead of disabled. jest-dom reads only
// disabled, so toBeEnabled() would pass on it and a waitFor(toBeEnabled) would stop waiting before the reason goes.
describe("toBeEnabled in the tests", () => {
  it("does not count a control with aria-disabled as enabled", () => {
    render(<button type="button" aria-disabled="true">Publicar</button>);
    const button = screen.getByRole("button", { name: "Publicar" });

    expect(() => expect(button).toBeEnabled()).toThrow(/aria-disabled/);
    expect(button).not.toBeEnabled();
  });

  it("keeps the rest of jest-dom's rule", () => {
    render(<><button type="button">Guardar</button><button type="button" disabled>Borrar</button></>);

    expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Borrar" })).not.toBeEnabled();
  });
});
