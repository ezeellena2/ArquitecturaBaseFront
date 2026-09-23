import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { FormField } from "./FormField";
import { MultiSelect } from "./MultiSelect";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

const options = [
  { value: "Admin", label: "Admin", description: "Puede hacer todo." },
  { value: "User", label: "User" },
];

function Harness({ initial = [] }: { initial?: string[] }) {
  const [value, setValue] = useState(initial);

  return (
    <FormField label="Roles">
      <MultiSelect options={options} value={value} onChange={setValue} placeholder="Sin roles" />
    </FormField>
  );
}

describe("MultiSelect", () => {
  it("shows the placeholder while nothing is picked", () => {
    renderWithProviders(<Harness />);

    expect(screen.getByRole("button", { name: "Roles" })).toHaveTextContent("Sin roles");
  });

  it("shows the picked options separated by commas", () => {
    renderWithProviders(<Harness initial={["Admin", "User"]} />);

    expect(screen.getByRole("button", { name: "Roles" })).toHaveTextContent("Admin, User");
  });

  it("stays open while several options are toggled", async () => {
    renderWithProviders(<Harness />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Roles" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: /admin/i }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: /user/i }));

    expect(screen.getByRole("menuitemcheckbox", { name: /admin/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemcheckbox", { name: /user/i })).toHaveAttribute("aria-checked", "true");

    // Con el menú abierto, lo de atrás queda oculto para la accesibilidad: se cierra para leer el control.
    await user.keyboard("{Escape}");

    expect(screen.getByRole("button", { name: "Roles" })).toHaveTextContent("Admin, User");
  });

  it("unpicks an option that was picked", async () => {
    renderWithProviders(<Harness initial={["Admin"]} />);
    const user = userEvent.setup();

    // Por teclado y no con un clic: en jsdom, después de un test que ya abrió un menú de Radix, el clic
    // sobre el disparador deja de abrirlo (en el navegador no pasa). Enter es un camino igual de real.
    screen.getByRole("button", { name: "Roles" }).focus();
    await user.keyboard("{Enter}");
    await user.click(await screen.findByRole("menuitemcheckbox", { name: /admin/i }));
    await user.keyboard("{Escape}");

    expect(screen.getByRole("button", { name: "Roles" })).toHaveTextContent("Sin roles");
  });
});
