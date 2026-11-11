import { act, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n";
import type { FormPublicationCheck } from "../api/response";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { fixtureDefinition } from "@/test/visual/formFixtures";
import { openDraftSession } from "../draftSession";
import { PublicationCheckDialog } from "./PublicationCheckDialog";

// SA3-A, SA4-A and SA5 (2026-11-09): the same dialog, without WhatsApp when the version is completed only in the app.
const definition = fixtureDefinition();
const value = openDraftSession({ actorId: "actor", editorId: "editor" }, definition).value;
const inApp: FormPublicationCheck = { definitionId: definition.id, draftRevision: 1, nextVersionNumber: 5, compatibility: "LocallyValidated", canAccept: true,
  acceptanceAvailability: "Available", checkToken: "synthetic-ticket", checkExpiresAtUtc: "2099-10-10T16:00:00Z", channels: [],
  cultures: [{ culture: "en", isOriginal: false, isComplete: true, missing: [] }, { culture: "es", isOriginal: true, isComplete: true, missing: [] }], issues: [], warnings: [],
  diff: { baseVersionId: "01990000-0000-7000-8000-000000000089", added: [], changed: [], removed: [], addedCultures: [], removedCultures: [] } };
const byWhatsApp: FormPublicationCheck = { ...inApp, channels: [{ channelId: "phone", profileRevision: "flow-static-7.3-r13", compatibility: "LocallyValidated", externalEvidence: "Pending", cultures: ["es"] }] };
let current = inApp;
vi.mock("../hooks/useFormPublicationCheck", () => ({ useFormPublicationCheck: () => ({ result: current, busy: false, error: null, check: vi.fn() }) }));
beforeEach(async () => { await i18n.changeLanguage("es"); current = inApp; });
async function mount(props: { appOnly?: boolean; channels?: boolean; leavesChannels?: boolean }) {
  await act(async () => { renderWithProviders(<PublicationCheckDialog scope={{ actorId: "actor", culture: "es", permissions: ["formtemplates.read", "formtemplates.publish"] }}
    id={definition.id} revision={1} value={value} dirty={false} canSave accepting={false} prefixLocked {...props}
    onAccept={vi.fn()} onOpenChange={vi.fn()} onSave={vi.fn()} onConflict={vi.fn()} onGoToIssue={vi.fn()} onCompleteTranslation={vi.fn()} />); });
}
const row = (label: string) => within(screen.getByRole("region", { name: "Qué se publica" })).getByText(label, { selector: "dt" }).nextElementSibling as HTMLElement;

it("publishes a version only in the app without WhatsApp, saying where and the languages it seals", async () => {
  await mount({ appOnly: true, channels: true });
  expect(screen.getByRole("heading", { name: "Publicar la versión 5" })).toBeInTheDocument();
  expect(row("Dónde se completa")).toHaveTextContent("Sólo en la app");
  expect(row("Idiomas")).toHaveTextContent("Español e inglés");
  expect(screen.queryByRole("region", { name: "Avisos" })).not.toBeInTheDocument();
});

it("warns that a form completed by WhatsApp stops being completed there (SA4-A)", async () => {
  await mount({ appOnly: true, channels: true, leavesChannels: true });
  const warnings = screen.getByRole("region", { name: "Avisos" });
  expect(within(warnings).getByText("Deja de completarse por WhatsApp")).toBeInTheDocument();
  expect(within(warnings).getByText("Los envíos abiertos se pueden responder hasta que vencen.")).toBeInTheDocument();
});

it("says a version is completed in the app and by WhatsApp, with WhatsApp in the title", async () => {
  current = byWhatsApp;
  await mount({ channels: true });
  expect(screen.getByRole("heading", { name: "Publicar la versión 5 en WhatsApp" })).toBeInTheDocument();
  expect(row("Dónde se completa")).toHaveTextContent("En la app y por WhatsApp");
});

it("without a form channel says nothing about where it is completed (SA5)", async () => {
  await mount({ appOnly: true, channels: false });
  expect(screen.getByRole("heading", { name: "Publicar la versión 5" })).toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Qué se publica" })).queryByText("Dónde se completa")).not.toBeInTheDocument();
});
