import { screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { FormReplyValues } from "./FormReplyValues";

// The card of the chat with a block of rows: its name and an item per line, without what was left unanswered, like «Así llega».
it("shows the block with an item per line, and says it has no answer without items", () => {
  renderWithProviders(<FormReplyValues rows={[
    { id: "supplier", label: "Proveedor", answer: { type: "shortText", value: "Proveedor del norte" } },
    { id: "items", label: "Artículos", answer: { type: "group", value: [
      [{ type: "choice", value: "GLIFOSATO 64%" }, { type: "decimal", value: "200" }, { type: "boolean", value: true }],
      [{ type: "choice", value: "UREA GRANULADA" }, { type: "decimal", value: null }, { type: "boolean", value: false }],
    ] } },
    { id: "empty", label: "Devoluciones", answer: { type: "group", value: [] } },
  ]}/>);

  const answers = within(screen.getByRole("group", { name: "Respuestas del formulario" }));
  const items = within(answers.getByRole("list", { name: "Artículos" })).getAllByRole("listitem");
  expect(items.map(item => item.textContent)).toEqual(["1. GLIFOSATO 64% · 200 · Sí", "2. UREA GRANULADA · No"]);
  expect(answers.getByText("Devoluciones").closest("div")).toHaveTextContent("Sin respuesta");
});
