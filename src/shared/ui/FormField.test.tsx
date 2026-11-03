import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
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

  it("puts an action of the field at the end of the label row, after the (i)", async () => {
    renderWithProviders(
      <FormField label="Mensaje" htmlFor="message" help="Cómo se arma el mensaje." action={<button type="button">Agregar dato</button>}>
        <Input id="message" />
      </FormField>,
    );

    const row = (await screen.findByText("Mensaje")).closest("label")?.parentElement;
    expect(row).toContainElement(screen.getByRole("button", { name: "Agregar dato" }));
    expect(row).toContainElement(screen.getByRole("button", { name: "Más información sobre Mensaje" }));
    expect(screen.getByLabelText("Mensaje")).toHaveAccessibleDescription("Cómo se arma el mensaje.");
  });

  it("gives the label an id, so a control that a label cannot name can point to it", () => {
    render(
      <FormField label="Mensaje" htmlFor="message">
        <div role="textbox" aria-labelledby="message-label" />
      </FormField>,
    );

    expect(screen.getByRole("textbox", { name: "Mensaje" })).toHaveAttribute("id", "message");
  });
});
