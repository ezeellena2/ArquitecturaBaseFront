import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
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

    // «Se muestra» is the only piece to choose (DS1-A, 2026-11-22), with its (i).
    expect(screen.getByRole("button", { name: "Se muestra Siempre" })).toHaveAccessibleDescription(expect.stringContaining("Según la respuesta de una pregunta anterior"));
    expect(screen.queryByRole("button", { name: /^Si / })).not.toBeInTheDocument();
    await pick("Se muestra Siempre", "Según otra respuesta");
    expect(screen.getByTestId("line")).toHaveTextContent("Según otra respuesta");
    // «Si» is the only piece to choose (DS1-A): its list opens with the keyboard.
    await act(async () => { screen.getByRole("button", { name: "Si Elegí una pregunta" }).focus(); });
    await user.keyboard("{Enter}");
    await user.click(within(await screen.findByRole("listbox", { name: "Si" })).getByRole("option", { name: /^Concepto/ }));
    expect(screen.getByRole("button", { name: /^Si Concepto/ })).toBeInTheDocument();

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

    await pick("Se muestra Según otra respuesta", "Siempre");
    expect(screen.queryByRole("button", { name: /^Si / })).not.toBeInTheDocument();
    expect(screen.getByTestId("line")).toBeEmptyDOMElement();
  });

  it("says why «Según otra respuesta» is off without an earlier question to name", async () => {
    renderWithProviders(<Harness initial={from} others={[]} />);
    const byAnswer = within(await openList("Se muestra Siempre")).getByRole("option", { name: "Según otra respuesta" });
    expect(byAnswer).toHaveAttribute("aria-disabled", "true");
    expect(byAnswer).toHaveAccessibleDescription("No hay antes una pregunta de elegir una o de sí o no, afuera del bloque.");
    await userEvent.keyboard("{Escape}");
  });

  // The piece calls back also with the option it has: choosing it again keeps the question and the answers.
  it("keeps the condition when the option it has is chosen again", async () => {
    const onChange = vi.fn();
    const shown = { ...from, showWhen: { questionId: "concept", values: ["services"] } };
    renderWithProviders(<ConditionSettings question={shown} questions={[concept, shown]} culture="es" original="es" readOnly={false} scope={scope} onChange={onChange} />);
    await pick("Se muestra Según otra respuesta", "Según otra respuesta");
    expect(onChange).not.toHaveBeenCalled();
  });

  // What WhatsApp cannot publish is stopped or said here, in a form that goes through it; «Sólo en la app» takes it all.
  it("takes one answer of a catalog question in a form that goes through WhatsApp, with its reason in the (i)", async () => {
    const customer: DraftQuestion = { localId: "customer", fieldId: null, replacesFieldId: null, type: "choice", label: { es: "Cliente" }, help: null, required: true,
      source: { catalog: "customers" } };
    const other = "0199b000-0000-7000-8000-000000000001";
    server.use(http.get("/api/forms/catalogs/:id/items", () => HttpResponse.json({ items: [{ id: other, code: "other", text: { es: "Otro" }, detail: null, value: null, isActive: true, position: 1, fields: {} }],
      page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false })));
    const chosen = { ...from, showWhen: { questionId: "customer", values: [other] } };
    const { unmount } = renderWithProviders(<Harness initial={chosen} others={[customer]} whatsApp />);
    // «es» is the only piece to choose several: in WhatsApp its list takes one, «Elegiste 1 de 1», and the (i) says why.
    const answers = await screen.findByRole("button", { name: /^es / });
    expect(answers).toHaveAccessibleDescription(expect.stringContaining("En WhatsApp, una pregunta de catálogo se compara con una sola respuesta."));
    await act(async () => { answers.focus(); });
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("listbox", { name: "es" })).toHaveAttribute("aria-multiselectable", "true");
    expect(screen.getByText("Elegiste 1 de 1")).toBeInTheDocument();
    unmount();
    renderWithProviders(<Harness initial={chosen} others={[customer]} />);
    const several = await screen.findByRole("button", { name: /^es / });
    expect(several).not.toHaveAccessibleDescription();
    await act(async () => { several.focus(); });
    await userEvent.keyboard("{Enter}");
    await screen.findByRole("listbox", { name: "es" });
    expect(screen.queryByText("Elegiste 1 de 1")).not.toBeInTheDocument();
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

// The Picker opens with the keyboard, like the other Radix lists in the tests; its button says the label and the chosen one.
async function openList(trigger: string | RegExp) {
  const button = screen.getByRole("button", { name: trigger });
  await act(async () => { button.focus(); });
  await userEvent.keyboard("{Enter}");
  return screen.findByRole("listbox");
}
async function pick(trigger: string | RegExp, option: string | RegExp) {
  await userEvent.click(within(await openList(trigger)).getByRole("option", { name: option }));
}
