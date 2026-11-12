import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ActionsMenu } from "./ActionsMenu";
import { PencilIcon } from "./icons";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

/// Radix abre el menú con Enter desde ⋮, como los demás tests de menús del repositorio.
async function open(label: string) {
  const trigger = screen.getByRole("button", { name: label });
  act(() => trigger.focus());
  await userEvent.keyboard("{Enter}");
  return { trigger, menu: await screen.findByRole("menu") };
}

describe("ActionsMenu", () => {
  it("opens from ⋮, named by its label, and does the action of an item", async () => {
    const onCorrect = vi.fn();
    renderWithProviders(<ActionsMenu label="Más acciones" items={[{ label: "Corregir", icon: PencilIcon, onSelect: onCorrect }]} />);

    const { menu } = await open("Más acciones");
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Corregir" }));

    expect(onCorrect).toHaveBeenCalledOnce();
  });

  it("puts what destroys last, in red and after a line", async () => {
    renderWithProviders(<ActionsMenu label="Más acciones" items={[
      { label: "Corregir", onSelect: vi.fn() },
      { label: "Anular", destructive: true, onSelect: vi.fn() },
    ]} />);

    const { menu } = await open("Más acciones");

    expect(within(menu).getAllByRole("menuitem").map(item => item.textContent)).toEqual(["Corregir", "Anular"]);
    expect(within(menu).getByRole("separator")).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Anular" })).toHaveAttribute("data-variant", "destructive");
  });

  it("keeps an unavailable item with its reason inside, which does nothing and leaves the menu open", async () => {
    const onDelete = vi.fn();
    renderWithProviders(<ActionsMenu label="Acciones del formulario" items={[
      { label: "Eliminar", destructive: true, reason: "Tiene respuestas.", onSelect: onDelete },
    ]} />);

    const { menu } = await open("Acciones del formulario");
    const item = within(menu).getByRole("menuitem", { name: /Eliminar/ });
    await waitFor(() => expect(item).toHaveFocus());
    await userEvent.keyboard("{Enter}");

    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).toHaveTextContent("Tiene respuestas.");
    expect(onDelete).not.toHaveBeenCalled();
    expect(menu).toBeVisible();
  });

  it("groups its items with the lines it is given and ends with a note", async () => {
    renderWithProviders(<ActionsMenu label="Más acciones" note="No se puede eliminar: tiene respuestas." items={[
      { label: "Descargar la plantilla", onSelect: vi.fn() },
      { separator: true },
      { label: "Ordenar", onSelect: vi.fn() },
    ]} />);

    const { menu } = await open("Más acciones");

    expect(within(menu).getAllByRole("separator")).toHaveLength(1);
    expect(within(menu).getByText("No se puede eliminar: tiene respuestas.")).toBeVisible();
  });

  // DOC7-A: «Contar» of a card of the dashboard is one choice among a few, with the tick on the chosen one (OE1-A).
  it("offers a choice by its name, with the chosen one ticked, and gives the one picked", async () => {
    const onValueChange = vi.fn();
    renderWithProviders(<ActionsMenu label="Acciones de «Por banco»" items={[
      { choice: true, label: "Contar", value: "count", options: [{ value: "count", label: "Cantidad" }, { value: "amount", label: "Total de Monto (pesos)" }], onValueChange },
      { separator: true },
      { label: "Ver como tabla", onSelect: vi.fn() },
      { label: "Anular", destructive: true, onSelect: vi.fn() },
    ]} />);

    const { menu } = await open("Acciones de «Por banco»");
    const group = within(menu).getByRole("group", { name: "Contar" });
    expect(within(group).getByRole("menuitemradio", { name: "Cantidad" })).toHaveAttribute("aria-checked", "true");
    expect(within(menu).getAllByRole("separator")).toHaveLength(2);
    await userEvent.click(within(group).getByRole("menuitemradio", { name: "Total de Monto (pesos)" }));

    expect(onValueChange).toHaveBeenCalledWith("amount");
  });

  it("gives the focus back to ⋮ when it closes", async () => {
    renderWithProviders(<ActionsMenu label="Más acciones" items={[{ label: "Corregir", onSelect: vi.fn() }]} />);

    const { trigger, menu } = await open("Más acciones");
    await waitFor(() => expect(within(menu).getByRole("menuitem", { name: "Corregir" })).toHaveFocus());
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
