import { useState } from "react";
import { screen, within } from "@testing-library/react";
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
  const operator = screen.getByRole("combobox", { name: "Condición" });
  expect(within(operator).getByRole("option", { name: "Eligió alguna de" })).toHaveValue("anyOf");
  expect(within(operator).queryByRole("option", { name: "Es una de" })).not.toBeInTheDocument();
  await userEvent.selectOptions(operator, "anyOf");
  const values = screen.getByRole("button", { name: "Valor" });
  values.focus(); await userEvent.keyboard("{Enter}");
  await userEvent.click(screen.getByRole("menuitemcheckbox", { name: "Frío" }));
  await userEvent.keyboard("{Escape}");
  expect(screen.getByLabelText("Condiciones confirmadas")).toHaveTextContent('"operator":"anyOf"');
  expect(screen.getByLabelText("Condiciones confirmadas")).toHaveTextContent('"values":["cold"]');
  await userEvent.click(screen.getByRole("button", { name: "Agregar condición" }));
  const questions = screen.getAllByRole("combobox", { name: "Pregunta" });
  await userEvent.selectOptions(questions[1]!, "branch");
  const operators = screen.getAllByRole("combobox", { name: "Condición" });
  expect(within(operators[1]!).getByRole("option", { name: "Es una de" })).toHaveValue("in");
  expect(within(operators[1]!).queryByRole("option", { name: "Eligió alguna de" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Condiciones confirmadas")).toHaveTextContent('"operator":"anyOf"');
});
