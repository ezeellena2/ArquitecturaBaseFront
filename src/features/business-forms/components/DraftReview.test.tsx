import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { DraftReview } from "./DraftReview";
import { createDraftReview, resolveDraftReview } from "../editorModel";
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
  it("keeps allowed changes in one explicit action without extra decisions or saving", async () => {
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
    expect(onResolve).toHaveBeenCalledOnce();
    expect(Object.values(onResolve.mock.calls[0]![0])).toEqual(["mine", "mine"]);
    expect(within(dialog).queryByRole("combobox")).not.toBeInTheDocument();
  });
  it("explains a locked prefix without calling it a retired question", async () => {
    const value = { ...openDraftSession({ actorId: "actor", editorId: "editor" }, definition).value, prefix: "ENT" };
    await act(async () => { renderWithProviders(<DraftReview value={value} definition={definition} culture="es" open onOpenChange={vi.fn()} onUseCurrent={vi.fn()} onResolve={vi.fn()} />); });
    const dialog = screen.getByRole("dialog", { name: "Revisión del borrador" });
    expect(within(dialog).getByText("El prefijo quedó fijo cuando se aceptó la primera publicación, aunque después no se haya completado.")).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent("retirada");
  });
});

it("retains local edits, marks remote additions and cannot revive a remotely removed option or question", async () => {
  const before = { ...definition, draft: { ...definition.draft, fields: [...definition.draft.fields,
    { fieldId: "notes", key: "notes", type: "longText" as const, label: { es: "Observaciones" }, help: { es: "Antes" }, required: false, maxLength: 600 }] } };
  const local = openDraftSession({ actorId: "actor", editorId: "editor" }, before).value;
  const mine = { ...local, name: { es: "Mi visita" }, draft: { ...local.draft, fields: local.draft.fields.map(q => q.type === "choice"
    ? { ...q, options: q.options.map(o => o.choiceId === "north" ? { ...o, label: { es: "Mi Norte" } } : o) }
    : { ...q, help: { es: "Mi ayuda" } }) } };
  const remote = { ...definition, revision: 3, draft: { ...definition.draft, fields: [
    { ...definition.draft.fields[0]!, options: definition.draft.fields[0]!.type === "choice" ? definition.draft.fields[0]!.options.slice(0, 1) : [] },
    { fieldId: "date", key: "date", type: "date" as const, label: { es: "Fecha agregada por otra persona" }, help: null, required: true }] } };
  const onResolve = vi.fn();
  await act(async () => { renderWithProviders(<DraftReview value={mine} definition={remote} culture="es" open onOpenChange={vi.fn()} onUseCurrent={vi.fn()} onResolve={onResolve} />); });
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveTextContent("Mi ayuda");
  expect(dialog).toHaveTextContent("Fecha agregada por otra persona");
  expect(dialog).toHaveTextContent("ya fue retirada");
  await userEvent.click(within(dialog).getByRole("button", { name: "Conservar mis cambios" }));
  const resolved = resolveDraftReview(createDraftReview(mine, remote), onResolve.mock.calls[0]![0])!;
  expect(resolved.name.es).toBe("Mi visita");
  expect(resolved.draft.fields.some(q => q.fieldId === "notes")).toBe(false);
  const customer = resolved.draft.fields.find(q => q.fieldId === "customer")!;
  expect(customer.type === "choice" && customer.options.map(o => o.choiceId)).toEqual(["north"]);
  expect(customer.type === "choice" && customer.options[0]!.label.es).toBe("Mi Norte");
});
