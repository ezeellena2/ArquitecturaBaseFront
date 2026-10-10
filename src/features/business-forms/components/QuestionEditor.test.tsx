import { useState } from "react";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { QuestionEditor } from "./QuestionEditor";
import { moveItem } from "../editorModel";
import type { DraftQuestion } from "../model";

const first: DraftQuestion = { localId: "a", fieldId: "field-a", replacesFieldId: null, type: "choice", label: { es: "Cliente" }, help: null, required: true,
  options: [{ localId: "north", choiceId: "north", label: { es: "Norte" } }, { localId: "south", choiceId: "south", label: { es: "Sur" } }] };
const second: DraftQuestion = { localId: "b", fieldId: "field-b", replacesFieldId: null, type: "date", label: { es: "Fecha" }, help: null, required: true };
function Harness({ expandedInitially = false, readOnly = false }: { expandedInitially?: boolean; readOnly?: boolean }) {
  const [questions, setQuestions] = useState<readonly DraftQuestion[]>([first, second]);
  const [expanded, setExpanded] = useState<string | null>(expandedInitially ? "a" : null);
  return <>{questions.map((question, index) => <QuestionEditor key={question.localId} question={question} position={index + 1} total={questions.length}
    culture="es" original="es" expanded={expanded === question.localId} readOnly={readOnly} issues={[]}
    onChange={next => setQuestions(old => old.map(q => q.localId === next.localId ? next : q))}
    onExpand={open => setExpanded(open ? question.localId : null)} onMove={delta => setQuestions(old => moveItem(old, index, delta))} onRemove={() => {}} />)}</>;
}
async function mount(props?: Parameters<typeof Harness>[0]) { await act(async () => { renderWithProviders(<Harness {...props} />); }); }
it("clears original help explicitly while preserving the other language and field identity", async () => {
  const question = { ...first, help: { es: "Detalle", en: "Details" } };
  const onChange = vi.fn();
  await act(async () => { renderWithProviders(<QuestionEditor question={question} position={1} total={1}
    culture="es" original="es" expanded readOnly={false} issues={[]} onChange={onChange}
    onExpand={() => {}} onMove={() => {}} onRemove={() => {}} />); });
  await userEvent.clear(screen.getByLabelText("Ayuda para el empleado"));
  expect(onChange).toHaveBeenLastCalledWith({ ...question, help: { es: null, en: "Details" } });
});

describe("Question movement", () => {
  it("announces the new position and keeps keyboard focus when a question reaches the boundary", async () => {
    await mount();
    await userEvent.click(screen.getByRole("button", { name: "Bajar Cliente" }));
    expect(screen.getByRole("button", { name: "Subir Cliente" })).toHaveFocus();
    expect(screen.getAllByRole("status").some(status => status.textContent?.includes("Cliente: posición 2 de 2"))).toBe(true);
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Bajar Cliente" })).toHaveFocus();
    expect(screen.getAllByRole("status").some(status => status.textContent?.includes("Cliente: posición 1 de 2"))).toBe(true);
  });
  it("announces option movement and restores focus to an enabled control of that option", async () => {
    await mount({ expandedInitially: true });
    await userEvent.click(screen.getByRole("button", { name: "Bajar Norte" }));
    expect(screen.getByRole("button", { name: "Subir Norte" })).toHaveFocus();
    expect(screen.getAllByRole("status").some(status => status.textContent?.includes("Norte: posición 2 de 2"))).toBe(true);
    expect(within(screen.getByLabelText("Opción 2").closest("div")!).getByRole("textbox")).toHaveValue("Norte");
  });
});

it("returns focus to the row action after Done collapses the question", async () => {
  await mount({ expandedInitially: true });
  await userEvent.click(screen.getByRole("button", { name: "Listo" }));
  expect(screen.getByRole("button", { name: "Editar Cliente" })).toHaveFocus();
});

it("offers read-only inspection without reorder or edit actions", async () => {
  await mount({ readOnly: true });
  expect(screen.queryByRole("button", { name: /^(Subir|Bajar|Editar|Quitar)/ })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Ver pregunta Cliente" }));
  expect(screen.getByLabelText("Pregunta")).toHaveAttribute("readonly");
});

it("focuses a neighboring option and then Add option when the last option is removed", async () => {
  await mount({ expandedInitially: true });
  await userEvent.click(screen.getByRole("button", { name: "Quitar Opción 2" }));
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Quitar opción" }));
  expect(screen.getByLabelText("Opción 1")).toHaveFocus();
  await userEvent.click(screen.getByRole("button", { name: "Quitar Opción 1" }));
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Quitar opción" }));
  expect(screen.getByRole("button", { name: "Agregar opción" })).toHaveFocus();
});
