import userEvent from "@testing-library/user-event";
import i18n from "@/shared/i18n";
import { ApiError } from "@/shared/api/ApiError";
import type { FormPublicationCheck } from "../api/response";
import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { fixtureDefinition } from "@/test/visual/formFixtures";
import { openDraftSession } from "../draftSession";
import type { DraftEditorValue } from "../model";
import { PublicationCheckDialog } from "./PublicationCheckDialog";

const definition = fixtureDefinition();
const value = openDraftSession({ actorId: "actor", editorId: "editor" }, definition).value;
const checked: FormPublicationCheck = { definitionId: definition.id, draftRevision: 1, nextVersionNumber: 3, compatibility: "LocallyValidated", canAccept: true,
  acceptanceAvailability: "Available", checkToken: "synthetic-ticket", checkExpiresAtUtc: "2099-10-10T16:00:00Z", warnings: [], channels: [{ channelId: "phone", profileRevision: "1", compatibility: "LocallyValidated", externalEvidence: "Pending", cultures: ["es", "en"] }], issues: [],
  cultures: [{ culture: "es", isOriginal: true, isComplete: true, missing: [] }, { culture: "en", isOriginal: false, isComplete: true, missing: [] }],
  diff: { baseVersionId: "previous", added: [definition.draft.fields[0]!.fieldId], changed: [definition.draft.fields[1]!.fieldId], removed: ["retired"], addedCultures: [], removedCultures: [] } };
