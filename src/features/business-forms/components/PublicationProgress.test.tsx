import { notify } from "@/shared/ui/notifications";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n";
import { ApiError } from "@/shared/api/ApiError";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { fixtureDefinition } from "@/test/visual/formFixtures";
import { openDraftSession } from "../draftSession";
import { localizedValue } from "../editorModel";
import { publicationFieldIssues } from "../validationPaths";
import type { useFormPublication } from "../hooks/useFormPublication";
import type { FormPublicationCheck } from "../api/response";
import { usePublicationProgress } from "../hooks/usePublicationProgress";
import { PublicationActions, PublicationProblems } from "./PublicationProgress";
vi.mock("@/shared/ui/notifications", () => ({ notify: vi.fn(), dismissNotification: vi.fn() }));
beforeEach(async () => { await i18n.changeLanguage("es"); vi.mocked(notify).mockClear(); });

type Publication = ReturnType<typeof useFormPublication>;
type Issue = FormPublicationCheck["issues"][number];
const definition = fixtureDefinition();
const value = openDraftSession({ actorId: "actor", editorId: "editor" }, definition).value;
const reviewHint = "Esta publicación necesita revisión. No inicies otra para intentar resolverla.";
const unconfirmedHint = "Todavía no sabemos si la publicación fue aceptada. Consultá el intento antes de volver a enviarlo.";
const inProgress = "Ya hay una publicación en curso para este formulario.";
function session(state: "Uncertain" | "Publishing" | "Published" | "Failed", changes: Partial<Publication> = {}): Publication {
  return { phase: "Accepted", receipt: null, status: { requestId: "request", operationId: "operation", definitionId: "definition", versionId: "version", versionNumber: 2, draftRevision: 3,
    acceptedAtUtc: "2026-10-10T12:00:00Z", state, stage: "Validate", updatedAtUtc: "2026-10-10T12:00:00Z", nextCheckAtUtc: null, canRetry: false, requiresReview: state === "Uncertain",
    issues: [], cultures: ["es", "en"] }, error: null, busy: false, aggregate: null, startedHere: false, canReplay: false, confirmed: true,
    accept: vi.fn(), consult: vi.fn(), replay: vi.fn(), resetRejected: vi.fn(), resume: vi.fn(), ...changes } as Publication;
}
// The editor's header and body, as FormEditorPage composes them: why Publish is off, the actions and «Problemas».
function Editor({ publication, onReplay = vi.fn(), onGoToIssue = vi.fn() }: { publication: Publication; onReplay?: () => void; onGoToIssue?: (issue: Issue) => void }) {
  const progress = usePublicationProgress(publication, "publication-test");
  return <div data-testid="editor">
    <header aria-label="Encabezado"><p data-testid="publish-reason">{progress.publishReason ?? ""}</p><PublicationActions publication={publication} progress={progress} onReplay={onReplay} /></header>
    <PublicationProblems progress={progress} value={value} culture="es" onGoToIssue={onGoToIssue} canLocateIssue={issue => publicationFieldIssues(value, [issue]).length > 0} />
  </div>;
}
async function mount(publication: Publication, props: Partial<Parameters<typeof Editor>[0]> = {}) {
  let view!: ReturnType<typeof renderWithProviders>;
  await act(async () => { view = renderWithProviders(<Editor publication={publication} {...props} />); });
  return view;
}
const header = () => screen.getByRole("banner", { name: "Encabezado" });
const editor = () => within(screen.getByTestId("editor"));

