import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { TreeList } from "./TreeList";

describe("TreeList", () => {
  it("chooses an entry, says which one is chosen and folds what is below", async () => {
    const onSelect = vi.fn();
    const onToggle = vi.fn();
    renderWithProviders(<TreeList label="Carpetas" onSelect={onSelect} onToggle={onToggle} items={[
      { id: "all", label: "Todos", level: 0 },
      { id: "delivery", label: "Repartos", level: 1, expanded: true, selected: true, actions: <button type="button">Acciones de Repartos</button> },
      { id: "north", label: "Norte", level: 2 },
    ]} />);
    const list = await screen.findByRole("list", { name: "Carpetas" });
    expect(list).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Repartos" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "Norte" })).not.toHaveAttribute("aria-current");
    await userEvent.click(screen.getByRole("button", { name: "Norte" }));
    expect(onSelect).toHaveBeenCalledWith("north");
    const fold = screen.getByRole("button", { name: "Plegar Repartos" });
    expect(fold).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(fold);
    expect(onToggle).toHaveBeenCalledWith("delivery");
    expect(screen.getByRole("button", { name: "Acciones de Repartos" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /desplegar norte|plegar norte/i })).not.toBeInTheDocument();
  });

  it("puts the editor in place of the row while it is edited", async () => {
    renderWithProviders(<TreeList label="Carpetas" onSelect={vi.fn()} onToggle={vi.fn()} items={[
      { id: "delivery", label: "Repartos", level: 1, editor: <input aria-label="Nombre de «Repartos»" defaultValue="Repartos" /> },
    ]} />);
    expect(await screen.findByRole("textbox", { name: "Nombre de «Repartos»" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Repartos" })).not.toBeInTheDocument();
  });
});
