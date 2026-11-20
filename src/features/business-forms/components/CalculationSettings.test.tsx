import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import type { DraftQuestion } from "../model";
import { CalculationFormula, CalculationSettings } from "./CalculationSettings";

const number = (localId: string, label: string, extra: Partial<DraftQuestion> = {}): DraftQuestion =>
  ({ localId, fieldId: null, replacesFieldId: null, type: "decimal", label: { es: label }, help: null, required: false, ...extra } as DraftQuestion);
const block: DraftQuestion = { localId: "block", fieldId: null, replacesFieldId: null, type: "group", label: { es: "Artículos" }, help: null, required: true, rows: { minRows: 1, maxRows: 20 } };
const quantity = number("quantity", "Cantidad", { repeated: true });
const price = number("price", "Precio unitario", { repeated: true });
const freight = number("freight", "Flete");

function Harness({ initial, others, locked }: { initial: DraftQuestion; others: readonly DraftQuestion[]; locked?: string }) {
  const [question, setQuestion] = useState(initial);
  const questions = [...others, question];
  return <><CalculationSettings question={question} questions={questions} culture="es" original="es" readOnly={false} lockedReason={locked} onChange={setQuestion} />
    <p data-testid="formula"><CalculationFormula question={question} questions={questions} culture="es" original="es" /></p></>;
}

describe("«Qué calcula» of a calculation (CA1-A)", () => {
  it("multiplies two earlier numbers of its own item, chosen in their lists", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness initial={number("amount", "Importe", { repeated: true, calculation: { operation: "multiply", operands: [null, null] } })} others={[freight, block, quantity, price]} />);

    expect(screen.getByRole("button", { name: "Multiplicar" })).toHaveAttribute("aria-pressed", "true");
    // Nothing chosen yet: the field says «Elegí una pregunta» and its list has only the questions.
    const first = await openList("Multiplica Elegí una pregunta");
    expect(within(first).getAllByRole("option").map(option => option.textContent)).toEqual(["Cantidad (pregunta 2.1)", "Precio unitario (pregunta 2.2)"]);
    await user.click(within(first).getByRole("option", { name: "Cantidad (pregunta 2.1)" }));
    await pick("Por Elegí una pregunta", "Precio unitario (pregunta 2.2)");
    expect(screen.getByTestId("formula")).toHaveTextContent("Cantidad por Precio unitario");
    // In the block a sum is not offered: it goes outside.
    expect(screen.getByRole("button", { name: "Sumar" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Sumar" })).toHaveAccessibleDescription("Una suma va afuera del bloque.");
  });

  it("adds a question of the block over all the items and loose numbers, as chips with «+ Agregar»", async () => {
    const user = userEvent.setup();
    const amount = number("amount", "Importe", { repeated: true, calculation: { operation: "multiply", operands: ["quantity", "price"] } });
    renderWithProviders(<Harness initial={number("total", "Total", { calculation: { operation: "sum", operands: ["amount"] } })} others={[freight, block, quantity, price, amount]} />);

    const sum = screen.getByRole("group", { name: "Suma de" });
    expect(within(sum).getByText("Importe · todos los ítems")).toBeVisible();
    const add = within(sum).getByRole("button", { name: "+ Agregar" });
    add.focus();
    await user.keyboard("{Enter}");
    await user.click(await screen.findByRole("menuitem", { name: "Flete" }));
    expect(screen.getByTestId("formula")).toHaveTextContent("Suma de Importe de todos los ítems y Flete");
    await user.click(within(sum).getByRole("button", { name: "Quitar Importe · todos los ítems de la suma" }));
    expect(screen.getByTestId("formula")).toHaveTextContent("Suma de Flete");
  });

  it("keeps what the library standard needs, with the reason on each control (BI1-A)", () => {
    renderWithProviders(<Harness initial={number("total", "Total", { fieldId: "field-total", calculation: { operation: "sum", operands: ["freight"] } })} others={[freight]}
      locked="La necesita el estándar de la biblioteca: no se cambia." />);

    expect(screen.getByRole("button", { name: "Multiplicar" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Multiplicar" })).toHaveAccessibleDescription("La necesita el estándar de la biblioteca: no se cambia.");
    const sum = screen.getByRole("group", { name: "Suma de" });
    expect(within(sum).queryByRole("button", { name: /^Quitar/ })).not.toBeInTheDocument();
    expect(within(sum).getByRole("button", { name: "+ Agregar" })).toHaveAccessibleDescription("La necesita el estándar de la biblioteca: no se cambia.");
  });
});

// The Picker opens with the keyboard, like the other Radix lists in the tests; its button says the label and the chosen one.
async function openList(trigger: string | RegExp | HTMLElement) {
  const button = trigger instanceof HTMLElement ? trigger : screen.getByRole("button", { name: trigger });
  await act(async () => { button.focus(); });
  await userEvent.keyboard("{Enter}");
  return screen.findByRole("listbox");
}
async function pick(trigger: string | RegExp | HTMLElement, option: string | RegExp) {
  await userEvent.click(within(await openList(trigger)).getByRole("option", { name: option }));
}
