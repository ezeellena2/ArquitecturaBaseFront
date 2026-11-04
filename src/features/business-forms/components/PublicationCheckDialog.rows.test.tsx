import userEvent from "@testing-library/user-event";
import { act, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n";
import type { FormPublicationCheck } from "../api/response";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { fixtureDefinition } from "@/test/visual/formFixtures";
import { openDraftSession } from "../draftSession";
import type { CanonicalQuestion, FormDefinitionSnapshot } from "../model";
import { PublicationCheckDialog } from "./PublicationCheckDialog";

// Publishing the block of rows (RG3-A, RG6-A): «Pasan a renglones» in what is published, and the warning of the rows
// WhatsApp does not load, with a way to the block.
const base = fixtureDefinition();
const id = (n: number) => "01990000-0000-7000-8000-" + String(900 + n).padStart(12, "0");
const field = (n: number, rest: object) => ({ fieldId: id(n), key: "field_" + id(n).replaceAll("-", ""), help: null, ...rest }) as CanonicalQuestion;
const definition: FormDefinitionSnapshot = { ...base, draft: { ...base.draft, fields: [base.draft.fields[0]!, base.draft.fields[1]!,
  field(1, { type: "group", label: { es: "Artículos", en: "Items" }, required: true, rows: { minRows: 1, maxRows: 20 } }),
  field(2, { type: "decimal", label: { es: "Cantidad", en: "Quantity" }, required: true, repeated: true }),
  field(3, { type: "longText", label: { es: "Observaciones", en: "Notes" }, required: false, maxLength: 600, repeated: true })] } };
const value = openDraftSession({ actorId: "actor", editorId: "editor" }, definition).value;
const result: FormPublicationCheck = { definitionId: definition.id, draftRevision: 1, nextVersionNumber: 2, compatibility: "LocallyValidated", canAccept: true,
  acceptanceAvailability: "Available", checkToken: "synthetic-ticket", checkExpiresAtUtc: "2099-10-10T16:00:00Z",
  channels: [{ channelId: "phone", profileRevision: "flow-static-7.3-r10", compatibility: "LocallyValidated", externalEvidence: "Pending", cultures: ["es", "en"] }],
  cultures: [{ culture: "es", isOriginal: true, isComplete: true, missing: [] }, { culture: "en", isOriginal: false, isComplete: true, missing: [] }], issues: [],
  warnings: [{ fieldId: id(1), path: "draft.fields[2].rows", code: "Forms.Publication.RowsOverChannelLimit", message: "En WhatsApp se cargan menos renglones que el máximo del bloque.", limit: 10, maximum: 20 }],
  diff: { baseVersionId: "previous", added: [id(1)], changed: [], removed: [], addedCultures: [], removedCultures: [], movedToRows: [id(2), id(3)] } };
vi.mock("../hooks/useFormPublicationCheck", () => ({ useFormPublicationCheck: () => ({ result, busy: false, error: null, check: vi.fn() }) }));
const onGoToIssue = vi.fn();
beforeEach(async () => { await i18n.changeLanguage("es"); onGoToIssue.mockClear(); });
async function mount() {
  await act(async () => { renderWithProviders(<PublicationCheckDialog scope={{ actorId: "actor", culture: "es", permissions: ["formtemplates.read", "formtemplates.publish"] }}
    id={definition.id} revision={1} value={value} dirty={false} canSave accepting={false} savedAt="2026-11-04 15:20" prefixLocked
    onAccept={vi.fn()} onOpenChange={vi.fn()} onSave={vi.fn()} onConflict={vi.fn()} onGoToIssue={onGoToIssue} onCompleteTranslation={vi.fn()} />); });
}
const row = (area: HTMLElement, label: string) => within(area).getByText(label, { selector: "dt" }).nextElementSibling as HTMLElement;

it("names the questions that move into the block and counts the questions without it", async () => {
  await mount();
  const published = screen.getByRole("region", { name: "Qué se publica" });

  expect(row(published, "Preguntas")).toHaveTextContent("4");
  expect(row(published, "Pasan a renglones")).toHaveTextContent("Cantidad, Observaciones");
  expect(row(published, "Agregadas")).toHaveTextContent("Artículos");
});
it("warns about the rows WhatsApp does not load, with a way to the block", async () => {
  await mount();
  const warnings = screen.getByRole("region", { name: "Avisos" });

  expect(within(warnings).getByText("Artículos")).toBeInTheDocument();
  expect(within(warnings).getByText("En WhatsApp se cargan hasta 10 renglones; el máximo es 20.")).toBeInTheDocument();
  await userEvent.click(within(warnings).getByRole("button", { name: "Ir a la pregunta" }));

  expect(onGoToIssue).toHaveBeenCalledWith(expect.objectContaining({ fieldId: id(1), path: "draft.fields[2].rows" }));
});
