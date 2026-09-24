import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Banner } from "./Banner";

describe("Banner", () => {
  it("describes a condition that is still true as a status, with its action", () => {
    render(<Banner action={<button type="button">Agregar correo</button>}>Falta el correo.</Banner>);

    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("Falta el correo.");
    expect(banner).toContainElement(screen.getByRole("button", { name: "Agregar correo" }));
  });

  it("is an alert when it is an error", () => {
    render(<Banner tone="danger">Este número ya es de otra cuenta.</Banner>);

    expect(screen.getByRole("alert")).toHaveTextContent("Este número ya es de otra cuenta.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("describes a risk as a status, not as an error", () => {
    // Una advertencia no es algo que haya que corregir para seguir: el lector la anuncia sin interrumpir.
    render(<Banner tone="warning">Es su único medio de ingreso.</Banner>);

    expect(screen.getByRole("status")).toHaveTextContent("Es su único medio de ingreso.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps its icon away from a screen reader", () => {
    const { container } = render(<Banner>Falta el correo.</Banner>);

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
