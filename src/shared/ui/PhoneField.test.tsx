import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PhoneField } from "./PhoneField";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

function renderField(props: Partial<Parameters<typeof PhoneField>[0]> = {}) {
  const onCountryChange = vi.fn();

  renderWithProviders(
    <PhoneField
      label="Número de WhatsApp"
      hint="Te mandamos un código por WhatsApp."
      countries={["AR"]}
      country="AR"
      onCountryChange={onCountryChange}
      {...props}
    />,
  );

  return { onCountryChange };
}

describe("PhoneField", () => {
  it("is a phone field named by its label and described by the hint", async () => {
    renderField();

    const number = await screen.findByRole("textbox", { name: "Número de WhatsApp" });

    expect(number).toHaveAttribute("type", "tel");
    // Sin el prefijo del país: ese lo pone el desplegable de al lado.
    expect(number).toHaveAttribute("autocomplete", "tel-national");
    expect(number).toHaveAccessibleDescription("Te mandamos un código por WhatsApp.");
    expect(number).not.toHaveAttribute("aria-invalid");
  });

  it("shows the error in place of the hint", async () => {
    renderField({ error: "Ingresá un número de celular válido." });

    const number = await screen.findByRole("textbox", { name: "Número de WhatsApp" });

    expect(number).toHaveAttribute("aria-invalid", "true");
    expect(number).toHaveAccessibleDescription("Ingresá un número de celular válido.");
    expect(screen.queryByText("Te mandamos un código por WhatsApp.")).not.toBeInTheDocument();
  });

  it("shows the country with its calling code, and says its name to a screen reader", async () => {
    renderField();

    // The field says "AR +54", and the reader hears the name of the field and the whole country.
    const country = await screen.findByRole("button", { name: "País Argentina, +54" });

    expect(within(country).getByText("AR +54")).toBeVisible();
  });

  it("shows only the code of a country whose calling code it does not know", async () => {
    renderField({ countries: ["JP"], country: "JP" });

    const country = await screen.findByRole("button", { name: "País Japón" });

    expect(within(country).getByText("JP")).toBeVisible();
    expect(country).not.toHaveTextContent("+");
  });

  it("lets another of the allowed countries be chosen", async () => {
    const { onCountryChange } = renderField({ countries: ["AR", "UY"] });

    // Con teclado, como los demás desplegables de Radix en los tests (ver UserMenu.test.tsx).
    const country = await screen.findByRole("button", { name: "País Argentina, +54" });
    country.focus();
    await userEvent.keyboard("{Enter}");
    // In the list, each country goes by its name.
    const list = await screen.findByRole("listbox", { name: "País" });
    expect(within(list).getAllByRole("option").map((option) => option.textContent)).toEqual(["Argentina, +54", "Uruguay, +598"]);
    await userEvent.click(within(list).getByRole("option", { name: "Uruguay, +598" }));

    expect(onCountryChange).toHaveBeenCalledWith("UY");
  });
});
