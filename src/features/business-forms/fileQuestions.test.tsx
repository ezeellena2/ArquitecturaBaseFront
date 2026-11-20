import { formScreens } from "./fileQuestions";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { FormPreview } from "./components/FormPreview";
import { QuestionEditor } from "./components/QuestionEditor";
import { newQuestion } from "./editorModel";
import { openDraftSession } from "./draftSession";
import { readFormDetail } from "./api/response";
import detail from "@/test/fixtures/forms-http/published/detail-es.json";

it("starts photo questions with camera or gallery and preserves file settings after a reload", () => {
  const question = newQuestion("photo", "es", "photo");
  expect(question).toMatchObject({ type: "photo", files: { minFiles: 0, maxFiles: 1, photoSource: "cameraOrGallery" } });
  const fieldId = "01990000-0000-7000-8000-000000000111";
  const response = { ...detail, definition: { ...detail.definition, offerWhen: null, draft: { ...detail.definition.draft, fields: [{
    fieldId, key: "field_" + fieldId.replaceAll("-", ""), type: "photo", label: { es: "Fotos", en: "Photos" }, help: null,
    required: true, maxLength: null, options: null, files: { minFiles: 1, maxFiles: 4, photoSource: "camera" },
  }] } } };
  const saved = readFormDetail(response).definition;
  expect(openDraftSession({ actorId: "actor", editorId: "reload" }, saved).value.draft.fields[0]).toMatchObject({ files: { minFiles: 1, maxFiles: 4, photoSource: "camera" } });
});

it("reads a saved document with photoSource null and rejects one without it, which the server always writes", () => {
  const fieldId = "01990000-0000-7000-8000-000000000112";
  const withFiles = (files: object) => ({ ...detail, definition: { ...detail.definition, offerWhen: null, draft: { ...detail.definition.draft, fields: [{
    fieldId, key: "field_" + fieldId.replaceAll("-", ""), type: "document", label: { es: "Remito", en: "Delivery note" }, help: null,
    required: false, maxLength: null, options: null, files,
  }] } } });
  expect(readFormDetail(withFiles({ minFiles: 0, maxFiles: 1, photoSource: null })).definition.draft.fields[0]).toMatchObject({ files: { minFiles: 0, maxFiles: 1, photoSource: null } });
  expect(() => readFormDetail(withFiles({ minFiles: 0, maxFiles: 1 }))).toThrow("Unsupported form response.");
});

it("shows disabled photo and document choices when storage is unavailable", async () => {
  await act(async () => { renderWithProviders(<QuestionEditor question={newQuestion("shortText", "es", "a")} position={1} total={1} culture="es" original="es" expanded readOnly={false} issues={[]} onChange={() => {}} onExpand={() => {}} onMove={() => {}} onRemove={() => {}} />); });
  const types = await openList(/^Tipo de respuesta /);
  expect(within(types).getByRole("option", { name: "Foto" })).toHaveAttribute("aria-disabled", "true");
  expect(within(types).getByRole("option", { name: "Documento" })).toHaveAttribute("aria-disabled", "true");
});

it("previews one new screen for each file question and keeps following scalar questions with it", async () => {
  const fields = [newQuestion("shortText", "es", "customer"), newQuestion("photo", "es", "photo"), newQuestion("document", "es", "document"), newQuestion("longText", "es", "comments")];
  await act(async () => { renderWithProviders(<FormPreview culture="es" value={{ offerWhen: null, name: { es: "Visita" }, prefix: "VIS", draft: { format: 1, culture: "es", submitLabel: { es: "Confirmar" }, fields } }} />); });
  expect(screen.getByText("Vista previa · pantalla 1 de 3")).toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Vista previa" })).getByRole("button", { name: "Continuar" })).toBeEnabled();
});

it("partitions screens without mutating questions or inventing empty intermediate screens", () => {
  const questions = Object.freeze([newQuestion("shortText", "es", "scalar"), newQuestion("photo", "es", "photo"),
    newQuestion("document", "es", "document"), newQuestion("longText", "es", "notes")]);
  const result = formScreens(questions);
  expect(result.map(screen => screen.map(question => question.localId))).toEqual([["scalar"], ["photo"], ["document", "notes"]]);
  expect(result.flat()).toEqual(questions);
  expect(result[1]![0]).toBe(questions[1]);
  expect(formScreens([])).toEqual([[]]);
  expect(formScreens([questions[1]!, questions[2]!]).map(screen => screen.length)).toEqual([1, 1]);
});
it.each(["photo", "document"] as const)("enables %s when form-files is available and creates its settings", async type => {
  const onChange = vi.fn();
  await act(async () => { renderWithProviders(<QuestionEditor question={newQuestion("shortText", "es", "a")} position={1} total={1}
    culture="es" original="es" expanded readOnly={false} issues={[]} onChange={onChange} onExpand={() => {}} onMove={() => {}} onRemove={() => {}} filesAvailable />); });
  const types = await openList(/^Tipo de respuesta /);
  expect(within(types).getByRole("option", { name: "Foto" })).not.toHaveAttribute("aria-disabled");
  expect(within(types).getByRole("option", { name: "Documento" })).not.toHaveAttribute("aria-disabled");
  await userEvent.click(within(types).getByRole("option", { name: type === "photo" ? "Foto" : "Documento" }));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ type, files: expect.objectContaining({ minFiles: 0, maxFiles: 1 }) }));
});

// The Picker opens with the keyboard, like the other Radix lists in the tests; its button says the label and the chosen one.
async function openList(trigger: string | RegExp | HTMLElement) {
  const button = trigger instanceof HTMLElement ? trigger : screen.getByRole("button", { name: trigger });
  await act(async () => { button.focus(); });
  await userEvent.keyboard("{Enter}");
  return screen.findByRole("listbox");
}
