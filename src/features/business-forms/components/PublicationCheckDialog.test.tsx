import { act, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { fixtureDefinition } from "@/test/visual/formFixtures";
import { openDraftSession } from "../draftSession";
import { PublicationCheckDialog } from "./PublicationCheckDialog";

const definition = fixtureDefinition();
const value = openDraftSession({ actorId: "actor", editorId: "editor" }, definition).value;
const checked = { definitionId: definition.id, draftRevision: 1, nextVersionNumber: 3, compatibility: "LocallyValidated", canAccept: true,
  acceptanceAvailability: "Available", checkToken: "synthetic-ticket", checkExpiresAtUtc: "2099-10-10T16:00:00Z", channels: [], issues: [] as object[],
  diff: { baseVersionId: "previous", added: [definition.draft.fields[0]!.fieldId], changed: [definition.draft.fields[1]!.fieldId], removed: ["retired"] } };
let result = checked;
vi.mock("../hooks/useFormPublicationCheck", () => ({ useFormPublicationCheck: () => ({ result, busy: false, error: null, check: vi.fn() }) }));
beforeEach(() => { result = { ...checked, issues: [] }; });
async function mount() { await act(async () => { renderWithProviders(<PublicationCheckDialog scope={{ actorId: "actor", culture: "es", permissions: ["formtemplates.read", "formtemplates.publish"] }}
  id={definition.id} revision={1} value={value} dirty={false} canSave accepting={false} savedAt="2026-10-10 15:20" prefixLocked baseVersionId="previous" baseVersionNumber={1}
  onAccept={vi.fn()} onOpenChange={vi.fn()} onSave={vi.fn()} onConflict={vi.fn()} onGoToIssue={vi.fn()} />); }); }
describe("Chosen publication board P1/E", () => {
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
  it("summarizes untranslated texts by language and identifies a channel issue as a channel", async () => {
    result = { ...checked, canAccept: false, issues: [
      { channelId: null, fieldId: definition.draft.fields[0]!.fieldId, choiceId: null, path: "draft.fields[0].label.en", code: "Forms.Publication.MissingTranslation", message: "Completá el texto.", limit: null, culture: "en" },
      { channelId: "phone", fieldId: null, choiceId: null, path: "channel", code: "WhatsApp.Flow.NotReady", message: "Completá la conexión.", limit: null, culture: null }] };
    await mount();
    expect(screen.getByText("Falta 1 texto en inglés.")).toBeInTheDocument();
    expect(screen.getByText("El canal de publicación")).toBeInTheDocument();
    expect(screen.queryByText("El formulario")).not.toBeInTheDocument();
  });
});
