import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import type { DraftQuestion } from "../model";
import { ConditionLine, ConditionSettings } from "./ConditionSettings";

const scope = { actorId: "actor", culture: "es" as const, permissions: ["formtemplates.manage"] };
const concept: DraftQuestion = { localId: "concept", fieldId: null, replacesFieldId: null, type: "choice", label: { es: "Concepto" }, help: null, required: true,
  options: [{ localId: "goods", choiceId: null, label: { es: "Productos" } }, { localId: "services", choiceId: null, label: { es: "Servicios" } },
    { localId: "both", choiceId: null, label: { es: "Productos y servicios" } }] };
const from: DraftQuestion = { localId: "from", fieldId: null, replacesFieldId: null, type: "date", label: { es: "Período desde" }, help: null, required: true };

function Harness({ initial, others, whatsApp = false }: { initial: DraftQuestion; others: readonly DraftQuestion[]; whatsApp?: boolean }) {
  const [question, setQuestion] = useState(initial);
  const questions = [...others, question];
  return <><ConditionSettings question={question} questions={questions} culture="es" original="es" readOnly={false} scope={scope} whatsApp={whatsApp} onChange={setQuestion} />
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

  // What WhatsApp cannot publish is stopped or said here, in a form that goes through it; «Sólo en la app» takes it all.
  it("takes one answer of a catalog question in a form that goes through WhatsApp, with its reason", async () => {
    const customer: DraftQuestion = { localId: "customer", fieldId: null, replacesFieldId: null, type: "choice", label: { es: "Cliente" }, help: null, required: true,
      source: { catalog: "customers" } };
    const other = "0199b000-0000-7000-8000-000000000001";
    server.use(http.get("/api/forms/catalogs/:id/items", () => HttpResponse.json({ items: [{ id: other, code: "other", text: { es: "Otro" }, detail: null, value: null, isActive: true, position: 1, fields: {} }],
      page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false })));
    const chosen = { ...from, showWhen: { questionId: "customer", values: [other] } };
    const { unmount } = renderWithProviders(<Harness initial={chosen} others={[customer]} whatsApp />);
    const search = await screen.findByRole("combobox", { name: "es" });
    expect(search).toBeDisabled();
    expect(search).toHaveAccessibleDescription("En WhatsApp, una pregunta de catálogo se compara con una sola respuesta. Con «Sólo en la app» se pueden elegir varias.");
    unmount();
    renderWithProviders(<Harness initial={chosen} others={[customer]} />);
    expect(await screen.findByRole("combobox", { name: "es" })).not.toBeDisabled();
  });

  it("says that a fourth condition in a row does not reach WhatsApp", () => {
    const paid: DraftQuestion = { localId: "paid", fieldId: null, replacesFieldId: null, type: "boolean", label: { es: "¿Pagó?" }, help: null, required: false };
    const second = { ...paid, localId: "second", showWhen: { questionId: "paid", values: ["true"] } };
    const third = { ...paid, localId: "third", showWhen: { questionId: "second", values: ["true"] } };
    const fourth = { ...paid, localId: "fourth", showWhen: { questionId: "third", values: ["true"] } };
    const deep = { ...from, showWhen: { questionId: "fourth", values: ["true"] } };
    const { unmount } = renderWithProviders(<Harness initial={deep} others={[paid, second, third, fourth]} whatsApp />);
    expect(screen.getByRole("alert")).toHaveTextContent("En WhatsApp, una pregunta puede depender de otra hasta tres veces seguidas: elegí otra pregunta, o «Sólo en la app».");
    unmount();
    renderWithProviders(<Harness initial={deep} others={[paid, second, third, fourth]} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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
