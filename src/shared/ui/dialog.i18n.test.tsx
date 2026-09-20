import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./dialog";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

// dialog.tsx lo genera la CLI de shadcn con "Close" escrito en inglés, en el texto que lee un lector de
// pantalla y en el botón del pie. Está traducido a mano: si alguien regenera el archivo, esto se pone en rojo.
describe("dialog", () => {
  it("translates the close controls that shadcn leaves in English", async () => {
    renderWithProviders(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Título</DialogTitle>
          </DialogHeader>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>,
    );

    const closeControls = await screen.findAllByRole("button", { name: "Cerrar" });

    expect(closeControls).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });
});
