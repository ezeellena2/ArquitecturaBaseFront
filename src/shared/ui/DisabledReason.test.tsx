import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DisabledReason } from "./DisabledReason";
import { FormField } from "./FormField";
import { Button } from "./button";
import { Input } from "./input";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

const reason = "Guardá el catálogo antes.";
const touch = (target: Element) => userEvent.pointer({ keys: "[TouchA]", target });

describe("DisabledReason", () => {
  it("keeps a disabled button in the Tab order with its name, that it is unavailable and the reason (MA1-A)", async () => {
    renderWithProviders(
      <DisabledReason reason={reason}>
        <Button disabled>Exportar</Button>
      </DisabledReason>,
    );
    const button = screen.getByRole("button", { name: "Exportar" });

    // Sin texto al lado del botón: el motivo es su descripción accesible.
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toBeDisabled();
    expect(button).toHaveAccessibleDescription(reason);

    await userEvent.hover(button);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(reason);
    await userEvent.unhover(button);

    await userEvent.tab();
    expect(button).toHaveFocus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent(reason);
  });

  it("shows the reason with a click, a touch, Enter or Space, and does not do the action", async () => {
    const onClick = vi.fn();
    renderWithProviders(
      <DisabledReason reason={reason}>
        <Button disabled onClick={onClick}>Exportar</Button>
      </DisabledReason>,
    );
    const button = screen.getByRole("button", { name: "Exportar" });

    await userEvent.click(button);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(reason);
    await userEvent.keyboard("{Escape}");
    await touch(button);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(reason);

    button.focus();
    await userEvent.keyboard("{Escape}");
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("tooltip")).toHaveTextContent(reason);
    await userEvent.keyboard("{Escape}");
    await userEvent.keyboard(" ");
    expect(await screen.findByRole("tooltip")).toHaveTextContent(reason);

    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not send its form, not even with Enter in one of its fields", async () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    renderWithProviders(
      <form onSubmit={onSubmit}>
        <Input aria-label="Nombre" />
        <DisabledReason reason={reason}>
          <Button type="submit" disabled>Guardar</Button>
        </DisabledReason>
      </form>,
    );

    await userEvent.type(screen.getByRole("textbox", { name: "Nombre" }), "Ana{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("renders the control alone when there is no reason", async () => {
    renderWithProviders(
      <DisabledReason reason={null}>
        <Button disabled>Exportar</Button>
      </DisabledReason>,
    );
    const button = screen.getByRole("button", { name: "Exportar" });

    expect(button).toBeDisabled();
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

  it("reaches a disabled field by its wrapper, named by the field's label, and shows the reason with Enter or a touch", async () => {
    renderWithProviders(
      <FormField label="Como si lo recibiera">
        <DisabledReason reason="Guardá el formulario antes.">
          <Input disabled />
        </DisabledReason>
      </FormField>,
    );

    await userEvent.tab();
    const wrapper = screen.getByRole("group", { name: "Como si lo recibiera" });
    expect(wrapper).toHaveFocus();
    expect(wrapper).toHaveAccessibleDescription("Guardá el formulario antes.");
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Guardá el formulario antes.");

    await userEvent.keyboard("{Escape}");
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Guardá el formulario antes.");

    await userEvent.keyboard("{Escape}");
    await touch(wrapper);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Guardá el formulario antes.");
  });
});
