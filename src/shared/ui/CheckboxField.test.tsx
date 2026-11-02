import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CheckboxField } from "./CheckboxField";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

describe("CheckboxField", () => {
  it("names the checkbox with its label", () => {
    renderWithProviders(<CheckboxField label="Admin" checked={false} onCheckedChange={vi.fn()} />);

    expect(screen.getByRole("checkbox", { name: "Admin" })).not.toBeChecked();
  });

  it("reports the new value when it is clicked", async () => {
    const onCheckedChange = vi.fn();
    renderWithProviders(<CheckboxField label="Admin" checked={false} onCheckedChange={onCheckedChange} />);

    await userEvent.click(screen.getByRole("checkbox", { name: "Admin" }));

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("describes the checkbox with its help line", () => {
    renderWithProviders(
      <CheckboxField label="Admin" description="Puede hacer todo." checked onCheckedChange={vi.fn()} />,
    );

    expect(screen.getByRole("checkbox", { name: "Admin" })).toHaveAccessibleDescription("Puede hacer todo.");
  });

  it("shows the error under the box and marks the checkbox as invalid", () => {
    renderWithProviders(
      <CheckboxField
        label="Aceptó recibir mensajes"
        description="Sin esto, WhatsApp no permite escribirle primero."
        error="Confirmá que la persona aceptó recibir mensajes por WhatsApp."
        checked={false}
        onCheckedChange={vi.fn()}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Aceptó recibir mensajes" });
    expect(screen.getByRole("alert")).toHaveTextContent("Confirmá que la persona aceptó recibir mensajes por WhatsApp.");
    expect(checkbox).toHaveAttribute("aria-invalid", "true");
    // La ayuda sigue: el error dice qué falta y la ayuda, por qué hace falta.
    expect(checkbox).toHaveAccessibleDescription(
      "Sin esto, WhatsApp no permite escribirle primero. Confirmá que la persona aceptó recibir mensajes por WhatsApp.",
    );
  });

  it("explains a disabled box with its reason in a tooltip, not with a text under it", async () => {
    renderWithProviders(
      <CheckboxField label="Adjuntar el PDF" checked={false} disabled disabledReason="Sólo al aprobar." onCheckedChange={vi.fn()} />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Adjuntar el PDF" });
    expect(checkbox).toBeDisabled();
    expect(checkbox).toHaveAccessibleDescription("Sólo al aprobar.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await userEvent.hover(checkbox);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Sólo al aprobar.");
  });

  it("leaves out the reason while the box can be used", () => {
    renderWithProviders(<CheckboxField label="Adjuntar el PDF" checked disabledReason="Sólo al aprobar." onCheckedChange={vi.fn()} />);

    expect(screen.getByRole("checkbox", { name: "Adjuntar el PDF" })).toHaveAccessibleDescription("");
  });
});
