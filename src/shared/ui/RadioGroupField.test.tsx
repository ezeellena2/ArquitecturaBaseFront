import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RadioGroupField } from "./RadioGroupField";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

const options = [
  { value: "Email", label: "Por correo", description: "Cargá un correo para usar esta opción.", disabled: true },
  { value: "WhatsApp", label: "Por WhatsApp" },
];

describe("RadioGroupField", () => {
  it("names the group and each option with its label", () => {
    renderWithProviders(<RadioGroupField label="Por dónde" options={options} value="WhatsApp" onValueChange={vi.fn()} />);

    expect(screen.getByRole("radiogroup", { name: "Por dónde" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Por WhatsApp" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Por correo" })).not.toBeChecked();
  });

  it("disables an option and says why with its help line", () => {
    renderWithProviders(<RadioGroupField label="Por dónde" options={options} value="WhatsApp" onValueChange={vi.fn()} />);

    const email = screen.getByRole("radio", { name: "Por correo" });
    expect(email).toBeDisabled();
    expect(email).toHaveAccessibleDescription("Cargá un correo para usar esta opción.");
  });

  it("reports the option that is picked", async () => {
    const onValueChange = vi.fn();
    renderWithProviders(
      <RadioGroupField
        label="Por dónde"
        options={[
          { value: "Email", label: "Por correo" },
          { value: "WhatsApp", label: "Por WhatsApp" },
        ]}
        value="Email"
        onValueChange={onValueChange}
      />,
    );

    await userEvent.click(screen.getByRole("radio", { name: "Por WhatsApp" }));

    expect(onValueChange).toHaveBeenCalledWith("WhatsApp");
  });

  it("shows the error under the options and ties it to the group", () => {
    renderWithProviders(
      <RadioGroupField
        label="Por dónde"
        options={options}
        value={undefined}
        onValueChange={vi.fn()}
        error="Elegí por dónde mandarla."
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Elegí por dónde mandarla.");
    expect(screen.getByRole("radiogroup", { name: "Por dónde" })).toHaveAccessibleDescription("Elegí por dónde mandarla.");
  });
});