// EP1-A (2026-11-06): the state is the label of the header; nothing under it repeats it.
describe("Chosen publication board EP1-A", () => {
  it("says nothing under the header while a publication is accepted, goes on or is published", async () => {
    const view = await mount({ ...session("Publishing"), phase: "Accepting", status: null, confirmed: false, busy: true });
    for (const publication of [session("Publishing"), session("Published"), { ...session("Published"), phase: "Idle" as const, status: null, confirmed: false }]) {
      view.rerender(<Editor publication={publication} />);
      expect(editor().queryByRole("region")).not.toBeInTheDocument();
      expect(editor().queryByRole("heading")).not.toBeInTheDocument();
      expect(screen.queryByText(/Aceptada|Enviada a WhatsApp|sigue activa|En WhatsApp, en|Lista para mandar/)).not.toBeInTheDocument();
      expect(within(header()).queryByRole("button")).not.toBeInTheDocument();
    }
  });

  it("says why «Publicar en WhatsApp» is off while a publication goes on", async () => {
    const reason = () => screen.getByTestId("publish-reason");
    const view = await mount({ ...session("Publishing"), phase: "Accepting", status: null, confirmed: false });
    expect(reason()).toHaveTextContent(inProgress);
    view.rerender(<Editor publication={session("Publishing", { status: { ...session("Publishing").status!, requiresReview: false } })} />);
    expect(reason()).toHaveTextContent(inProgress);
    view.rerender(<Editor publication={{ ...session("Publishing"), phase: "Unconfirmed" }} />);
    expect(reason()).toHaveTextContent(unconfirmedHint);
    view.rerender(<Editor publication={session("Uncertain")} />);
    expect(reason()).toHaveTextContent(reviewHint);
    view.rerender(<Editor publication={session("Publishing", { status: { ...session("Publishing").status!, requiresReview: true } })} />);
    expect(reason()).toHaveTextContent(reviewHint);
    view.rerender(<Editor publication={{ ...session("Publishing"), error: new ApiError(403, { code: "Auth.Forbidden" }) }} />);
    expect(reason()).toHaveTextContent("Ya no tenés permiso para publicar.");
  });

  it("offers «Consultar publicación» in the header only when consulting is the way forward", async () => {
    const consult = () => within(header()).queryByRole("button", { name: "Consultar publicación" });
    const view = await mount({ ...session("Publishing"), phase: "Unconfirmed" });
    expect(consult()).toBeInTheDocument();
    view.rerender(<Editor publication={session("Uncertain")} />);
    expect(consult()).toBeInTheDocument();
    // A failed consultation stops the automatic one: consulting again is the way forward.
    view.rerender(<Editor publication={session("Publishing", { error: new ApiError(500, { code: "General.Unexpected" }) })} />);
    expect(consult()).toBeInTheDocument();
    view.rerender(<Editor publication={session("Publishing")} />);
    expect(consult()).not.toBeInTheDocument();
    view.rerender(<Editor publication={session("Failed")} />);
    expect(consult()).not.toBeInTheDocument();
    view.rerender(<Editor publication={{ ...session("Publishing"), phase: "Unconfirmed", error: new ApiError(403, { code: "Auth.Forbidden" }) }} />);
    expect(consult()).not.toBeInTheDocument();
  });

  it("keeps «Consultar publicación» in sight, with its ring, while it consults after a failed consultation", async () => {
    const failed = session("Publishing", { error: new ApiError(500, { code: "General.Unexpected" }) });
    const view = await mount(failed);
    await userEvent.click(within(header()).getByRole("button", { name: "Consultar publicación" }));
    expect(failed.consult).toHaveBeenCalledOnce();
    view.rerender(<Editor publication={{ ...failed, error: null, busy: true }} />);
    const consulting = within(header()).getByRole("button", { name: "Consultando…" });
    expect(consulting).toHaveAttribute("aria-busy", "true");
    view.rerender(<Editor publication={{ ...failed, error: null, busy: false }} />);
    expect(within(header()).queryByRole("button", { name: /Consultar publicación|Consultando…/ })).not.toBeInTheDocument();
  });

  // Repeating the same attempt is not consulting: the header shows no «Consultando…» while it accepts it again.
  it("does not say «Consultando…» while it repeats the same attempt", async () => {
    const unconfirmed = { ...session("Publishing"), phase: "Unconfirmed" as const, canReplay: true };
    const view = await mount(unconfirmed);
    expect(within(header()).getByRole("button", { name: "Repetir el mismo intento" })).toBeEnabled();
    view.rerender(<Editor publication={{ ...unconfirmed, phase: "Accepting", status: null, confirmed: false, busy: true, canReplay: false }} />);
    expect(within(header()).queryByRole("button")).not.toBeInTheDocument();
  });

  // Opening the editor confirms its last publication by its own link; while that answer comes, a finished one is not «en curso».
  it("gives Publish no reason while it confirms a finished publication on opening", async () => {
    const reason = () => screen.getByTestId("publish-reason");
    const operation = (state: "Published" | "Failed") => ({ requestId: "request", operationId: "operation", definitionId: "definition", versionId: "version", versionNumber: 2, draftRevision: 3,
      acceptedAtUtc: "2026-10-10T12:00:00Z", state, updatedAtUtc: "2026-10-10T12:00:00Z", requiresReview: false, recoveryPath: "/api/forms/definitions/definition/publications/request" });
    const view = await mount({ ...session("Published"), status: null, aggregate: operation("Published") as unknown as Publication["aggregate"] });
    expect(reason()).toBeEmptyDOMElement();
    view.rerender(<Editor publication={{ ...session("Failed"), status: null, aggregate: operation("Failed") as unknown as Publication["aggregate"] }} />);
    expect(reason()).toBeEmptyDOMElement();
  });

  it("says «Consultando…» with its ring while it consults, and replaying waits", async () => {
    await mount({ ...session("Publishing"), phase: "Unconfirmed", canReplay: true, busy: true });
    const consulting = within(header()).getByRole("button", { name: "Consultando…" });
    expect(consulting).toBeDisabled();
    expect(consulting).toHaveAttribute("aria-busy", "true");
    expect(within(header()).getByRole("button", { name: "Repetir el mismo intento" })).toBeDisabled();
  });

  it("explains the wait of a 429 as the reason of consulting and replaying", async () => {
    const wait = "Esperá 30 segundos para volver a intentar.";
    const onReplay = vi.fn();
    await mount({ ...session("Publishing"), phase: "Unconfirmed", canReplay: true, error: new ApiError(429, { code: "RateLimit.Exceeded", retryAfter: 30 }) }, { onReplay });
    for (const name of ["Consultar publicación", "Repetir el mismo intento"]) {
      const button = within(header()).getByRole("button", { name });
      expect(button).toBeDisabled();
      expect(button).toHaveAccessibleDescription(wait);
    }
    for (const text of screen.getAllByText(wait)) expect(text).not.toBeVisible();
    expect(onReplay).not.toHaveBeenCalled();
  });

  it("lists the problems of a publication that did not go through in «Problemas», like the check", async () => {
    const question = definition.draft.fields[0]!;
    const name = localizedValue(question.label, "es", definition.draft.culture);
    const onGoToIssue = vi.fn();
    const issue = (culture: "es" | "en", path: string, fieldId: string | null, message: string): Issue => ({ channelId: "phone", fieldId, choiceId: null, path, code: "WhatsApp.Flow.ValidationFailed", message, limit: null, culture });
    await mount(session("Failed", { status: { ...session("Failed").status!, issues: [issue("es", "draft.fields[0].label.es", question.fieldId, "WhatsApp no acepta la pregunta."), issue("en", "name.en", null, "The name is long.")] } }), { onGoToIssue });
    const problems = screen.getByRole("region", { name: "Problemas" });
    expect(within(problems).getByText(name)).toBeInTheDocument();
    expect(within(problems).getByText("WhatsApp no acepta la pregunta.")).toBeInTheDocument();
    // NI1-A (2026-11-03): only the other language is named.
    expect(within(problems).getByText("Nombre · Inglés")).toBeInTheDocument();
    expect(within(problems).queryByText(/Español/)).not.toBeInTheDocument();
    expect(within(problems).getByRole("button", { name: "Más información sobre Problemas" })).toBeInTheDocument();
    await userEvent.click(within(problems).getByRole("button", { name: "Ir a la pregunta" }));
    expect(onGoToIssue).toHaveBeenCalledWith(expect.objectContaining({ fieldId: question.fieldId }));
    // The name in English is located too, as in the check before publishing.
    await userEvent.click(within(problems).getByRole("button", { name: "Ir al texto" }));
    expect(onGoToIssue).toHaveBeenLastCalledWith(expect.objectContaining({ path: "name.en" }));
  });

  it("shows no zone for a publication that did not go through without problems", async () => {
    await mount(session("Failed"));
    expect(editor().queryByRole("region")).not.toBeInTheDocument();
  });
});

