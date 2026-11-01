import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CheckboxField } from "./CheckboxField";
import { FormField } from "./FormField";
import { InfoTip } from "./InfoTip";
import { Input } from "./input";
import { Page } from "./Page";
import { RadioGroupField } from "./RadioGroupField";
import { Surface } from "./Surface";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

describe("InfoTip", () => {
  it("shows its explanation in a tooltip on hover and keyboard focus, never as a line under the control", async () => {
    renderWithProviders(<InfoTip label="Más información sobre la clave" text="La clave guardada nunca se muestra." />);
    const info = screen.getByRole("button", { name: "Más información sobre la clave" });
    expect(info).toHaveAccessibleDescription("La clave guardada nunca se muestra.");
    expect(screen.queryByText("La clave guardada nunca se muestra.", { selector: "p" })).toBeNull();
    await userEvent.tab();
    expect(info).toHaveFocus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("La clave guardada nunca se muestra.");
  });
});

describe("the help of the shared pieces goes in the information icon", () => {
  it("is the description of a field and leaves the line under it for the error", () => {
    renderWithProviders(
      <FormField label="Zona horaria" help="Los horarios corresponden a esta zona." error="Elegí una zona.">
        <Input />
      </FormField>,
    );
    const input = screen.getByLabelText("Zona horaria");
    expect(input).toHaveAccessibleDescription("Los horarios corresponden a esta zona. Elegí una zona.");
    expect(screen.getByRole("button", { name: "Más información sobre Zona horaria" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Elegí una zona.");
  });

  it("goes next to the title of a surface and of a page", () => {
    renderWithProviders(
      <Page title="Formularios que faltan" help="Lo que alguien quiso registrar y no tenía formulario.">
        <Surface title="Clave y prueba de conexión" help="La prueba puede tener costo.">contenido</Surface>
      </Page>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Formularios que faltan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Más información sobre Formularios que faltan" })).toHaveAccessibleDescription("Lo que alguien quiso registrar y no tenía formulario.");
    expect(screen.getByRole("region", { name: "Clave y prueba de conexión" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Más información sobre Clave y prueba de conexión" })).toHaveAccessibleDescription("La prueba puede tener costo.");
  });

  it("goes at the end of an option and of a check box, and touching it does not choose them", async () => {
    const onValueChange = vi.fn(), onCheckedChange = vi.fn();
    renderWithProviders(<>
      <RadioGroupField label="Resultado" value={undefined} onValueChange={onValueChange}
        options={[{ value: "sent", label: "Salió", help: "La regla continúa sin volver a mandar este aviso." }, { value: "failed", label: "No salió" }]} />
      <CheckboxField label="Aceptó recibir mensajes" checked={false} onCheckedChange={onCheckedChange} help="Sin esto, WhatsApp no permite escribirle primero." />
    </>);
    expect(screen.getByRole("radio", { name: "Salió" })).toHaveAccessibleDescription("La regla continúa sin volver a mandar este aviso.");
    expect(screen.getByRole("checkbox", { name: "Aceptó recibir mensajes" })).toHaveAccessibleDescription("Sin esto, WhatsApp no permite escribirle primero.");
    await userEvent.click(screen.getByRole("button", { name: "Más información sobre Salió" }));
    await userEvent.click(screen.getByRole("button", { name: "Más información sobre Aceptó recibir mensajes" }));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
