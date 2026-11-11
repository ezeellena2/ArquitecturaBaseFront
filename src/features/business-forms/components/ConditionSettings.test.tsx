import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import type { DraftQuestion } from "../model";
import { ConditionLine, ConditionSettings } from "./ConditionSettings";

const scope = { actorId: "actor", culture: "es" as const, permissions: ["formtemplates.manage"] };
const concept: DraftQuestion = { localId: "concept", fieldId: null, replacesFieldId: null, type: "choice", label: { es: "Concepto" }, help: null, required: true,
  options: [{ localId: "goods", choiceId: null, label: { es: "Productos" } }, { localId: "services", choiceId: null, label: { es: "Servicios" } },
    { localId: "both", choiceId: null, label: { es: "Productos y servicios" } }] };
const from: DraftQuestion = { localId: "from", fieldId: null, replacesFieldId: null, type: "date", label: { es: "Período desde" }, help: null, required: true };

function Harness({ initial, others }: { initial: DraftQuestion; others: readonly DraftQuestion[] }) {
  const [question, setQuestion] = useState(initial);
  const questions = [...others, question];
  return <><ConditionSettings question={question} questions={questions} culture="es" original="es" readOnly={false} scope={scope} onChange={setQuestion} />
    <p data-testid="line"><ConditionLine question={question} questions={questions} culture="es" original="es" scope={scope} /></p></>;
}

describe("«Se muestra» of a question (CO1-A)", () => {
  it("shows a question according to an earlier answer, chosen as chips", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness initial={from} others={[concept]} />);

    expect(screen.getByRole("button", { name: "Siempre" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("combobox", { name: "Si" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Según otra respuesta" }));
    expect(screen.getByTestId("line")).toHaveTextContent("Según otra respuesta");
    await user.selectOptions(screen.getByRole("combobox", { name: "Si" }), "concept");

    const answers = screen.getByRole("group", { name: "es" });
    for (const answer of ["Servicios", "Productos y servicios"]) {
      const add = within(answers).getByRole("button", { name: "+ Agregar" });
      add.focus();
      await user.keyboard("{Enter}");
      await user.click(await screen.findByRole("menuitem", { name: answer }));
    }
    expect(within(answers).getByText("Servicios")).toBeVisible();
    expect(screen.getByTestId("line")).toHaveTextContent("Si Concepto es Servicios o…");
    await user.click(within(answers).getByRole("button", { name: "Quitar «Productos y servicios»" }));
    expect(screen.getByTestId("line")).toHaveTextContent("Si Concepto es Servicios");

    await user.click(screen.getByRole("button", { name: "Siempre" }));
    expect(screen.queryByRole("combobox", { name: "Si" })).not.toBeInTheDocument();
    expect(screen.getByTestId("line")).toBeEmptyDOMElement();
  });

  it("says why «Según otra respuesta» is off without an earlier question to name", () => {
    renderWithProviders(<Harness initial={from} others={[]} />);
    expect(screen.getByRole("button", { name: "Según otra respuesta" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Según otra respuesta" })).toHaveAccessibleDescription("No hay antes una pregunta de elegir una o de sí o no, afuera del bloque.");
  });

  it("offers yes and no for a yes or no question", async () => {
    const user = userEvent.setup();
    const paid: DraftQuestion = { localId: "paid", fieldId: null, replacesFieldId: null, type: "boolean", label: { es: "¿Pagó?" }, help: null, required: false };
    renderWithProviders(<Harness initial={{ ...from, showWhen: { questionId: "paid", values: [] } }} others={[paid]} />);
    const add = within(screen.getByRole("group", { name: "es" })).getByRole("button", { name: "+ Agregar" });
    add.focus();
    await user.keyboard("{Enter}");
    expect((await screen.findAllByRole("menuitem")).map(item => item.textContent)).toEqual(["Sí", "No"]);
  });
});
