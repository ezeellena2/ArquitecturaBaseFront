import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DisabledReason } from "./DisabledReason";
import { FormField } from "./FormField";
import { Button } from "./button";
import { Input } from "./input";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

describe("DisabledReason", () => {
  it("explains a disabled button on hover, on keyboard focus and to screen readers", async () => {
    renderWithProviders(
      <DisabledReason reason="Guardá el catálogo antes.">
        <Button disabled>Exportar</Button>
      </DisabledReason>,
    );
    const button = screen.getByRole("button", { name: "Exportar" });

    // Sin texto al lado del botón: el motivo es su descripción accesible.
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("Guardá el catálogo antes.");

    await userEvent.hover(button);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Guardá el catálogo antes.");
    await userEvent.unhover(button);

    // Un botón deshabilitado no recibe foco: lo recibe el envoltorio, que abre el mismo tooltip.
    await userEvent.tab();
    expect(button.parentElement).toHaveFocus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Guardá el catálogo antes.");
  });

  it("renders the control alone when there is no reason", async () => {
    renderWithProviders(
      <DisabledReason reason={null}>
        <Button disabled>Exportar</Button>
      </DisabledReason>,
    );
    const button = screen.getByRole("button", { name: "Exportar" });

    expect(button.parentElement).toBe(screen.getByTestId("ready"));
    expect(button).toHaveAccessibleDescription("");
    await userEvent.hover(button);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await userEvent.tab();
    expect(document.body).toHaveFocus();
  });

  it("forwards the field props a FormField gives it to the wrapped control", () => {
    renderWithProviders(
      <>
        <FormField label="Como si lo recibiera" error="Elegí una persona.">
          <DisabledReason reason="Guardá el formulario antes.">
            <Input disabled />
          </DisabledReason>
        </FormField>
        <FormField label="Persona de ejemplo" hint="Se usa solo para probar.">
          <DisabledReason>
            <Input />
          </DisabledReason>
        </FormField>
      </>,
    );

    const disabled = screen.getByRole("textbox", { name: "Como si lo recibiera" });
    expect(disabled).toBeDisabled();
    expect(disabled).toBeInvalid();
    expect(disabled).toHaveAccessibleDescription("Elegí una persona. Guardá el formulario antes.");

    const enabled = screen.getByRole("textbox", { name: "Persona de ejemplo" });
    expect(enabled).toBeValid();
    expect(enabled).toHaveAccessibleDescription("Se usa solo para probar.");
  });
});