let result = checked;
// A failed check has no result, and neither has one still running.
let error: unknown = null;
let busy = false;
vi.mock("../hooks/useFormPublicationCheck", () => ({ useFormPublicationCheck: () => ({ result: error || busy ? null : result, busy, error, check: vi.fn() }) }));
beforeEach(async () => { await i18n.changeLanguage("es"); result = structuredClone(checked); error = null; busy = false; onGoToIssue.mockClear(); onCompleteTranslation.mockClear(); });
const onGoToIssue = vi.fn();
const onCompleteTranslation = vi.fn();
const manage = ["formtemplates.read", "formtemplates.publish", "formtemplates.manage"];
// The scope carries the menu language, as in the editor.
async function mount(permissions = ["formtemplates.read", "formtemplates.publish"], editorValue: DraftEditorValue = value, { prefixLocked = true, dirty = false, reactivation }: { prefixLocked?: boolean; dirty?: boolean; reactivation?: { name: string; nextRecordNumber: string | null } } = {}) {
  await act(async () => { renderWithProviders(<PublicationCheckDialog scope={{ actorId: "actor", culture: i18n.language.startsWith("en") ? "en" : "es", permissions }}
    id={definition.id} revision={1} value={editorValue} dirty={dirty} canSave accepting={false} savedAt="2026-10-10 15:20" prefixLocked={prefixLocked} reactivation={reactivation}
    onAccept={vi.fn()} onOpenChange={vi.fn()} onSave={vi.fn()} onConflict={vi.fn()} onGoToIssue={onGoToIssue} onCompleteTranslation={onCompleteTranslation} />); });
}
const zone = (name: string) => screen.getByRole("region", { name });
// A row of a zone: what it says next to its label.
const row = (area: HTMLElement, label: string) => within(area).getByText(label, { selector: "dt" }).nextElementSibling as HTMLElement;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// PU1-A (2026-11-01): what blocks and what to review in their zones, only when there are any, and what is published in rows.
describe("Chosen publication board PU1-A", () => {
  it("lists what is published in rows: the saved draft, the questions and the changes against the published version", async () => {
    await mount();
    const dialog = screen.getByRole("dialog", { name: "Publicar la versión 3 en WhatsApp" });
    expect(dialog).not.toHaveAttribute("aria-describedby");
    const published = zone("Qué se publica");
    expect(row(published, "Borrador")).toHaveTextContent("Guardado el 2026-10-10 15:20");
    expect(row(published, "Preguntas")).toHaveTextContent("6");
    expect(row(published, "Agregadas")).toHaveTextContent("Cliente");
    expect(row(published, "Cambiadas")).toHaveTextContent("Contacto");
    expect(row(published, "Quitadas")).toHaveTextContent("1 pregunta");
    // The changes are against the published version: naming none, a newer one is never labeled with a stale number.
    expect(within(dialog).queryByText(/respecto de la versión/)).not.toBeInTheDocument();
    expect(within(published).queryByText("Prefijo", { selector: "dt" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Problemas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Avisos" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publicar versión 3" })).toBeEnabled();
  });
  // The saved date says what is published: a row of that zone, not a text beside the footer buttons.
  it("keeps the saved date out of the footer", async () => {
    await mount();
    expect(screen.getByRole("dialog").querySelector("[data-slot='dialog-footer']")).not.toHaveTextContent("2026-10-10 15:20");
  });
  it("leaves the explanations to the (i), without a description, «Qué queda fijo» or «Qué va a pasar»", async () => {
    await mount();
    for (const text of [/Revisamos el borrador/, /Qué queda fijo/, /Qué va a pasar/, /Aceptar el pedido/, /Le llega en español/]) expect(screen.queryByText(text)).not.toBeInTheDocument();
    expect(within(zone("Qué se publica")).getByRole("button", { name: "Más información sobre Qué se publica" })).toHaveAccessibleDescription(/^Se guarda la versión 3 con estas preguntas y se manda a WhatsApp\./);
  });
  it("says the prefix becomes fixed only while it is free", async () => {
    await mount(undefined, value, { prefixLocked: false });
    const prefix = row(zone("Qué se publica"), "Prefijo");
    expect(prefix).toHaveTextContent(/^VIS.*Queda fijo al publicar/);
    expect(within(prefix).getByRole("button", { name: "Cuándo queda fijo el prefijo" })).toHaveAccessibleDescription("El prefijo VIS queda fijo al aceptar la primera publicación, aunque después no se complete.");
  });
  it("keeps channel impediments blocking, with why Publish is off and no note under the footer", async () => {
    result = { ...checked, canAccept: false, issues: [
      { channelId: "phone", fieldId: null, choiceId: null, path: "channel", code: "WhatsApp.Flow.NotReady", message: "Completá la conexión.", limit: null, culture: null }] };
    await mount();
    const problems = zone("Problemas");
    expect(within(problems).getByText("El canal de publicación")).toBeInTheDocument();
    expect(within(problems).getByText("Completá la conexión.")).toBeInTheDocument();
    expect(within(problems).getByRole("button", { name: "Más información sobre Problemas" })).toHaveAccessibleDescription("Frenan la publicación: corregilos en el borrador, guardá y volvé a publicar.");
    expect(screen.queryByText("El formulario")).not.toBeInTheDocument();
    const publish = screen.getByRole("button", { name: "Publicar versión 3" });
    expect(publish).toBeDisabled();
    expect(publish).toHaveAccessibleDescription("Corregí el problema para publicar.");
    expect(screen.queryByText(/todavía no está disponible/)).not.toBeInTheDocument();
  });
  it("says how long a text over its limit is, and which text when it is not the title", async () => {
    const [customer, , amount, , , notes] = definition.draft.fields;
    const long = { ...value, draft: { ...value.draft, fields: value.draft.fields.map((field, index) => index === 2 ? { ...field, label: { ...field.label, es: "Importe cobrado al cliente" } } : index === 5 ? { ...field, help: { es: "x".repeat(95) } } : field) } };
    const choice = customer!.type === "choice" && !customer!.source ? customer!.options[1]!.choiceId : "";
    const tooLong = (path: string, fieldId: string, limit: number, choiceId: string | null = null) => ({ channelId: "phone", fieldId, choiceId, path, code: "WhatsApp.Flow.TextTooLong",
      message: "El texto supera el límite del componente. Revisá el texto indicado.", limit, culture: "es" as const });
    result = { ...checked, canAccept: false, issues: [tooLong("draft.fields[2].label.es", amount!.fieldId, 20), tooLong("draft.fields[5].help.es", notes!.fieldId, 80), tooLong("draft.fields[0].options[1].label.es", customer!.fieldId, 15, choice)] };
    await mount(undefined, long);
    const problems = zone("Problemas");
    expect(within(problems).getByText("Importe cobrado al cliente · Español")).toBeInTheDocument();
    expect(within(problems).getByText("Hasta 20 caracteres; tiene 26.")).toBeInTheDocument();
    expect(within(problems).getByText("La ayuda: hasta 80 caracteres; tiene 95.")).toBeInTheDocument();
    expect(within(problems).getByText("La opción «Distribuidora Norte»: hasta 15 caracteres; tiene 19.")).toBeInTheDocument();
    expect(screen.queryByText(/supera el límite del componente/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publicar versión 3" })).toHaveAccessibleDescription("Corregí los problemas para publicar.");
    await userEvent.click(within(problems).getAllByRole("button", { name: "Ir a la pregunta" })[0]!);
    expect(onGoToIssue).toHaveBeenCalledExactlyOnceWith(result.issues[0]);
  });
  it("while checking, Publish says so with its spinner and the zone has a skeleton", async () => {
    busy = true;
    await mount();
    expect(screen.getByRole("dialog", { name: "Publicar en WhatsApp" })).toBeInTheDocument();
    const checking = screen.getByRole("button", { name: "Comprobando…" });
    expect(checking).toBeDisabled();
    expect(checking).toHaveAttribute("aria-busy", "true");
    expect(within(zone("Qué se publica")).getByRole("status", { name: "Comprobando…" })).toBeInTheDocument();
  });
  it("an expired check offers to check again and says why Publish is off", async () => {
    result = { ...checked, checkExpiresAtUtc: "2020-01-01T00:00:00Z" };
    await mount();
    expect(screen.getByRole("button", { name: "Volver a comprobar" })).toBeEnabled();
    const publish = screen.getByRole("button", { name: "Publicar versión 3" });
    expect(publish).toBeDisabled();
    expect(publish).toHaveAccessibleDescription("La comprobación venció.");
  });
  it.each([["InProgress", "Ya hay una publicación en curso para este formulario."], ["Unavailable", "La publicación todavía no está disponible."]] as const)("an availability %s is the reason of the disabled Publish, not a text", async (availability, reason) => {
    result = { ...checked, canAccept: false, acceptanceAvailability: availability, checkToken: null, checkExpiresAtUtc: null };
    await mount();
    expect(screen.getByRole("button", { name: "Publicar versión 3" })).toHaveAccessibleDescription(reason);
    act(() => (document.activeElement as HTMLElement | null)?.blur());
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
    for (const text of screen.queryAllByText(reason)) expect(text).not.toBeVisible();
  });
  it("with unsaved changes asks to save first, and why is the (i) of the title", async () => {
    await mount(undefined, value, { dirty: true });
    expect(screen.getByRole("dialog", { name: "Primero guardá los cambios" })).not.toHaveAttribute("aria-describedby");
    expect(screen.getByRole("button", { name: "Por qué hay que guardar" })).toHaveAccessibleDescription("Se publica sólo lo guardado.");
    expect(screen.queryByText("Tus cambios siguen en el editor.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar borrador" })).toBeEnabled();
  });
  it("reactivating says where the numbering continues, and what comes back is the (i)", async () => {
    await mount(undefined, value, { reactivation: { name: "Registrar visita", nextRecordNumber: "VIS-0042" } });
    expect(screen.getByRole("dialog", { name: "Reactivar «Registrar visita»" })).toBeInTheDocument();
    const published = zone("Qué se publica");
    expect(row(published, "Numeración")).toHaveTextContent("Sigue en VIS-0042");
    expect(within(published).getByRole("button", { name: "Más información sobre Qué se publica" })).toHaveAccessibleDescription(/Vuelve a mandarse desde el chat/);
    expect(screen.getByRole("button", { name: "Reactivar con la versión 3" })).toBeEnabled();
  });
});

// Completing a translation is offered with the menu in that language, the one it is edited in.
const completionTexts = {
  es: { zone: "Qué se publica", row: "Idiomas", languages: { es: "Español", en: "Inglés" }, without: { es: "Sin el español: falta 1 texto", en: "Sin el inglés: falta 1 texto" }, missing: { es: "Qué falta en el español", en: "Qué falta en el inglés" }, help: "Cliente · la ayuda", publish: "Publicar versión 3", complete: { es: "Completar el español", en: "Completar el inglés" } },
  en: { zone: "What is published", row: "Languages", languages: { es: "Spanish", en: "English" }, without: { es: "Without Spanish: 1 text missing", en: "Without English: 1 text missing" }, missing: { es: "What is missing in Spanish", en: "What is missing in English" }, help: "Customer · help", publish: "Publish version 3", complete: { es: "Complete Spanish", en: "Complete English" } },
} as const;
for (const original of ["es", "en"] as const) {
  const secondary = original === "es" ? "en" : "es";
  const texts = completionTexts[secondary];
  it("allows publication with incomplete " + secondary + " and offers completion only to Manage", async () => {
    await i18n.changeLanguage(secondary);
    const missing: FormPublicationCheck["issues"][number] = { channelId: null, fieldId: definition.draft.fields[0]!.fieldId, choiceId: null, path: "draft.fields[0].help." + secondary, code: "Forms.Publication.MissingTranslation", message: "Completá la ayuda.", limit: null, culture: secondary };
    result = { ...result, channels: [{ ...checked.channels[0]!, cultures: [original] }], cultures: [{ culture: original, isOriginal: true, isComplete: true, missing: [] }, { culture: secondary, isOriginal: false, isComplete: false, missing: [missing] }] };
    await mount(manage, { ...value, draft: { ...value.draft, culture: original } });
    const languages = row(zone(texts.zone), texts.row);
    expect(languages).toHaveTextContent(new RegExp("^" + texts.languages[original]));
    expect(within(languages).getByText(texts.without[secondary])).toBeInTheDocument();
    expect(within(languages).getByRole("button", { name: texts.missing[secondary] })).toHaveAccessibleDescription(new RegExp(escape(texts.help)));
    expect(screen.getByRole("button", { name: texts.publish })).toBeEnabled();
    await userEvent.click(within(languages).getByRole("button", { name: texts.complete[secondary] }));
    expect(onCompleteTranslation).toHaveBeenLastCalledWith(missing);
    expect(onGoToIssue).not.toHaveBeenCalled();
  });
}
it("shows optional omissions without a completion action for Publish-only", async () => {
  // The menu is in the missing language, so only the permission withholds the action.
  await i18n.changeLanguage("en");
  result = { ...result, cultures: [{ ...checked.cultures[0]! }, { culture: "en", isOriginal: false, isComplete: false, missing: [{ channelId: null, fieldId: null, choiceId: null, path: "name.en", code: "Forms.Publication.MissingTranslation", message: "Completá el nombre.", limit: null, culture: "en" }] }] };
  await mount();
  expect(within(row(zone("What is published"), "Languages")).getByText("Without English: 1 text missing")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Complete English" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Publish version 3" })).toBeEnabled();
});
it("announces a complete bilingual publication using the checked channels", async () => {
  await mount();
  const languages = row(zone("Qué se publica"), "Idiomas");
  expect(languages).toHaveTextContent(/^Español e inglés/);
  expect(within(languages).queryByText(/^Sin el/)).not.toBeInTheDocument();
  expect(within(languages).getByRole("button", { name: "Cómo se elige el idioma" })).toHaveAccessibleDescription(/^Se publican los dos idiomas\./);
});
it("shows the checked language addition", async () => {
  result = { ...result, diff: { ...checked.diff, addedCultures: ["en"], removedCultures: [] } };
  await mount();
  expect(within(row(zone("Qué se publica"), "Idiomas")).getByText("Se suma el inglés.")).toBeInTheDocument();
});
it("warns before removing a published language", async () => {
  result = { ...result, channels: [{ ...checked.channels[0]!, cultures: ["es"] }], diff: { ...checked.diff, addedCultures: [], removedCultures: ["en"] } };
  await mount();
  const warnings = zone("Avisos");
  expect(within(warnings).getByText("Inglés")).toBeInTheDocument();
  expect(within(warnings).getByText("Deja de publicarse.")).toBeInTheDocument();
  expect(within(warnings).getByRole("button", { name: "Qué cambia para el inglés" })).toHaveAccessibleDescription("Desde la versión 3, las cuentas en inglés lo reciben en español.");
  expect(row(zone("Qué se publica"), "Idiomas")).toHaveTextContent(/^Español$/);
});

