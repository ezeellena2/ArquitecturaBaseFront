import { notify } from "@/shared/ui/notifications";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n";
import { ApiError } from "@/shared/api/ApiError";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import type { useFormPublication } from "../hooks/useFormPublication";
import { PublicationProgress } from "./PublicationProgress";
vi.mock("@/shared/ui/notifications", () => ({ notify: vi.fn(), dismissNotification: vi.fn() }));
beforeEach(async () => { await i18n.changeLanguage("es"); vi.mocked(notify).mockClear(); });
const reviewHint="Esta publicación necesita revisión. No inicies otra para intentar resolverla.";
function session(state:"Uncertain"|"Publishing"):ReturnType<typeof useFormPublication>{return {phase:"Accepted",receipt:null,status:{requestId:"request",operationId:"operation",definitionId:"definition",versionId:"version",versionNumber:2,draftRevision:3,acceptedAtUtc:"2026-10-10T12:00:00Z",state,stage:"Validate",updatedAtUtc:"2026-10-10T12:00:00Z",nextCheckAtUtc:null,canRetry:false,requiresReview:true,issues:[],cultures:["es","en"]},error:null,busy:false,aggregate:null,canReplay:false,confirmed:true,startedHere:false,accept:vi.fn(),consult:vi.fn(),replay:vi.fn(),resetRejected:vi.fn(),resume:vi.fn()};}
it("shows one review warning for an uncertain confirmed publication and preserves consultation without replay",async()=>{const publication=session("Uncertain");const onReplay=vi.fn();await act(async()=>{renderWithProviders(<PublicationProgress publication={publication} feedbackId="uncertain-review" onReplay={onReplay} />);});expect(screen.getAllByText(reviewHint)).toHaveLength(1);expect(screen.getByText("Aceptada")).toBeInTheDocument();expect(screen.getByText("Pendiente de confirmación de WhatsApp")).toBeInTheDocument();await userEvent.click(screen.getByRole("button",{name:"Consultar publicación"}));expect(publication.consult).toHaveBeenCalledOnce();expect(screen.queryByRole("button",{name:"Repetir el mismo pedido"})).not.toBeInTheDocument();expect(onReplay).not.toHaveBeenCalled();});
it("retains the separate review warning when the main status describes another publication state",async()=>{await act(async()=>{renderWithProviders(<PublicationProgress publication={session("Publishing")} feedbackId="publishing-review" onReplay={vi.fn()} />);});expect(screen.getAllByText(reviewHint)).toHaveLength(1);});

it("announces a newly published operation once with its captured languages", async () => {
  const original = session("Publishing");
  const status = { ...original.status!, state: "Published" as const, requiresReview: false, cultures: ["es" as const] };
  const receipt = { ...status, state: "Accepted" as const, recoveryPath: "/api/forms/definitions/definition/publications/request" };
  const publication = { ...original, status, receipt, startedHere: true };
  const view = renderWithProviders(<PublicationProgress publication={original} feedbackId="published-language" onReplay={vi.fn()} />);
  expect(screen.getByRole("status")).toBeInTheDocument();
  view.rerender(<PublicationProgress publication={publication} feedbackId="published-language" onReplay={vi.fn()} />);
  await act(async () => {});
  const persistent = screen.getByText("En WhatsApp, en español");
  expect(persistent.closest('[role="status"], [role="alert"], [aria-live]')).toBeNull();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.queryByText("Publicamos la versión 2, en español.")).not.toBeInTheDocument();
  expect(notify).toHaveBeenCalledOnce();
  expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "success", message: "Publicamos la versión 2, en español." }));
  vi.mocked(notify).mockClear();
  view.rerender(<PublicationProgress publication={{ ...publication }} feedbackId="published-language" onReplay={vi.fn()} />);
  expect(notify).not.toHaveBeenCalled();
});
it("does not announce an existing published version while opening the editor", async () => {
  vi.mocked(notify).mockClear();
  const original = session("Publishing");
  renderWithProviders(<PublicationProgress publication={{ ...original, status: { ...original.status!, state: "Published", requiresReview: false } }} feedbackId="existing-published" onReplay={vi.fn()} />);
  await act(async () => {});
  expect(notify).not.toHaveBeenCalled();
});

it("announces a local publication confirmed by GET after the acceptance response was lost", async () => {
  vi.mocked(notify).mockClear();
  const original = session("Publishing");
  renderWithProviders(<PublicationProgress publication={{ ...original, startedHere: true, receipt: null, status: { ...original.status!, state: "Published", requiresReview: false, cultures: ["en"] } }} feedbackId="recovered-publication" onReplay={vi.fn()} />);
  await act(async () => {});
  expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "success", message: "Publicamos la versión 2, en inglés." }));
});

it("keeps the published English UI state static and announces the result only once", async () => {
  await i18n.changeLanguage("en");
  const original = session("Publishing");
  renderWithProviders(<PublicationProgress publication={{ ...original, startedHere: true, status: { ...original.status!, state: "Published", requiresReview: false } }} feedbackId="published-en" onReplay={vi.fn()} />);
  await act(async () => {});
  expect(screen.getByText("On WhatsApp, in Spanish and English").closest('[role="status"], [role="alert"], [aria-live]')).toBeNull();
  expect(screen.getByRole("heading", { name: "Published · version 2" })).toBeInTheDocument();
  expect(notify).toHaveBeenCalledOnce();
});

// Consulting and replaying act on the whole publication: they go in the header of its surface, and the wait of a 429 is their reason.
it("puts consult and replay in the header of the publication and explains the wait as their reason", async () => {
  const wait = "Esperá 30 segundos para volver a intentar.";
  const publication = { ...session("Publishing"), phase: "Unconfirmed" as const, canReplay: true, error: new ApiError(429, { code: "RateLimit.Exceeded", retryAfter: 30 }) };
  await act(async () => { renderWithProviders(<PublicationProgress publication={publication} feedbackId="publication-wait" onReplay={vi.fn()} />); });
  const band = within(screen.getByRole("region", { name: "Publicación sin confirmar" })).getByRole("heading", { name: "Publicación sin confirmar" }).parentElement!;
  for (const name of ["Consultar publicación", "Repetir el mismo intento"]) {
    const button = within(band).getByRole("button", { name });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(wait);
  }
  for (const text of screen.getAllByText(wait)) expect(text).not.toBeVisible();
});
