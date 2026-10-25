import userEvent from "@testing-library/user-event";
import i18n from "@/shared/i18n";
import { ApiError } from "@/shared/api/ApiError";
import type { FormPublicationCheck } from "../api/response";
import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { fixtureDefinition } from "@/test/visual/formFixtures";
import { openDraftSession } from "../draftSession";
import { PublicationCheckDialog } from "./PublicationCheckDialog";

const definition = fixtureDefinition();
const value = openDraftSession({ actorId: "actor", editorId: "editor" }, definition).value;
const checked: FormPublicationCheck = { definitionId: definition.id, draftRevision: 1, nextVersionNumber: 3, compatibility: "LocallyValidated", canAccept: true,
  acceptanceAvailability: "Available", checkToken: "synthetic-ticket", checkExpiresAtUtc: "2099-10-10T16:00:00Z", warnings: [], channels: [{ channelId: "phone", profileRevision: "1", compatibility: "LocallyValidated", externalEvidence: "Pending", cultures: ["es", "en"] }], issues: [],
  cultures: [{ culture: "es", isOriginal: true, isComplete: true, missing: [] }, { culture: "en", isOriginal: false, isComplete: true, missing: [] }],
  diff: { baseVersionId: "previous", added: [definition.draft.fields[0]!.fieldId], changed: [definition.draft.fields[1]!.fieldId], removed: ["retired"], addedCultures: [], removedCultures: [] } };
let result = checked;
// A failed check has no result.
let error: unknown = null;
vi.mock("../hooks/useFormPublicationCheck", () => ({ useFormPublicationCheck: () => ({ result: error ? null : result, busy: false, error, check: vi.fn() }) }));
beforeEach(async () => { await i18n.changeLanguage("es"); result = structuredClone(checked); error = null; onGoToIssue.mockClear(); onCompleteTranslation.mockClear(); });
const onGoToIssue = vi.fn();
const onCompleteTranslation = vi.fn();
// The scope carries the menu language, as in the editor.
async function mount(permissions = ["formtemplates.read", "formtemplates.publish"], editorValue = value) { await act(async () => { renderWithProviders(<PublicationCheckDialog scope={{ actorId: "actor", culture: i18n.language.startsWith("en") ? "en" : "es", permissions }}
  id={definition.id} revision={1} value={editorValue} dirty={false} canSave accepting={false} savedAt="2026-10-10 15:20" prefixLocked baseVersionId="previous" baseVersionNumber={1}
  onAccept={vi.fn()} onOpenChange={vi.fn()} onSave={vi.fn()} onConflict={vi.fn()} onGoToIssue={onGoToIssue} onCompleteTranslation={onCompleteTranslation} />); }); }