it("renders the complete publication decision in English without changing content cultures", async () => {
  await i18n.changeLanguage("en");
  await mount();
  expect(row(zone("What is published"), "Languages")).toHaveTextContent(/^Spanish and English/);
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
it.each([1, 3, 4, 8])("names at most three optional omissions in the (i) and counts the rest for %s texts", async count => {
  // English original with the menu in Spanish, the language that can be completed.
  incompleteReport(count, "en", false);
  await mount(manage, { ...value, draft: { ...value.draft, culture: "en" } });
  const languages = row(zone("Qué se publica"), "Idiomas");
  const names = ["Nombre", "Texto del botón final", "Cliente · la pregunta"].slice(0, Math.min(count, 3));
  const list = new Intl.ListFormat("es", { type: "conjunction" }).format(count > 3 ? [...names, count - 3 + " más"] : names);
  expect(within(languages).getByRole("button", { name: "Qué falta en el español" })).toHaveAccessibleDescription((count === 1 ? "Falta " : "Faltan ") + list + ". Podés publicar igual y sumarlo en otra versión.");
  expect(within(languages).getByRole("button", { name: "Completar el español" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Publicar versión 3" })).toBeEnabled();
});
for (const ui of ["es", "en"] as const) for (const original of ["es", "en"] as const) {
  it("merges the removal and omissions in one warning in " + ui + " with " + original + " original", async () => {
    await i18n.changeLanguage(ui);
    const secondary = original === "es" ? "en" : "es";
    const missing = incompleteReport(8, original, true);
    await mount(manage, { ...value, draft: { ...value.draft, culture: original } });
    const es = ui === "es";
    const languages = es ? { es: "español", en: "inglés" } : { es: "Spanish", en: "English" };
    const warnings = zone(es ? "Avisos" : "Warnings");
    expect(within(warnings).getByText(es ? { es: "Español", en: "Inglés" }[secondary] : languages[secondary])).toBeInTheDocument();
    expect(within(warnings).getByText(es ? "Deja de publicarse." : "It will no longer be published.")).toBeInTheDocument();
    const hint = es ? "Desde la versión 3, las cuentas en " + languages[secondary] + " lo reciben en " + languages[original] + "." : "From version 3, accounts in " + languages[secondary] + " receive it in " + languages[original] + ".";
    expect(within(warnings).getByRole("button", { name: es ? "Qué cambia para el " + languages[secondary] : "What changes for " + languages[secondary] }))
      .toHaveAccessibleDescription(new RegExp("^" + escape(hint) + (es ? " Faltan .* y 5 más\\.$" : " Missing: .*, and 5 more\\.$")));
    // The published languages do not repeat it.
    expect(within(row(zone(es ? "Qué se publica" : "What is published"), es ? "Idiomas" : "Languages")).queryByText(es ? /^Sin el/ : /^Without/)).not.toBeInTheDocument();
    // Only with the menu in the removed language does the warning offer to complete it.
    if (ui !== secondary) { expect(within(warnings).queryByRole("button", { name: /^(Completar|Complete) / })).not.toBeInTheDocument(); return; }
    await userEvent.click(within(warnings).getByRole("button", { name: es ? "Completar el " + languages[secondary] : "Complete " + languages[secondary] }));
    expect(onCompleteTranslation).toHaveBeenCalledExactlyOnceWith(missing[0]);
  });
}
it("keeps one removal warning and its omissions without an editing action for Publish-only", async () => {
  // English original with the menu in Spanish, the removed language: only the permission withholds the action.
  incompleteReport(4, "en", true);
  await mount(undefined, { ...value, draft: { ...value.draft, culture: "en" } });
  const warnings = zone("Avisos");
  expect(within(warnings).getByText("Español")).toBeInTheDocument();
  expect(within(warnings).getByText("Deja de publicarse.")).toBeInTheDocument();
  expect(within(warnings).queryByRole("button", { name: /^Completar/ })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Publicar versión 3" })).toBeEnabled();
});

it("offers to complete a translation only when the menu is in that language", async () => {
  const missing = incompleteReport(2, "es", false);
  await mount(manage);
  expect(within(row(zone("Qué se publica"), "Idiomas")).getByText("Sin el inglés: faltan 2 textos")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Completar el inglés" })).not.toBeInTheDocument();
  cleanup();
  await i18n.changeLanguage("en");
  await mount(manage);
  const languages = row(zone("What is published"), "Languages");
  expect(within(languages).getByText("Without English: 2 texts missing")).toBeInTheDocument();
  await userEvent.click(within(languages).getByRole("button", { name: "Complete English" }));
  expect(onCompleteTranslation).toHaveBeenCalledExactlyOnceWith(missing[0]);
});

it("shows recipient diagnostics without disabling an otherwise publishable version", async () => {
  result = { ...checked, warnings: [{ fieldId: definition.draft.fields[0]!.fieldId, path: "draft.fields[0].source.match", code: "Forms.Publication.OptionsPerRecipientHigh", message: "Como mucho 18 opciones de 20.", limit: 20, maximum: 18 }, { fieldId: definition.draft.fields[0]!.fieldId, path: "draft.fields[0].source.match", code: "Forms.Publication.RecipientsWithoutData", message: "2 personas sin sucursal.", count: 2, people: ["Ana", "Luis"] }] };
  await mount();
  const warnings = zone("Avisos");
  expect(within(warnings).getAllByText("Cliente")).toHaveLength(2);
  expect(within(warnings).getByText("Como mucho 18 opciones por persona, de un límite de 20.")).toBeInTheDocument();
  expect(within(warnings).getByText("2 personas no tienen el dato necesario para recibirlo.")).toBeInTheDocument();
  expect(within(warnings).getByText("Ana, Luis")).toBeInTheDocument();
  expect(within(warnings).getByRole("button", { name: "Más información sobre Avisos" })).toHaveAccessibleDescription("No frenan la publicación, pero conviene revisarlos antes.");
  // What to do with each one is its (i).
  const helps = within(warnings).getAllByRole("button", { name: "Qué conviene revisar" });
  expect(helps[0]).toHaveAccessibleDescription("Como mucho 18 opciones de 20.");
  expect(helps[1]).toHaveAccessibleDescription("2 personas sin sucursal.");
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
