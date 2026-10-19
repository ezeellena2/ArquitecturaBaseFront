import userEvent from "@testing-library/user-event";
import i18n from "@/shared/i18n";
import type { FormPublicationCheck } from "../api/response";
import { act, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { fixtureDefinition } from "@/test/visual/formFixtures";
import { openDraftSession } from "../draftSession";
import { PublicationCheckDialog } from "./PublicationCheckDialog";

const definition = fixtureDefinition();
const value = openDraftSession({ actorId: "actor", editorId: "editor" }, definition).value;
const checked: FormPublicationCheck = { definitionId: definition.id, draftRevision: 1, nextVersionNumber: 3, compatibility: "LocallyValidated", canAccept: true,
  acceptanceAvailability: "Available", checkToken: "synthetic-ticket", checkExpiresAtUtc: "2099-10-10T16:00:00Z", channels: [{ channelId: "phone", profileRevision: "1", compatibility: "LocallyValidated", externalEvidence: "Pending", cultures: ["es", "en"] }], issues: [],
  cultures: [{ culture: "es", isOriginal: true, isComplete: true, missing: [] }, { culture: "en", isOriginal: false, isComplete: true, missing: [] }],
  diff: { baseVersionId: "previous", added: [definition.draft.fields[0]!.fieldId], changed: [definition.draft.fields[1]!.fieldId], removed: ["retired"], addedCultures: [], removedCultures: [] } };
let result = checked;
vi.mock("../hooks/useFormPublicationCheck", () => ({ useFormPublicationCheck: () => ({ result, busy: false, error: null, check: vi.fn() }) }));
beforeEach(async () => { await i18n.changeLanguage("es"); result = structuredClone(checked); onGoToIssue.mockClear(); });
const onGoToIssue = vi.fn();
async function mount(permissions = ["formtemplates.read", "formtemplates.publish"], editorValue = value) { await act(async () => { renderWithProviders(<PublicationCheckDialog scope={{ actorId: "actor", culture: "es", permissions }}
  id={definition.id} revision={1} value={editorValue} dirty={false} canSave accepting={false} savedAt="2026-10-10 15:20" prefixLocked baseVersionId="previous" baseVersionNumber={1}
  onAccept={vi.fn()} onOpenChange={vi.fn()} onSave={vi.fn()} onConflict={vi.fn()} onGoToIssue={onGoToIssue} />); }); }
describe("Chosen publication boards I2/I3", () => {
  it("shows the checked next version, previous diff and saved draft without locking the prefix again", async () => {
    await mount();
    expect(screen.getByRole("dialog", { name: "Publicar la versión 3 en WhatsApp" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publicar versión 3" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Qué cambia respecto de la versión 1" })).toBeInTheDocument();
    expect(screen.getByText("Se publica el borrador guardado el 2026-10-10 15:20.")).toBeInTheDocument();
    expect(screen.queryByText(/El prefijo VIS queda fijo al aceptar/)).not.toBeInTheDocument();
    expect(screen.getByText("Agregadas: Cliente")).toBeInTheDocument();
    expect(screen.getByText("Cambiadas: Contacto")).toBeInTheDocument();
    expect(screen.getByText("1 pregunta quitada")).toBeInTheDocument();
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

for (const original of ["es", "en"] as const) {
  const secondary = original === "es" ? "en" : "es";
  const language = secondary === "en" ? "inglés" : "español";
  it("allows publication with incomplete " + secondary + " and offers completion only to Manage", async () => {
    const missing: FormPublicationCheck["issues"][number] = { channelId: null, fieldId: definition.draft.fields[0]!.fieldId, choiceId: null, path: "draft.fields[0].help." + secondary, code: "Forms.Publication.MissingTranslation", message: "Completá la ayuda.", limit: null, culture: secondary };
    result = { ...result, channels: [{ ...checked.channels[0]!, cultures: [original] }], cultures: [{ culture: original, isOriginal: true, isComplete: true, missing: [] }, { culture: secondary, isOriginal: false, isComplete: false, missing: [missing] }] };
    await mount(["formtemplates.read", "formtemplates.publish", "formtemplates.manage"], { ...value, draft: { ...value.draft, culture: original } });
    expect(screen.getByText("En WhatsApp, en " + (original === "es" ? "español" : "inglés"))).toBeInTheDocument();
    expect(screen.getByText("El " + language + " no se publica.")).toBeInTheDocument();
    expect(screen.getByText("Cliente · la ayuda")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publicar versión 3" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Completar el " + language }));
    expect(onGoToIssue).toHaveBeenLastCalledWith(missing);
  });
}
it("shows optional omissions without a completion action for Publish-only", async () => {
  result = { ...result, cultures: [{ ...checked.cultures[0]! }, { culture: "en", isOriginal: false, isComplete: false, missing: [{ channelId: null, fieldId: null, choiceId: null, path: "name.en", code: "Forms.Publication.MissingTranslation", message: "Completá el nombre.", limit: null, culture: "en" }] }] };
  await mount();
  expect(screen.getByText("El inglés no se publica.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Completar el inglés" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Publicar versión 3" })).toBeEnabled();
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
