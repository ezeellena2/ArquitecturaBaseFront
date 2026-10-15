import { formScreens } from "./fileQuestions";
import { act, fireEvent, screen, within } from "@testing-library/react";
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
  const response = { ...detail, definition: { ...detail.definition, draft: { ...detail.definition.draft, fields: [{
    fieldId, key: "field_" + fieldId.replaceAll("-", ""), type: "photo", label: { es: "Fotos", en: "Photos" }, help: null,
    required: true, maxLength: null, options: null, files: { minFiles: 1, maxFiles: 4, photoSource: "camera" },
  }] } } };
  const saved = readFormDetail(response).definition;
  expect(openDraftSession({ actorId: "actor", editorId: "reload" }, saved).value.draft.fields[0]).toMatchObject({ files: { minFiles: 1, maxFiles: 4, photoSource: "camera" } });
});

it("shows disabled photo and document choices when storage is unavailable", async () => {
  await act(async () => { renderWithProviders(<QuestionEditor question={newQuestion("shortText", "es", "a")} position={1} total={1} culture="es" original="es" expanded readOnly={false} issues={[]} onChange={() => {}} onExpand={() => {}} onMove={() => {}} onRemove={() => {}} />); });
  expect(screen.getByRole("option", { name: /Foto/ })).toBeDisabled();
  expect(screen.getByRole("option", { name: /Documento/ })).toBeDisabled();
});

it("previews one new screen for each file question and keeps following scalar questions with it", async () => {
  const fields = [newQuestion("shortText", "es", "customer"), newQuestion("photo", "es", "photo"), newQuestion("document", "es", "document"), newQuestion("longText", "es", "comments")];
  await act(async () => { renderWithProviders(<FormPreview culture="es" value={{ name: { es: "Visita" }, prefix: "VIS", draft: { format: 1, culture: "es", submitLabel: { es: "Confirmar" }, fields } }} />); });
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
  expect(screen.getByRole("option", { name: "Foto" })).toBeEnabled();
  expect(screen.getByRole("option", { name: "Documento" })).toBeEnabled();
  fireEvent.change(screen.getByRole("combobox", { name: "Tipo de respuesta" }), { target: { value: type } });
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ type, files: expect.objectContaining({ minFiles: 0, maxFiles: 1 }) }));
});
