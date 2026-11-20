import { useState } from "react";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { FormConditionsEditor } from "./FormConditionsEditor";
import type { ResponseColumn, ResponseCondition } from "../responses";

const columns: ResponseColumn[] = [
  { fieldId: "faults", type: "multiChoice", label: "Fallas", options: [{ id: "cold", label: "Frío" }, { id: "noise", label: "Ruido" }], introducedInVersion: 1 },
  { fieldId: "branch", type: "choice", label: "Sucursal", options: [{ id: "north", label: "Norte" }], introducedInVersion: 1 },
];
function Harness() {
  const [conditions, setConditions] = useState<readonly ResponseCondition[]>([{ fieldId: "faults", operator: "answered", values: [] }]);
  return <><FormConditionsEditor conditions={conditions} columns={columns} blocked={false} onChange={setConditions}/>
    <output aria-label="Condiciones confirmadas">{JSON.stringify(conditions)}</output></>;
}
it("offers anyOf only for multiple choice and keeps another condition when values change", async () => {
  renderWithProviders(<Harness/>);
  const operator = await openList("Condición Tiene respuesta");
  expect(within(operator).queryByRole("option", { name: "Es una de" })).not.toBeInTheDocument();
  await userEvent.click(within(operator).getByRole("option", { name: "Eligió alguna de" }));
  // The values of several: the list stays open while it marks.
  const values = await openList("Valor Elegí los valores");
  expect(values).toHaveAttribute("aria-multiselectable", "true");
  await userEvent.click(within(values).getByRole("option", { name: "Frío" }));
  await userEvent.keyboard("{Escape}");
  expect(screen.getByLabelText("Condiciones confirmadas")).toHaveTextContent('"operator":"anyOf"');
  expect(screen.getByLabelText("Condiciones confirmadas")).toHaveTextContent('"values":["cold"]');
  await userEvent.click(screen.getByRole("button", { name: "Agregar condición" }));
  await pick(screen.getAllByRole("button", { name: /^Pregunta / })[1]!, "Sucursal");
  const operators = await openList(screen.getAllByRole("button", { name: /^Condición / })[1]!);
  expect(within(operators).getByRole("option", { name: "Es una de" })).toBeInTheDocument();
  expect(within(operators).queryByRole("option", { name: "Eligió alguna de" })).not.toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  expect(screen.getByLabelText("Condiciones confirmadas")).toHaveTextContent('"operator":"anyOf"');
});

// A block of rows (RG5-A): its questions are chosen in their place, after its name, and the block itself is not.
const blockColumns: ResponseColumn[] = [
  { fieldId: "remito", type: "shortText", label: "Remito", options: [], introducedInVersion: 1 },
  { fieldId: "items", type: "group", label: "Artículos", options: [], introducedInVersion: 1, questions: [
    { fieldId: "good", type: "boolean", label: "¿Llegó en buen estado?", options: [], introducedInVersion: 1 },
    { fieldId: "quantity", type: "decimal", label: "Cantidad", options: [], introducedInVersion: 1 },
  ] },
];
function BlockHarness({ columns = blockColumns, initial }: { columns?: ResponseColumn[]; initial: readonly ResponseCondition[] }) {
  const [conditions, setConditions] = useState<readonly ResponseCondition[]>(initial);
  return <><FormConditionsEditor conditions={conditions} columns={columns} blocked={false} onChange={setConditions}/>
    <output aria-label="Condiciones confirmadas">{JSON.stringify(conditions)}</output></>;
}
const confirmed = () => JSON.parse(screen.getByLabelText("Condiciones confirmadas").textContent!) as ResponseCondition[];
it("offers each question of the block after its name and never the block itself", async () => {
  renderWithProviders(<BlockHarness initial={[{ fieldId: "remito", operator: "answered", values: [] }]}/>);
  expect(within(await openList("Pregunta Remito")).getAllByRole("option").map(option => option.textContent))
    .toEqual(["Remito", "Artículos › ¿Llegó en buen estado?", "Artículos › Cantidad"]);
  expect(screen.queryByText("Algún ítem con")).not.toBeInTheDocument();
});
it("starts a condition on a question of the block with «Algún ítem con», its first operator and only the operators with a value", async () => {
  renderWithProviders(<BlockHarness initial={[{ fieldId: "remito", operator: "answered", values: [] }]}/>);
  await pick("Pregunta Remito", "Artículos › Cantidad");
  expect(screen.getByText("Algún ítem con")).toBeVisible();
  expect(within(await openList("Condición Es igual a")).getAllByRole("option").map(option => option.textContent))
    .toEqual(["Es igual a", "Es mayor o igual a", "Es menor o igual a"]);
  await userEvent.keyboard("{Escape}");
  expect(confirmed()).toEqual([{ fieldId: "quantity", operator: "equals", values: [""] }]);
  await pick("Pregunta Artículos › Cantidad", "Artículos › ¿Llegó en buen estado?");
  // Sí or No in a segmented control, with Sí pressed.
  expect(within(screen.getByRole("group", { name: "Valor" })).getByRole("button", { name: "Sí" })).toHaveAttribute("aria-pressed", "true");
  expect(confirmed()).toEqual([{ fieldId: "good", operator: "in", values: ["true"] }]);
  await pick("Pregunta Artículos › ¿Llegó en buen estado?", "Remito");
  expect(confirmed()).toEqual([{ fieldId: "remito", operator: "answered", values: [] }]);
  expect(screen.queryByText("Algún ítem con")).not.toBeInTheDocument();
});
it("adds a condition with the first question that can be chosen, also when the block comes first", async () => {
  renderWithProviders(<BlockHarness columns={[blockColumns[1], blockColumns[0]]} initial={[]}/>);
  await userEvent.click(screen.getByRole("button", { name: "Agregar condición" }));
  expect(confirmed()).toEqual([{ fieldId: "good", operator: "in", values: ["true"] }]);
});
it("keeps the rows aligned: with a condition of the block, every other row reserves the place of «Algún ítem con»", () => {
  renderWithProviders(<BlockHarness initial={[{ fieldId: "good", operator: "in", values: ["false"] }, { fieldId: "remito", operator: "answered", values: [] }]}/>);
  const prefixes = screen.getAllByText("Algún ítem con");
  expect(prefixes).toHaveLength(2);
  expect(prefixes.map(prefix => prefix.getAttribute("aria-hidden"))).toEqual([null, "true"]);
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
