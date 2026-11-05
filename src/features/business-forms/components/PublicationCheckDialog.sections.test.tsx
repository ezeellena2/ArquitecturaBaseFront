import userEvent from "@testing-library/user-event";
import { act, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n";
import type { FormPublicationCheck } from "../api/response";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { fixtureDefinition } from "@/test/visual/formFixtures";
import { openDraftSession } from "../draftSession";
import type { FormDefinitionSnapshot } from "../model";
import { PublicationCheckDialog } from "./PublicationCheckDialog";

// Publishing section titles (CW15-B): a title with no question below it is a problem named by the title, with a way to it.
const base = fixtureDefinition();
const definition: FormDefinitionSnapshot = { ...base, draft: { ...base.draft, sections: [{ start: 0, title: { es: "Visita", en: "Visit" } }, { start: 6, title: { es: "Cierre", en: "Closing" } }] } };
const value = openDraftSession({ actorId: "actor", editorId: "editor" }, definition).value;
const issue = { channelId: null, fieldId: null, choiceId: null, path: "draft.sections[1]", code: "Forms.Publication.SectionEmpty", message: "Agregá al menos una pregunta debajo del título.", limit: null, culture: null };
const result: FormPublicationCheck = { definitionId: definition.id, draftRevision: 1, nextVersionNumber: 1, compatibility: "Blocked", canAccept: false,
  acceptanceAvailability: "Available", checkToken: null, checkExpiresAtUtc: null, channels: [],
  cultures: [{ culture: "es", isOriginal: true, isComplete: true, missing: [] }, { culture: "en", isOriginal: false, isComplete: true, missing: [] }], issues: [issue], warnings: [],
  diff: { baseVersionId: null, added: [], changed: [], removed: [], addedCultures: [], removedCultures: [] } };
vi.mock("../hooks/useFormPublicationCheck", () => ({ useFormPublicationCheck: () => ({ result, busy: false, error: null, check: vi.fn() }) }));
const onGoToIssue = vi.fn();
beforeEach(async () => { await i18n.changeLanguage("es"); onGoToIssue.mockClear(); });

it("names a title without questions below it among the problems and goes to it", async () => {
  await act(async () => { renderWithProviders(<PublicationCheckDialog scope={{ actorId: "actor", culture: "es", permissions: ["formtemplates.read", "formtemplates.publish"] }}
    id={definition.id} revision={1} value={value} dirty={false} canSave accepting={false} savedAt="2026-11-05 15:20" prefixLocked
    onAccept={vi.fn()} onOpenChange={vi.fn()} onSave={vi.fn()} onConflict={vi.fn()} onGoToIssue={onGoToIssue} onCompleteTranslation={vi.fn()} />); });

  const problems = screen.getByRole("region", { name: "Problemas" });
  expect(within(problems).getByText("Cierre")).toBeInTheDocument();
  expect(within(problems).getByText("Agregá al menos una pregunta debajo del título.")).toBeInTheDocument();
  await userEvent.click(within(problems).getByRole("button", { name: "Ir al título" }));

  expect(onGoToIssue).toHaveBeenCalledWith(issue);
});
