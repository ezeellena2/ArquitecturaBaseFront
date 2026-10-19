import userEvent from "@testing-library/user-event";
import { act, screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, expect, it } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import i18n from "@/shared/i18n";
import { fixtureDefinition } from "@/test/visual/formFixtures";
import { openDraftSession } from "../draftSession";
import { FormPreview } from "./FormPreview";
import type { DraftEditorValue, DraftQuestion } from "../model";

it("shows a catalog question without resolving or offering options", async () => {
  const value: DraftEditorValue = { offerWhen: null, name: { es: "Visita" }, prefix: "VIS", draft: { format: 1, culture: "es", submitLabel: { es: "Enviar" }, fields: [{ localId: "catalog", fieldId: null, replacesFieldId: null, type: "choice", source: { catalog: "01990000-0000-7000-8000-000000000091" }, label: { es: "Cliente" }, help: null, required: true }] } };
  await act(async () => { renderWithProviders(<FormPreview value={value} culture="es" />); });
  const question = screen.getByRole("combobox", { name: "Cliente" });
  expect(question).toBeDisabled(); expect(within(question).getAllByRole("option")).toHaveLength(1);
  expect(screen.getByText("Las opciones se preparan según quien lo recibe, al mandar el formulario.")).toBeInTheDocument();
});

beforeAll(async () => { await i18n.loadLanguages(["es", "en"]); });
beforeEach(async () => { await i18n.changeLanguage("es"); });
function completePreview(original: "es" | "en"): DraftEditorValue {
  const definition = fixtureDefinition(original);
  return openDraftSession({ actorId: "actor", editorId: "preview" }, { ...definition, draft: { ...definition.draft, fields: definition.draft.fields.map(field => field.type === "longText" ? { ...field, help: { es: "Contá lo que pasó.", en: "Describe what happened." } } : field) } }).value;
}
function untranslated(value: DraftEditorValue, culture: "es" | "en", target: "name" | "button" | "question" | "help" | "option"): DraftEditorValue {
  if (target === "name") return { ...value, name: { ...value.name, [culture]: " " } };
  if (target === "button") return { ...value, draft: { ...value.draft, submitLabel: { ...value.draft.submitLabel, [culture]: "" } } };
  return { ...value, draft: { ...value.draft, fields: value.draft.fields.map(field => target === "question" && field.type === "shortText" ? { ...field, label: { ...field.label, [culture]: "" } }
    : target === "help" && field.type === "longText" ? { ...field, help: { ...field.help, [culture]: null } }
    : target === "option" && field.type === "choice" && !field.source ? { ...field, options: field.options.map((option, index) => index === 0 ? { ...option, label: { ...option.label, [culture]: "" } } : option) } : field) } };
}
for (const original of ["es", "en"] as const) for (const target of ["name", "button", "question", "help", "option"] as const) {
  it("previews everything in " + original + " until the secondary " + target + " is translated, then switches everything", async () => {
    const secondary = original === "es" ? "en" : "es";
    const complete = completePreview(original);
    const partial = untranslated(complete, secondary, target);
    const before = JSON.stringify(partial);
    let view!: ReturnType<typeof renderWithProviders>;
    await act(async () => { view = renderWithProviders(<FormPreview value={partial} culture={secondary} />); });
    const preview = screen.getByRole("region", { name: "Vista previa" });
    expect(within(preview).getByText(original === "es" ? "Registrar visita" : "Register visit")).toBeInTheDocument();
    expect(within(preview).getByRole("radio", { name: original === "es" ? "Sí" : "Yes" })).toBeInTheDocument();
    expect(within(preview).queryByRole("radio", { name: secondary === "es" ? "Sí" : "Yes" })).not.toBeInTheDocument();
    expect(within(preview).getByRole("textbox", { name: original === "es" ? "Contacto" : "Contact" })).toBeInTheDocument();
    expect(within(preview).getByText(original === "es" ? "Contá lo que pasó." : "Describe what happened.")).toBeInTheDocument();
    expect(within(preview).getByRole("option", { name: original === "es" ? "Distribuidora Norte" : "North distributor" })).toBeInTheDocument();
    expect(within(preview).getByRole("button", { name: original === "es" ? "Confirmar visita" : "Confirm visit" })).toBeInTheDocument();
    expect(within(preview).queryByText(/Traducción pendiente|Translation pending/)).not.toBeInTheDocument();
    expect(JSON.stringify(partial)).toBe(before);
    expect(i18n.language).toBe("es");
    await act(async () => { view.rerender(<FormPreview value={complete} culture={secondary} />); });
    expect(within(preview).getByText(secondary === "es" ? "Registrar visita" : "Register visit")).toBeInTheDocument();
    expect(within(preview).getByRole("radio", { name: secondary === "es" ? "Sí" : "Yes" })).toBeInTheDocument();
    expect(within(preview).getByRole("textbox", { name: secondary === "es" ? "Contacto" : "Contact" })).toBeInTheDocument();
    expect(within(preview).getByRole("button", { name: secondary === "es" ? "Confirmar visita" : "Confirm visit" })).toBeInTheDocument();
  });
}

