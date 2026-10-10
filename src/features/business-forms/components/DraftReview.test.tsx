import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { DraftReview } from "./DraftReview";
import { openDraftSession } from "../draftSession";
import type { FormDefinitionSnapshot } from "../model";

const definition: FormDefinitionSnapshot = {
  id: "form", name: { es: "Visita" }, prefix: "VIS", prefixLocked: true, revision: 2,
  draft: { format: 1, culture: "es", submitLabel: { es: "Enviar" }, fields: [
    { fieldId: "customer", key: "customer", type: "choice", label: { es: "Cliente" }, help: null, required: true,
      options: [{ choiceId: "north", label: { es: "Norte" } }, { choiceId: "south", label: { es: "Sur" } }] },
  ] },
};
describe("Draft review presentation", () => {
  it("shows changed options and their order with labels and requires a decision for each", async () => {
    const saved = openDraftSession({ actorId: "actor", editorId: "editor" }, definition).value;
    const value = { ...saved, draft: { ...saved.draft, fields: saved.draft.fields.map(q => q.type === "choice"
      ? { ...q, options: [...q.options].reverse().map(o => o.choiceId === "north" ? { ...o, label: { es: "Norte actualizado" } } : o) } : q) } };
    const onResolve = vi.fn();
    await act(async () => { renderWithProviders(<DraftReview value={value} definition={definition} culture="es" open onOpenChange={vi.fn()} onUseCurrent={vi.fn()} onResolve={onResolve} />); });
    const dialog = screen.getByRole("dialog", { name: "Revisión del borrador" });
    expect(within(dialog).getByRole("cell", { name: "Cliente · Opción: Norte actualizado · Español" })).toBeInTheDocument();
    expect(within(dialog).getByRole("cell", { name: "Orden de opciones de Cliente" })).toBeInTheDocument();
    expect(within(dialog).getByRole("cell", { name: "Norte → Sur" })).toBeInTheDocument();
    expect(within(dialog).getByRole("cell", { name: "Sur → Norte actualizado" })).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent("[object Object]");
    expect(dialog).not.toHaveTextContent("choiceId");
    await userEvent.click(within(dialog).getByRole("button", { name: "Conservar mis cambios" }));
    expect(within(dialog).getByRole("button", { name: "Terminar la revisión" })).toBeDisabled();
    const options = within(dialog).getAllByRole("combobox");
    await userEvent.selectOptions(options[0]!, "mine");
    expect(within(dialog).getByRole("button", { name: "Terminar la revisión" })).toBeDisabled();
    await userEvent.selectOptions(options[1]!, "current");
    await userEvent.click(within(dialog).getByRole("button", { name: "Terminar la revisión" }));
    expect(onResolve).toHaveBeenCalledOnce();
  });
  it("explains a locked prefix without calling it a retired question", async () => {
    const value = { ...openDraftSession({ actorId: "actor", editorId: "editor" }, definition).value, prefix: "ENT" };
    await act(async () => { renderWithProviders(<DraftReview value={value} definition={definition} culture="es" open onOpenChange={vi.fn()} onUseCurrent={vi.fn()} onResolve={vi.fn()} />); });
    const dialog = screen.getByRole("dialog", { name: "Revisión del borrador" });
    expect(within(dialog).getByText("El prefijo quedó fijo cuando se aceptó la primera publicación, aunque después no se haya completado.")).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent("retirada");
  });
});