describe("Chosen publication boards I2/I3", () => {
  it("shows the checked next version, previous diff and saved draft without locking the prefix again", async () => {
    await mount();
    expect(screen.getByRole("dialog", { name: "Publicar la versión 3 en WhatsApp" })).toHaveAccessibleDescription(/Se publica el borrador guardado el 2026-10-10 15:20\.$/);
    expect(screen.getByRole("button", { name: "Publicar versión 3" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Qué cambia respecto de la versión 1" })).toBeInTheDocument();
    expect(screen.queryByText(/El prefijo VIS queda fijo al aceptar/)).not.toBeInTheDocument();
    expect(screen.getByText("Agregadas: Cliente")).toBeInTheDocument();
    expect(screen.getByText("Cambiadas: Contacto")).toBeInTheDocument();
    expect(screen.getByText("1 pregunta quitada")).toBeInTheDocument();
  });
  // The saved date says what is published: it goes in the description, not as a text beside the footer buttons.
  it("keeps the saved date out of the footer", async () => {
    await mount();
    const dialog = screen.getByRole("dialog", { name: "Publicar la versión 3 en WhatsApp" });
    expect(dialog).toHaveAccessibleDescription(/Se publica el borrador guardado el 2026-10-10 15:20\.$/);
    expect(dialog.querySelector("[data-slot='dialog-footer']")).not.toHaveTextContent("2026-10-10 15:20");
  });
  it("does not label a newer diff with the stale active version number", async () => {
    result = { ...checked, diff: { ...checked.diff, baseVersionId: "newer-active" } };
    await mount();
    expect(screen.queryByRole("heading", { name: "Qué cambia respecto de la versión 1" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Qué cambia respecto de la versión publicada" })).toBeInTheDocument();
    expect(screen.getByText("Agregadas: Cliente")).toBeInTheDocument();
    expect(value.name).toEqual({ es: "Registrar visita", en: "Register visit" });
  });
  it("keeps channel impediments blocking", async () => {
    result = { ...checked, canAccept: false, issues: [
      { channelId: "phone", fieldId: null, choiceId: null, path: "channel", code: "WhatsApp.Flow.NotReady", message: "Completá la conexión.", limit: null, culture: null }] };
    await mount();
    expect(screen.getByRole("button", { name: "Publicar versión 3" })).toBeDisabled();
    expect(screen.getByText("El canal de publicación")).toBeInTheDocument();
    expect(screen.queryByText("El formulario")).not.toBeInTheDocument();
  });
});

// Completing a translation is offered with the menu in that language, the one it is edited in.
const completionTexts = {
  es: { published: { es: "En WhatsApp, en español", en: "En WhatsApp, en inglés" }, notPublished: { es: "El español no se publica.", en: "El inglés no se publica." }, help: "Cliente · la ayuda", publish: "Publicar versión 3", complete: { es: "Completar el español", en: "Completar el inglés" } },
  en: { published: { es: "On WhatsApp, in Spanish", en: "On WhatsApp, in English" }, notPublished: { es: "Spanish is not published.", en: "English is not published." }, help: "Customer · help", publish: "Publish version 3", complete: { es: "Complete Spanish", en: "Complete English" } },
} as const;
for (const original of ["es", "en"] as const) {
  const secondary = original === "es" ? "en" : "es";
  const texts = completionTexts[secondary];
  it("allows publication with incomplete " + secondary + " and offers completion only to Manage", async () => {
    await i18n.changeLanguage(secondary);
    const missing: FormPublicationCheck["issues"][number] = { channelId: null, fieldId: definition.draft.fields[0]!.fieldId, choiceId: null, path: "draft.fields[0].help." + secondary, code: "Forms.Publication.MissingTranslation", message: "Completá la ayuda.", limit: null, culture: secondary };
    result = { ...result, channels: [{ ...checked.channels[0]!, cultures: [original] }], cultures: [{ culture: original, isOriginal: true, isComplete: true, missing: [] }, { culture: secondary, isOriginal: false, isComplete: false, missing: [missing] }] };
    await mount(["formtemplates.read", "formtemplates.publish", "formtemplates.manage"], { ...value, draft: { ...value.draft, culture: original } });
    expect(screen.getByText(texts.published[original])).toBeInTheDocument();
    expect(screen.getByText(texts.notPublished[secondary])).toBeInTheDocument();
    expect(screen.getByText(texts.help)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: texts.publish })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: texts.complete[secondary] }));
    expect(onCompleteTranslation).toHaveBeenLastCalledWith(missing);
    expect(onGoToIssue).not.toHaveBeenCalled();
  });
}
it("shows optional omissions without a completion action for Publish-only", async () => {
  // The menu is in the missing language, so only the permission withholds the action.
  await i18n.changeLanguage("en");
  result = { ...result, cultures: [{ ...checked.cultures[0]! }, { culture: "en", isOriginal: false, isComplete: false, missing: [{ channelId: null, fieldId: null, choiceId: null, path: "name.en", code: "Forms.Publication.MissingTranslation", message: "Completá el nombre.", limit: null, culture: "en" }] }] };
  await mount();
  expect(screen.getByText("English is not published.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Complete English" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Publish version 3" })).toBeEnabled();
});
it("announces a complete bilingual publication using the checked channels", async () => {
  await mount();
  expect(screen.getByText("En WhatsApp, en español y en inglés")).toBeInTheDocument();
  expect(screen.queryByText(/no se publica/)).not.toBeInTheDocument();
});
it("shows the checked language addition", async () => {
  result = { ...result, diff: { ...checked.diff, addedCultures: ["en"], removedCultures: [] } };
  await mount();
  expect(screen.getByText("Se suma el inglés.")).toBeInTheDocument();
});
it("warns before removing a published language", async () => {
  result = { ...result, channels: [{ ...checked.channels[0]!, cultures: ["es"] }], diff: { ...checked.diff, addedCultures: [], removedCultures: ["en"] } };
  await mount();
  expect(screen.getByText("El inglés deja de publicarse.")).toBeInTheDocument();
  expect(screen.getByText("Desde la versión 3, las cuentas en inglés lo reciben en español.")).toBeInTheDocument();
});

it("renders the complete publication decision in English without changing content cultures", async () => {
  await i18n.changeLanguage("en");
  await mount();
  expect(screen.getByText("On WhatsApp, in Spanish and English")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Publish version 3" })).toBeEnabled();
});

function missingReport(count: number, culture: "es" | "en"): FormPublicationCheck["issues"] {
  return ["name", "draft.submitLabel", ...definition.draft.fields.map((_field, index) => "draft.fields[" + index + "].label")].slice(0, count).map((path, index) => ({ channelId: null, fieldId: index < 2 ? null : definition.draft.fields[index - 2]!.fieldId, choiceId: null, path: path + "." + culture, code: "Forms.Publication.MissingTranslation", message: "Synthetic untranslated text.", limit: null, culture }));
}
function incompleteReport(count: number, original: "es" | "en", removed: boolean) {
  const secondary = original === "es" ? "en" : "es";
  const missing = missingReport(count, secondary);
  result = { ...checked, channels: [{ ...checked.channels[0]!, cultures: [original] }], cultures: [{ culture: original, isOriginal: true, isComplete: true, missing: [] }, { culture: secondary, isOriginal: false, isComplete: false, missing }], diff: { ...checked.diff, removedCultures: removed ? [secondary] : [] } };
  return missing;
}
it.each([1, 3, 4, 8])("shows at most three optional omissions and the remaining count for %s texts", async count => {
  // English original with the menu in Spanish, the language that can be completed.
  incompleteReport(count, "en", false);
  await mount(["formtemplates.read", "formtemplates.publish", "formtemplates.manage"], { ...value, draft: { ...value.draft, culture: "en" } });
  const notice = screen.getByRole("status");
  expect(within(notice).getAllByRole("listitem")).toHaveLength(Math.min(count, 3));
  if (count > 3) expect(within(notice).getByText("y " + (count - 3) + " más")).toBeInTheDocument();
  else expect(within(notice).queryByText(/^y .* más$/)).not.toBeInTheDocument();
  const complete = within(notice).getByRole("button", { name: "Completar el español" });
  expect(complete.closest("p")).toBeNull();
  expect(screen.getByRole("button", { name: "Publicar versión 3" })).toBeEnabled();
});
for (const ui of ["es", "en"] as const) for (const original of ["es", "en"] as const) {
  it("merges the removal and omissions in one warning in " + ui + " with " + original + " original", async () => {
    await i18n.changeLanguage(ui);
    const secondary = original === "es" ? "en" : "es";
    const missing = incompleteReport(8, original, true);
    await mount(["formtemplates.read", "formtemplates.publish", "formtemplates.manage"], { ...value, draft: { ...value.draft, culture: original } });
    const notice = screen.getByRole("status");
    const languages = ui === "es" ? { es: "español", en: "inglés" } : { es: "Spanish", en: "English" };
    expect(within(notice).getByText(ui === "es" ? "El " + languages[secondary] + " deja de publicarse." : languages[secondary] + " will no longer be published.")).toBeInTheDocument();
    expect(within(notice).getByText(ui === "es" ? "Desde la versión 3, las cuentas en " + languages[secondary] + " lo reciben en " + languages[original] + "." : "From version 3, accounts in " + languages[secondary] + " receive it in " + languages[original] + ".")).toBeInTheDocument();
    expect(within(notice).getAllByRole("listitem")).toHaveLength(3);
    expect(within(notice).getByText(ui === "es" ? "y 5 más" : "and 5 more")).toBeInTheDocument();
    expect(screen.queryByText(ui === "es" ? "El " + languages[secondary] + " no se publica." : languages[secondary] + " is not published.")).not.toBeInTheDocument();
    // Only with the menu in the removed language does the warning offer to complete it.
    if (ui !== secondary) { expect(within(notice).queryByRole("button")).not.toBeInTheDocument(); return; }
    const complete = within(notice).getByRole("button", { name: ui === "es" ? "Completar el " + languages[secondary] : "Complete " + languages[secondary] });
    expect(complete.closest("p")).toBeNull();
    await userEvent.click(complete);
    expect(onCompleteTranslation).toHaveBeenCalledExactlyOnceWith(missing[0]);
  });
}
it("keeps one removal warning and its omissions without an editing action for Publish-only", async () => {
  // English original with the menu in Spanish, the removed language: only the permission withholds the action.
  incompleteReport(4, "en", true);
  await mount(undefined, { ...value, draft: { ...value.draft, culture: "en" } });
  const notice = screen.getByRole("status");
  expect(within(notice).getByText("El español deja de publicarse.")).toBeInTheDocument();
  expect(within(notice).getAllByRole("listitem")).toHaveLength(3);
  expect(within(notice).queryByRole("button")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Publicar versión 3" })).toBeEnabled();
});

it("offers to complete a translation only when the menu is in that language", async () => {
  const missing = incompleteReport(2, "es", false);
  await mount(["formtemplates.read", "formtemplates.publish", "formtemplates.manage"]);
  expect(screen.getByText("El inglés no se publica.")).toBeInTheDocument();
  expect(within(screen.getByRole("status")).getAllByRole("listitem")).toHaveLength(2);
  expect(screen.queryByRole("button", { name: "Completar el inglés" })).not.toBeInTheDocument();
  cleanup();
  await i18n.changeLanguage("en");
  await mount(["formtemplates.read", "formtemplates.publish", "formtemplates.manage"]);
  expect(screen.getByText("English is not published.")).toBeInTheDocument();
  await userEvent.click(within(screen.getByRole("status")).getByRole("button", { name: "Complete English" }));
  expect(onCompleteTranslation).toHaveBeenCalledExactlyOnceWith(missing[0]);
});

it("shows recipient diagnostics without disabling an otherwise publishable version", async () => {
  result = { ...checked, warnings: [{ fieldId: definition.draft.fields[0]!.fieldId, path: "draft.fields[0].source.match", code: "Forms.Publication.OptionsPerRecipientHigh", message: "Como mucho 18 opciones de 20.", limit: 20, maximum: 18 }, { fieldId: definition.draft.fields[0]!.fieldId, path: "draft.fields[0].source.match", code: "Forms.Publication.RecipientsWithoutData", message: "2 personas sin sucursal.", count: 2, people: ["Ana", "Luis"] }] };
  await mount();
  expect(screen.getByText("Como mucho 18 opciones de 20.")).toBeInTheDocument();
  expect(screen.getByText("2 personas sin sucursal.")).toBeInTheDocument();
  expect(screen.getByText("Ana, Luis")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Publicar versión 3" })).toBeEnabled();
});

it("says one option, not «1 opciones», for a maximum of one", async () => {
  const warning = { fieldId: definition.draft.fields[0]!.fieldId, path: "draft.fields[0].source.match", code: "Forms.Publication.OptionsPerRecipientHigh", message: "Revisá el máximo.", limit: 20, maximum: 1 } as const;
  result = { ...checked, warnings: [warning, { ...warning, maximum: 2, maximumLabel: "Norte" }] };
  await mount();
  expect(screen.getByText("Como mucho 1 opción por persona, de un límite de 20.")).toBeInTheDocument();
  expect(screen.getByText("Como mucho 2 opciones por persona (Norte), de un límite de 20.")).toBeInTheDocument();
});

// The wait of a 429 is not written in the dialog: it is the reason of the disabled Retry.
it("explains the check wait as the reason of Retry", async () => {
  const wait = "Esperá 30 segundos para volver a intentar.";
  error = new ApiError(429, { code: "RateLimit.Exceeded", retryAfter: 30 });
  await mount();
  const retry = screen.getByRole("button", { name: "Reintentar" });
  expect(retry).toBeDisabled();
  expect(retry).toHaveAccessibleDescription(wait);
  // The dialog may open with the focus on Retry, which shows its reason as a tooltip; without it, nothing shows the wait.
  act(() => (document.activeElement as HTMLElement | null)?.blur());
  await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  for (const text of screen.getAllByText(wait)) expect(text).not.toBeVisible();
});