for (const original of ["es", "en"] as const) it("uses one " + original + " culture for all file screens when a later document is untranslated", async () => {
  const secondary = original === "es" ? "en" : "es";
  const initial = completePreview(original);
  const photo: DraftQuestion = { localId: "photo", fieldId: null, replacesFieldId: null, type: "photo", label: { es: "Foto", en: "Photo" }, help: null, required: false, files: { minFiles: 0, maxFiles: 1, photoSource: "camera" } };
  const document: DraftQuestion = { localId: "document", fieldId: null, replacesFieldId: null, type: "document", label: { es: "Comprobante", en: "Receipt" }, help: null, required: false, files: { minFiles: 0, maxFiles: 1 } };
  const complete: DraftEditorValue = { ...initial, draft: { ...initial.draft, fields: [...initial.draft.fields, photo, document] } };
  const partial = { ...complete, draft: { ...complete.draft, fields: [...initial.draft.fields, photo, { ...document, label: { ...document.label, [secondary]: "" } }] } };
  let view!: ReturnType<typeof renderWithProviders>;
  await act(async () => { view = renderWithProviders(<FormPreview value={partial} culture={secondary} />); });
  const preview = screen.getByRole("region", { name: "Vista previa" });
  expect(preview.querySelector("[lang]")).toHaveAttribute("lang", original);
  expect(within(preview).getByText(original === "es" ? "Fecha sin hora." : "Date without a time.")).toBeInTheDocument();
  expect(within(preview).getByText(original === "es" ? "Vista previa · pantalla 1 de 3" : "Preview · screen 1 of 3")).toBeInTheDocument();
  await userEvent.click(within(preview).getByRole("button", { name: original === "es" ? "Continuar" : "Continue" }));
  expect(within(preview).getByRole("button", { name: original === "es" ? "Sacar foto" : "Take photo" })).toBeInTheDocument();
  expect(within(preview).getByRole("button", { name: original === "es" ? "Pantalla anterior" : "Previous screen" })).toBeEnabled();
  await userEvent.click(within(preview).getByRole("button", { name: original === "es" ? "Continuar" : "Continue" }));
  expect(within(preview).getByRole("button", { name: original === "es" ? "Adjuntar documento" : "Attach document" })).toBeInTheDocument();
  await act(async () => { view.rerender(<FormPreview value={complete} culture={secondary} />); });
  expect(preview.querySelector("[lang]")).toHaveAttribute("lang", secondary);
  expect(within(preview).getByRole("button", { name: secondary === "es" ? "Adjuntar documento" : "Attach document" })).toBeInTheDocument();
  expect(within(preview).getByRole("button", { name: secondary === "es" ? "Confirmar visita" : "Confirm visit" })).toBeInTheDocument();
});

it("does not treat optional help absent in both cultures as an incomplete translation", async () => {
  const complete = completePreview("es");
  const value = { ...complete, draft: { ...complete.draft, fields: complete.draft.fields.map(field => field.type === "longText" ? { ...field, help: { es: null, en: null } } : field) } };
  await act(async () => { renderWithProviders(<FormPreview value={value} culture="en" />); });
  const preview = screen.getByRole("region", { name: "Vista previa" });
  expect(within(preview).getByRole("radio", { name: "Yes" })).toBeInTheDocument();
  expect(preview.querySelector("[lang]")).toHaveAttribute("lang", "en");
  expect(within(preview).queryByText(/le falta/)).not.toBeInTheDocument();
});

it("keeps original placeholders when authored text contains only whitespace", async () => {
  const value: DraftEditorValue = { offerWhen: null, name: { es: "   " }, prefix: "VIS", draft: { format: 1, culture: "es", submitLabel: { es: "  " }, fields: [{ localId: "question", fieldId: null, replacesFieldId: null, type: "shortText", label: { es: "  " }, help: null, required: false, maxLength: 80 }] } };
  await act(async () => { renderWithProviders(<FormPreview value={value} culture="es" />); });
  const preview = screen.getByRole("region", { name: "Vista previa" });
  expect(within(preview).getByText("Nuevo formulario")).toBeInTheDocument();
  expect(within(preview).getByRole("textbox", { name: "Pregunta" })).toBeInTheDocument();
  expect(within(preview).getByRole("button", { name: "Texto del botón final" })).toBeInTheDocument();
});
