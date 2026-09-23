import { act, screen } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

// sonner.tsx lo genera la CLI de shadcn sin textos propios, y sonner trae los suyos en inglés: la región de los
// avisos se anuncia como "Notifications alt+T" y el botón de cerrar un aviso, como "Close toast". Es lo que lee un
// lector de pantalla. Están traducidos a mano: si alguien regenera el archivo, esto se pone en rojo.
describe("Toaster", () => {
  afterEach(() => {
    toast.dismiss();
  });

  it("names the notifications region in the interface language", async () => {
    renderWithProviders(<p>Contenido</p>);

    expect(await screen.findByRole("region", { name: /^Notificaciones\b/ })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Notifications/ })).not.toBeInTheDocument();
  });

  it("names the close button of a notification in the interface language", async () => {
    renderWithProviders(<p>Contenido</p>);

    act(() => {
      toast("Cambios guardados", { closeButton: true });
    });

    expect(await screen.findByRole("button", { name: "Cerrar aviso" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close toast" })).not.toBeInTheDocument();
  });
});
