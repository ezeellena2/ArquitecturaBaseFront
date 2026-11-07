import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { FilterPanel } from "./FilterPanel";

const section = (key: string, label: string, extra: object = {}) => ({ key, label, applied: false, content: <p>{label}</p>, onClear: () => {}, ...extra });

// A group, as the questions of a block of rows (RG4-A): its name heads its questions, indented, and is not chosen.
it("puts the questions of a group under its name, which is not chosen, and says it in their pane", async () => {
  render(<FilterPanel label="Filtros" sections={[section("supplier", "Proveedor"),
    section("item", "Artículo", { group: "Artículos", note: "En algún ítem de Artículos" }),
    section("quantity", "Cantidad", { group: "Artículos", note: "En algún ítem de Artículos" })]}/>);

  await userEvent.click(screen.getByRole("button", { name: "Filtros" }));
  const panel = within(await screen.findByRole("dialog", { name: "Filtros" }));

  expect(panel.getAllByRole("button").filter(button => button.closest("ul")).map(button => button.textContent)).toEqual(["Proveedor", "Artículo", "Cantidad"]);
  expect(panel.getAllByText("Artículos")).toHaveLength(1);
  await userEvent.click(panel.getByRole("button", { name: "Cantidad" }));
  const pane = within(panel.getByRole("region", { name: "Cantidad" }));
  expect(pane.getByRole("heading", { name: "Cantidad" })).toBeInTheDocument();
  expect(pane.getByText("En algún ítem de Artículos")).toBeInTheDocument();
});
