import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

// sonner.tsx lo genera la CLI de shadcn sin nombre para la región de los avisos, y sonner le pone el suyo en
// inglés ("Notifications alt+T"): es lo que anuncia un lector de pantalla al llegar ahí. Está traducido a mano:
// si alguien regenera el archivo, esto se pone en rojo.
describe("Toaster", () => {
  it("names the notifications region in the interface language", async () => {
    renderWithProviders(<p>Contenido</p>);

    expect(await screen.findByRole("region", { name: /^Notificaciones\b/ })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Notifications/ })).not.toBeInTheDocument();
  });
});
