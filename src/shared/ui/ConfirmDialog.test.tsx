import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

describe("ConfirmDialog", () => {
  it("confirms and closes", async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    renderWithProviders(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Deshabilitar usuario"
        description="No va a poder ingresar."
        confirmLabel="Deshabilitar"
        onConfirm={onConfirm}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Deshabilitar" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("cancels without calling the action", async () => {
    const onConfirm = vi.fn();
    renderWithProviders(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Deshabilitar usuario"
        confirmLabel="Deshabilitar"
        onConfirm={onConfirm}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("names the way out after what it keeps when asked to", async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    renderWithProviders(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="¿Descartar los cambios?"
        confirmLabel="Descartar"
        cancelLabel="Seguir editando"
        destructive
        onConfirm={onConfirm}
      />,
    );

    // "Cancelar" frente a "Descartar" no dice qué se cancela: si la salida o los cambios.
    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Seguir editando" }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("traps focus, closes on Escape, and returns focus to the trigger", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);

      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Abrir
          </button>
          <ConfirmDialog
            open={open}
            onOpenChange={setOpen}
            title="Deshabilitar usuario"
            confirmLabel="Deshabilitar"
            onConfirm={vi.fn()}
          />
        </>
      );
    }

    renderWithProviders(<Harness />);

    const trigger = screen.getByRole("button", { name: "Abrir" });
    await userEvent.click(trigger);

    const dialog = await screen.findByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);

    // El foco no se escapa del diálogo aunque se tabule más veces que elementos enfocables tiene adentro.
    for (let i = 0; i < 6; i++) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("marks a destructive confirmation differently from a plain one and states what will be lost", () => {
    renderWithProviders(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Eliminar usuario"
        description="Se van a borrar sus datos y no se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText("Se van a borrar sus datos y no se puede deshacer.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar" })).toHaveAttribute("data-variant", "destructive");
  });

  it("keeps the default variant when the confirmation is not destructive", () => {
    renderWithProviders(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Guardar cambios"
        confirmLabel="Guardar"
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Guardar" })).toHaveAttribute("data-variant", "default");
  });
});