describe("Publication notices", () => {
  // NI2-C (2026-11-03): published only in the menu language, it does not name it.
  it("announces a newly published operation once, without naming the menu language alone", async () => {
    const original = session("Publishing");
    const status = { ...original.status!, state: "Published" as const, requiresReview: false, cultures: ["es" as const] };
    const view = await mount(original);
    view.rerender(<Editor publication={{ ...original, status, startedHere: true }} />);
    await act(async () => {});
    expect(notify).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "success", message: "Publicamos la versión 2." }));
    vi.mocked(notify).mockClear();
    view.rerender(<Editor publication={{ ...original, status: { ...status }, startedHere: true }} />);
    expect(notify).not.toHaveBeenCalled();
  });

  it("does not announce an existing published version while opening the editor", async () => {
    await mount(session("Published"));
    expect(notify).not.toHaveBeenCalled();
  });

  it("announces a local publication confirmed by GET after the acceptance response was lost", async () => {
    await mount(session("Published", { startedHere: true, status: { ...session("Published").status!, requiresReview: false, cultures: ["en"] } }));
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "success", message: "Publicamos la versión 2, en inglés." }));
  });

  it("announces a publication started here that did not go through, once", async () => {
    const view = await mount(session("Failed", { startedHere: true }));
    expect(notify).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "error", message: "No pudimos publicar la versión 2." }));
    vi.mocked(notify).mockClear();
    view.rerender(<Editor publication={session("Failed", { startedHere: true })} />);
    expect(notify).not.toHaveBeenCalled();
  });

  it("does not announce a failure that was already there when the editor opened", async () => {
    await mount(session("Failed"));
    expect(notify).not.toHaveBeenCalled();
  });
});
