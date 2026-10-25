import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormField } from "./FormField";
import { Input } from "./input";

describe("FormField", () => {
  it("links the label with the control", () => {
    render(
      <FormField label="Email" htmlFor="email">
        <Input id="email" />
      </FormField>,
    );

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("shows the error and marks the control as invalid", () => {
    render(
      <FormField label="Email" htmlFor="email" error="Ingresá un correo válido.">
        <Input id="email" />
      </FormField>,
    );

    const input = screen.getByLabelText("Email");
    expect(screen.getByRole("alert")).toHaveTextContent("Ingresá un correo válido.");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Ingresá un correo válido.");
  });

  it("announces an error that changes with each keystroke as a polite status when asked to", () => {
    render(
      <FormField label="Plazo" htmlFor="term" error="«30 d» no es un número entero." liveError="polite">
        <Input id="term" />
      </FormField>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("«30 d» no es un número entero.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Plazo")).toHaveAccessibleDescription("«30 d» no es un número entero.");
  });

  it("shows the hint when there is no error", () => {
    render(
      <FormField label="Código" htmlFor="code" hint="Te lo mandamos por email.">
        <Input id="code" />
      </FormField>,
    );

    expect(screen.getByLabelText("Código")).toHaveAccessibleDescription("Te lo mandamos por email.");
  });
});
