import { AiAssistantPage } from "./AiAssistantPage";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { StrictMode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { AppProviders } from "@/app/providers";
import { routes } from "@/app/routes";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { queryClient } from "@/shared/api/queryClient";
import { server } from "@/test/mocks/server";
import { currentUser } from "@/test/mocks/handlers";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { installMicrophone, removeMicrophone } from "@/test/mocks/mediaRecorder";
import { captureUploads } from "@/test/mocks/xhrUpload";
import { AssistantProposalContext, type AssistantProposalCardProps, type AssistantProposalExtension } from "@/shared/hooks/assistantProposalContext";
import type {
  AssistantAccepted,
  AssistantTurn,
  AssistantSubmit,
} from "../api/assistant";
// Draft recovery/navigation checks need a complete value; keyboard behavior has its own case below.
async function pasteText(control: HTMLElement, text: string) {
  const user = userEvent.setup();
  await user.click(control);
  await user.paste(text);
}
vi.mock("react-oidc-context", async () => ({
  ...(await vi.importActual<typeof import("react-oidc-context")>(
    "react-oidc-context",
  )),
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { access_token: "t" },
  }),
}));
let writes: AssistantSubmit[];
let turn: AssistantTurn;
let access = "allowed";
const conversationId = "0199a0c0-0000-7000-8000-000000000111";
const pageOf = (items: unknown[]) => ({
  items,
  page: 1,
  pageSize: 20,
  totalCount: items.length,
  totalPages: items.length ? 1 : 0,
  hasPrevious: false,
  hasNext: false,
});
const acceptedOf = (value: AssistantTurn): AssistantAccepted => ({
  conversationId: value.conversationId,
  requestId: value.requestId,
  conversationRevision: value.conversationRevision,
  turnRevision: value.turnRevision,
  state: value.state,
  stage: value.stage,
  submittedAtUtc: value.submittedAtUtc,
  serverNowUtc: value.serverNowUtc,
  pollingAfterSeconds: value.pollingAfterSeconds,
});
const evidenceId = "0199a0c0-0000-7000-8000-000000000444";
beforeEach(() => {
  queryClient.clear();
  writes = [];
  access = "allowed";
  turn = {
    turnId: "0199a0c0-0000-7000-8000-000000000222",
    requestId: "0199a0c0-0000-7000-8000-000000000333",
    conversationId,
    ordinal: 1,
    conversationRevision: 2,
    turnRevision: 2,
    state: "completed",
    stage: "finished",
    contentAccess: "allowed",
    question: "Consulta anterior",
    answer: {
      kind: "answer",
      text: "Hay tres usuarios activos.",
      evidenceIds: [evidenceId],
    },
    evidences: [
      {
        id: evidenceId,
        sourceId: "users.summary",
        sourceVersion: 1,
        observedAtUtc: "2026-10-04T12:00:00Z",
        revision: null,
        destination: "users",
        requiredPermissions: ["users.read"],
        rows: [{ id: null, values: [{ label: "Activos", value: "3" }] }],
        isComplete: true,
      },
    ],
    failure: null,
    usage: null,
    culture: "es",
    timeZoneId: "UTC",
    submittedAtUtc: "2026-10-04T12:00:00Z",
    serverNowUtc: "2026-10-04T12:00:00Z",
    pollingAfterSeconds: 2,
    cancelRequestedAtUtc: null,
  };
  server.use(
    http.get("/api/me", () =>
      HttpResponse.json({
        ...currentUser,
        permissions: ["ai.assistant.use", "users.read", "roles.read"],
      }),
    ),
    http.get("/api/settings/presentation", () =>
      HttpResponse.json({ installedFeatures: ["assistant"] }),
    ),
    http.get("/api/ai/assistant/bootstrap", () =>
      HttpResponse.json({
        availability: "available",
        connectionRevision: 7,
        suggestions: [
          { id: "users", question: "¿Cuántos usuarios activos hay?" },
        ],
        limits: { questionMaxLength: 4000 },
        configurationDestination: null,
        audio: false,
        attachments: false,
      }),
    ),
    http.get("/api/ai/assistant/conversations", () =>
      HttpResponse.json(
        pageOf([
          {
            conversationId,
            revision: 2,
            title: "Conversación",
            contentAccess: access,
            lastActivityAtUtc: turn.submittedAtUtc,
          },
        ]),
      ),
    ),
    http.get("/api/ai/assistant/conversations/:id", () =>
      HttpResponse.json({
        conversationId,
        revision: 2,
        title: "Conversación",
        contentAccess: access,
        activeRequestId: turn.state === "running" ? turn.requestId : null,
        lastActivityAtUtc: turn.submittedAtUtc,
      }),
    ),
    http.get("/api/ai/assistant/conversations/:id/turns", () =>
      HttpResponse.json(pageOf(access === "allowed" ? [turn] : [])),
    ),
    http.get("/api/ai/assistant/turns/:id", () => HttpResponse.json(turn)),
    http.post("/api/ai/assistant/turns", async ({ request }) => {
      const body = (await request.json()) as AssistantSubmit;
      writes.push(body);
      turn = { ...turn, requestId: body.requestId, question: body.question };
      return HttpResponse.json(acceptedOf(turn), { status: 202 });
    }),
    http.post("/api/ai/assistant/turns/:id/cancel", () => {
      turn = { ...turn, state: "canceled", stage: "finished", turnRevision: 3, cancelRequestedAtUtc: turn.cancelRequestedAtUtc ?? "2026-10-04T12:00:02Z",
        failure: { code: "Ai.Assistant.Canceled", detail: "Cancelación confirmada.", recovery: "newAttempt" } };
      return HttpResponse.json(turn);
    }),
    http.delete(
      "/api/ai/assistant/conversations/:id",
      () => new HttpResponse(null, { status: 204 }),
    ),
  );
});
afterEach(() => {
  queryClient.clear();
  toast.dismiss();
  vi.restoreAllMocks();
});
describe("authenticated assistant", () => {
  it("opens a fresh chat with an internal history panel and resumes only by explicit selection", async () => {
    const { router } = renderRouteWithProviders("/");
    const panel = await screen.findByRole("complementary", { name: "Conversaciones" });
    expect(screen.queryByRole("button", { name: "Historial" })).not.toBeInTheDocument();
    expect(screen.queryByText("Hay tres usuarios activos.")).not.toBeInTheDocument();
    expect(writes).toHaveLength(0);
    await userEvent.click(await within(panel).findByRole("button", { name: "Conversación" }));
    await screen.findByText("Hay tres usuarios activos.");
    expect(router.state.location.search).toContain(conversationId);
    await userEvent.click(within(panel).getByRole("button", { name: "Nueva conversación" }));
    await screen.findByRole("heading", { name: "¿Qué querés consultar?" });
    expect(router.state.location.search).not.toContain("conversacion=");
    expect(writes).toHaveLength(0);
  });
  it("keeps the draft and selection when a native row requests a canceled switch", async () => {
    const { router } = renderRouteWithProviders("/");
    const field = await screen.findByRole("textbox", { name: "Tu pregunta" });
    await pasteText(field, "Borrador privado");
    await userEvent.click(await screen.findByRole("button", { name: "Conversación" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Seguir editando" }));
    expect(field).toHaveValue("Borrador privado");
    expect(router.state.location.search).not.toContain("conversacion=");
    expect(writes).toHaveLength(0);
  });
  it("preserves the composer while folding history and never generates on page changes", async () => {
    const reads: URL[] = [];
    server.use(http.get("/api/ai/assistant/conversations", ({ request }) => {
      const url = new URL(request.url); reads.push(url);
      return HttpResponse.json({ ...pageOf([{ conversationId, revision: 2, title: "Conversación", contentAccess: "allowed", lastActivityAtUtc: turn.submittedAtUtc }]), page: Number(url.searchParams.get("page")), totalCount: 21, totalPages: 2, hasNext: url.searchParams.get("page") === "1", hasPrevious: url.searchParams.get("page") === "2" });
    }));
    const { router } = renderRouteWithProviders("/");
    const field = await screen.findByRole("textbox", { name: "Tu pregunta" });
    await pasteText(field, "Borrador de página");
    await userEvent.click(await screen.findByRole("button", { name: "Página siguiente" }));
    await waitFor(() => expect(router.state.location.search).toContain("page=2"));
    expect(reads.every(url => url.searchParams.get("pageSize") === "20" && url.searchParams.get("sort") === "-lastActivityAtUtc")).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Ocultar conversaciones" }));
    expect(field).toHaveValue("Borrador de página");
    expect(screen.queryByRole("complementary", { name: "Conversaciones" })).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Mostrar conversaciones" })[0]);
    await screen.findByRole("complementary", { name: "Conversaciones" });
    expect(field).toHaveValue("Borrador de página");
    expect(writes).toHaveLength(0);
  });
  it("announces a terminal transition once in StrictMode across repeated GETs", async () => {
    const error = vi.spyOn(toast, "error");
    turn = { ...turn, state: "running", stage: "consulting", answer: null, evidences: [] };
    const router = createMemoryRouter(routes, {
      initialEntries: [`/?conversacion=${conversationId}`],
    });
    render(
      <StrictMode>
        <AppProviders>
          <RouterProvider router={router} />
        </AppProviders>
      </StrictMode>,
    );
    await screen.findByRole("button", {
      name: "Cancelar consulta",
    });
    turn = {
      ...turn,
      state: "failed",
      stage: "finished",
      failure: {
        code: "Ai.Assistant.ProviderRejected",
        detail: "El proveedor rechazó la consulta.",
        recovery: "newAttempt",
      },
    };
    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: ["assistant", currentUser.id],
      });
    });
    await waitFor(() => expect(error).toHaveBeenCalledTimes(1));
    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: ["assistant", currentUser.id],
      });
    });
    expect(error).toHaveBeenCalledTimes(1);
    expect(writes).toHaveLength(0);
  });
  it("does not notify expected durable cancellation as an operational error", async () => {
    const error = vi.spyOn(toast, "error");
    turn = { ...turn, state: "running", stage: "consulting", answer: null, evidences: [] };
    server.use(
      http.post("/api/ai/assistant/turns/:id/cancel", () => {
        turn = {
          ...turn,
          state: "canceled",
          stage: "finished",
          cancelRequestedAtUtc: turn.cancelRequestedAtUtc ?? "2026-10-04T12:00:02Z",
          failure: {
            code: "Ai.Assistant.Canceled",
            detail: "Cancelación confirmada.",
            recovery: "newAttempt",
          },
        };
        return HttpResponse.json(turn);
      }),
    );
    renderRouteWithProviders(`/?conversacion=${conversationId}`);
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Cancelar consulta",
      }),
    );
    await screen.findByText("Consulta cancelada", { exact: true });
    expect(error).not.toHaveBeenCalled();
    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: ["assistant", currentUser.id],
      });
    });
    expect(error).not.toHaveBeenCalled();
  });
  it("sends one typed request, publishes confirmed evidence and follows the confirmed revision", async () => {
    const { router } = renderRouteWithProviders("/");
    const field = await screen.findByRole("textbox", { name: "Tu pregunta" });
    await userEvent.click(
      screen.getByRole("button", { name: "¿Cuántos usuarios activos hay?" }),
    );
    expect(field).toHaveValue("¿Cuántos usuarios activos hay?");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await screen.findByText("Hay tres usuarios activos.");
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      conversationId: null,
      expectedRevision: null,
      expectedConnectionRevision: 7,
    });
    expect(router.state.location.search).toContain("conversacion=");
    expect(screen.getByRole("link", { name: "Abrir fuente" })).toHaveAttribute(
      "href",
      "/usuarios",
    );
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
    await pasteText(
      screen.getByRole("textbox", { name: "Tu pregunta" }),
      "Y los inactivos?",
    );
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]).toMatchObject({ conversationId, expectedRevision: 2 });
    expect(writes[1].requestId).not.toBe(writes[0].requestId);
  });
  it("polls a pending acceptance until the turn completes and shows the answer", async () => {
    const completed = turn;
    let turnReads = 0;
    server.use(
      http.post("/api/ai/assistant/turns", async ({ request }) => {
        const body = (await request.json()) as AssistantSubmit;
        writes.push(body);
        turn = {
          ...completed,
          requestId: body.requestId,
          question: body.question,
          state: "pending",
          stage: "pending",
          answer: null,
          evidences: [],
          pollingAfterSeconds: 1,
        };
        return HttpResponse.json(acceptedOf(turn), { status: 202 });
      }),
      http.get("/api/ai/assistant/turns/:id", () => {
        turnReads++;
        if (turnReads > 1)
          turn = {
            ...turn,
            state: "completed",
            stage: "finished",
            answer: completed.answer,
            evidences: completed.evidences,
            turnRevision: turn.turnRevision + 1,
          };
        return HttpResponse.json(turn);
      }),
      http.get("/api/ai/assistant/conversations/:id", () =>
        HttpResponse.json({
          conversationId,
          revision: turn.conversationRevision,
          title: "Conversación",
          contentAccess: "allowed",
          activeRequestId: turn.state === "pending" ? turn.requestId : null,
          lastActivityAtUtc: turn.submittedAtUtc,
        }),
      ),
    );
    renderRouteWithProviders("/");
    await pasteText(
      await screen.findByRole("textbox", { name: "Tu pregunta" }),
      "¿Cuántos usuarios activos hay?",
    );
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(
      await screen.findByText("Hay tres usuarios activos.", undefined, {
        timeout: 3000,
      }),
    ).toBeInTheDocument();
    expect(turnReads).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/^states\./)).not.toBeInTheDocument();
    expect(writes).toHaveLength(1);
  });
  it("keeps Enter as newline and respects IME before Ctrl+Enter", async () => {
    renderRouteWithProviders("/");
    const field = await screen.findByRole("textbox", { name: "Tu pregunta" });
    await userEvent.type(field, "Primera{Enter}segunda");
    expect(field).toHaveValue("Primera\nsegunda");
    expect(writes).toHaveLength(0);
    fireEvent.compositionStart(field);
    fireEvent.keyDown(field, {
      key: "Enter",
      ctrlKey: true,
      isComposing: true,
    });
    expect(writes).toHaveLength(0);
    fireEvent.compositionEnd(field);
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    await waitFor(() => expect(writes).toHaveLength(1));
  });
  it("does not repeat a lost acceptance and recovers by UUID without clearing the draft", async () => {
    const error = vi.spyOn(toast, "warning");
    server.use(
      http.post("/api/ai/assistant/turns", async ({ request }) => {
        writes.push((await request.json()) as AssistantSubmit);
        return HttpResponse.error();
      }),
      http.get("/api/ai/assistant/turns/:id", () =>
        HttpResponse.json({ code: "Ai.Assistant.NotFound" }, { status: 404 }),
      ),
    );
    renderRouteWithProviders("/");
    const field = await screen.findByRole("textbox", { name: "Tu pregunta" });
    await pasteText(field, "Pregunta privada");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await screen.findByText("Aceptación por confirmar");
    expect(field).toHaveValue("Pregunta privada");
    expect(writes).toHaveLength(1);
    await userEvent.click(
      screen.getAllByRole("button", { name: "Consultar estado" })[0],
    );
    await waitFor(() => expect(error).toHaveBeenCalled());
    expect(writes).toHaveLength(1);
    await userEvent.click(
      screen.getByRole("button", { name: "Repetir el mismo pedido" }),
    );
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]).toEqual(writes[0]);
  });
  it("purges blocked history and never renders its payload", async () => {
    access = "blocked";
    renderRouteWithProviders(`/?conversacion=${conversationId}`);
    await screen.findByText(
      "Ya no tenés acceso al contenido de esta conversación",
    );
    expect(screen.queryByText(turn.question!)).not.toBeInTheDocument();
    expect(screen.queryByText(turn.answer!.text)).not.toBeInTheDocument();
    expect(
      JSON.stringify(
        queryClient
          .getQueryCache()
          .getAll()
          .filter((query) => query.queryKey[0] === "assistant")
          .map((query) => query.state.data),
      ),
    ).not.toContain("Hay tres usuarios");
  });
  // I8: a conversation the server cannot decrypt is listed with the generic title, says so and is deleted from the panel.
  it("explains an unreadable conversation and deletes it from the panel", async () => {
    access = "unavailable";
    let deleted: string | undefined;
    server.use(http.get("/api/ai/assistant/conversations/:id/turns", () =>
      HttpResponse.json(pageOf([{ ...turn, contentAccess: "unavailable", question: null, answer: null, evidences: [] }]))));
    server.use(http.delete("/api/ai/assistant/conversations/:id", ({ params }) => {
      deleted = String(params.id);
      return new HttpResponse(null, { status: 204 });
    }));
    renderRouteWithProviders(`/?conversacion=${conversationId}`);
    await screen.findByText("No pudimos leer el contenido de esta conversación. Podés eliminarla desde Conversaciones.");
    expect(screen.queryByText(turn.question!)).not.toBeInTheDocument();
    const panel = await screen.findByRole("complementary", { name: "Conversaciones" });
    (await within(panel).findByRole("button", { name: "Acciones de Conversación" })).focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.click(await screen.findByRole("menuitem", { name: "Eliminar conversación" }));
    const dialog = await screen.findByRole("dialog", { name: "¿Eliminar esta conversación?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Eliminar conversación" }));
    await waitFor(() => expect(deleted).toBe(conversationId));
    expect(writes).toHaveLength(0);
  });
  // I8: a single unreadable turn leaves only that turn out of the thread.
  it("leaves an unreadable turn out of the thread and still shows the others", async () => {
    const unreadable = { ...turn, turnId: "0199a0c0-0000-7000-8000-000000000555", requestId: "0199a0c0-0000-7000-8000-000000000666", ordinal: 2,
      contentAccess: "unavailable", question: null, answer: null, evidences: [] };
    server.use(http.get("/api/ai/assistant/conversations/:id/turns", () => HttpResponse.json(pageOf([unreadable, turn]))));
    renderRouteWithProviders(`/?conversacion=${conversationId}`);
    await screen.findByText("Hay tres usuarios activos.");
    expect(screen.getByText("Consulta anterior")).toBeInTheDocument();
    expect(screen.queryByText("No pudimos leer el contenido de esta conversación. Podés eliminarla desde Conversaciones.")).not.toBeInTheDocument();
  });
  // I8, review: the title comes from the first turn, so a conversation whose first turn cannot be read still shows the readable ones,
  // does not say it cannot be read, and goes on.
  it("keeps the readable turns of a conversation whose first turn cannot be read and lets it go on", async () => {
    access = "unavailable";
    const first = { ...turn, turnId: "0199a0c0-0000-7000-8000-000000000555", requestId: "0199a0c0-0000-7000-8000-000000000666", ordinal: 1,
      contentAccess: "unavailable", question: null, answer: null, evidences: [] };
    turn = { ...turn, ordinal: 2 };
    server.use(http.get("/api/ai/assistant/conversations/:id/turns", () => HttpResponse.json(pageOf([first, turn]))));
    renderRouteWithProviders(`/?conversacion=${conversationId}`);
    await screen.findByText("Hay tres usuarios activos.");
    expect(screen.queryByText("No pudimos leer el contenido de esta conversación. Podés eliminarla desde Conversaciones.")).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: "Tu pregunta" }), "¿Y los inactivos?");
    await waitFor(() => expect(screen.getByRole("button", { name: "Enviar" })).toBeEnabled());
  });
  it("removes previously readable history when its source permission is revoked", async () => {
    renderRouteWithProviders(`/?conversacion=${conversationId}`);
    await screen.findByText("Hay tres usuarios activos.");
    access = "blocked";
    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: ["assistant", currentUser.id],
      });
    });
    await screen.findByText(
      "Ya no tenés acceso al contenido de esta conversación",
    );
    expect(
      screen.queryByText("Hay tres usuarios activos."),
    ).not.toBeInTheDocument();
    expect(
      JSON.stringify(
        queryClient
          .getQueryCache()
          .findAll({ queryKey: ["assistant", currentUser.id] })
          .map((query) => query.state.data),
      ),
    ).not.toContain("Hay tres usuarios");
    expect(writes).toHaveLength(0);
  });
  it("hides confirmed source content as soon as the refreshed profile loses its permission", async () => {
    renderRouteWithProviders(`/?conversacion=${conversationId}`);
    await screen.findByText("Hay tres usuarios activos.");
    access = "blocked";
    await act(async () => {
      queryClient.setQueryData(["current-user"], {
        ...currentUser,
        permissions: ["ai.assistant.use"],
      });
    });
    await waitFor(() =>
      expect(
        screen.queryByText("Hay tres usuarios activos."),
      ).not.toBeInTheDocument(),
    );
  });
  it("keeps a draft and asks before browser Back changes conversation", async () => {
    const { router } = renderRouteWithProviders("/");
    await screen.findByRole("textbox", { name: "Tu pregunta" });
    await act(async () => {
      await router.navigate(`/?conversacion=${conversationId}`);
    });
    await screen.findByText("Hay tres usuarios activos.");
    const field = screen.getByRole("textbox", { name: "Tu pregunta" });
    await pasteText(field, "Borrador privado");
    await act(async () => {
      await router.navigate(-1);
    });
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Seguir editando" }),
    );
    expect(field).toHaveValue("Borrador privado");
    expect(router.state.location.search).toContain(conversationId);
    expect(writes).toHaveLength(0);
  });
  it("keeps a draft when new conversation is canceled", async () => {
    renderRouteWithProviders("/");
    const field = await screen.findByRole("textbox", { name: "Tu pregunta" });
    await pasteText(field, "Borrador");
    await userEvent.click(
      screen.getByRole("button", { name: "Nueva conversación" }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Seguir editando" }),
    );
    expect(field).toHaveValue("Borrador");
    expect(writes).toHaveLength(0);
  });
  it("shows the durable cancellation request while the running operation remains active", async () => {
    turn = { ...turn, state: "running", stage: "consulting", answer: null, evidences: [] };
    server.use(
      http.post("/api/ai/assistant/turns/:id/cancel", () => {
        turn = { ...turn, cancelRequestedAtUtc: "2026-10-04T12:00:02Z" };
        return HttpResponse.json(turn);
      }),
    );
    renderRouteWithProviders(`/?conversacion=${conversationId}`);
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Cancelar consulta",
      }),
    );
    expect(
      await screen.findByRole("button", {
        name: "Cancelación solicitada",
      }),
    ).toBeDisabled();
    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: ["assistant", currentUser.id],
      });
    });
    expect(
      screen.getByRole("button", {
        name: "Cancelación solicitada",
      }),
    ).toBeDisabled();
    expect(turn.state).toBe("running");
    expect(writes).toHaveLength(0);
  });
  it("publishes the confirmed completion when cancellation loses its race", async () => {
    const answer = turn.answer;
    turn = { ...turn, state: "running", stage: "consulting", answer: null };
    server.use(
      http.post("/api/ai/assistant/turns/:id/cancel", () => {
        turn = { ...turn, state: "completed", stage: "finished", answer };
        return HttpResponse.json(turn);
      }),
    );
    renderRouteWithProviders(`/?conversacion=${conversationId}`);
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Cancelar consulta",
      }),
    );
    await screen.findByText("Hay tres usuarios activos.");
    expect(
      screen.queryByRole("button", { name: "Cancelar consulta" }),
    ).not.toBeInTheDocument();
  });
  it("does not query assistant APIs when its module is absent", async () => {
    let reads = 0;
    server.use(
      http.get("/api/settings/presentation", () =>
        HttpResponse.json({ installedFeatures: [] }),
      ),
      http.get("/api/ai/assistant/bootstrap", () => {
        reads++;
        return HttpResponse.json({});
      }),
    );
    renderRouteWithProviders("/");
    await screen.findByRole("heading", { name: "Inicio" });
    await waitFor(() =>
      expect(queryClient.getQueryState(["system-presentation"])?.status).toBe(
        "success",
      ),
    );
    expect(reads).toBe(0);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
  it("shows cooldown once and preserves the question after 429", async () => {
    const error = vi.spyOn(toast, "error");
    server.use(
      http.post("/api/ai/assistant/turns", () =>
        HttpResponse.json(
          {
            code: "Ai.Assistant.CapacityLimited",
            detail: "Esperá para continuar.",
            retryAfter: 42,
          },
          { status: 429 },
        ),
      ),
    );
    renderRouteWithProviders("/");
    const field = await screen.findByRole("textbox", { name: "Tu pregunta" });
    await pasteText(field, "Borrador de espera");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await screen.findByText("Esperá 42 s para enviar otra consulta.");
    expect(field).toHaveValue("Borrador de espera");
    expect(error).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
  });
  // Decision 8: the quota counts by UTC day. With its 429, Home says the hour it renews in the profile's zone, from retryAfter,
  // instead of hours of seconds: 00:00 UTC is 21:00 in Buenos Aires.
  it("says the local hour the daily quota renews, from the 429's retryAfter", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-11-15T15:00:00Z"));
      const error = vi.spyOn(toast, "error");
      server.use(
        http.post("/api/ai/assistant/turns", () =>
          HttpResponse.json(
            {
              code: "Ai.Assistant.QuotaExceeded",
              detail: "Alcanzaste la cuota de consultas aceptadas. Esperá el plazo indicado.",
              retryAfter: 32400,
            },
            { status: 429 },
          ),
        ),
      );
      renderRouteWithProviders("/");
      const field = await screen.findByRole("textbox", { name: "Tu pregunta" });
      await pasteText(field, "Borrador de cuota");
      await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
      expect(await screen.findByText("Podés enviar otra consulta a las 21:00, cuando se renueva la cuota del día."))
        .toHaveAttribute("role", "status");
      expect(screen.queryByText(/Esperá \d+ s/)).not.toBeInTheDocument();
      expect(field).toHaveValue("Borrador de cuota");
      expect(error).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });
});
// Every action that waits for the server shows it on the control that was touched: the spinner and what it is doing.
describe("assistant waits", () => {
  const running = () => ({ ...turn, state: "running" as const, stage: "consulting" as const, answer: null, evidences: [] });
  it("shows the spinner in place of the arrow while the question is being sent", async () => {
    let release: (() => void) | undefined;
    server.use(http.post("/api/ai/assistant/turns", async ({ request }) => {
      const body = (await request.json()) as AssistantSubmit;
      writes.push(body);
      await new Promise<void>((resolve) => { release = resolve; });
      turn = { ...turn, requestId: body.requestId, question: body.question };
      return HttpResponse.json(acceptedOf(turn), { status: 202 });
    }));
    renderRouteWithProviders("/");
    await pasteText(await screen.findByRole("textbox", { name: "Tu pregunta" }), "¿Cuántos usuarios activos hay?");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    const sending = await screen.findByRole("button", { name: "Enviando…" });
    expect(sending).toHaveAttribute("aria-busy", "true");
    await waitFor(() => expect(release).toBeDefined());
    release!();
    await screen.findByText("Hay tres usuarios activos.");
    expect(screen.queryByRole("button", { name: "Enviando…" })).not.toBeInTheDocument();
  });
  it("shows «Cancelando…» on «Cancelar consulta» until the cancellation is requested", async () => {
    turn = running();
    let release: (() => void) | undefined;
    server.use(http.post("/api/ai/assistant/turns/:id/cancel", async () => {
      await new Promise<void>((resolve) => { release = resolve; });
      turn = { ...turn, cancelRequestedAtUtc: "2026-10-04T12:00:02Z" };
      return HttpResponse.json(turn);
    }));
    renderRouteWithProviders(`/?conversacion=${conversationId}`);
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar consulta" }));
    expect(screen.getByRole("button", { name: "Cancelando…" })).toHaveAttribute("aria-busy", "true");
    await waitFor(() => expect(release).toBeDefined());
    release!();
    expect(await screen.findByRole("button", { name: "Cancelación solicitada" })).toBeDisabled();
  });
  it("keeps the decision open with «Cancelando…» and the other choices off while it cancels", async () => {
    turn = running();
    let release: (() => void) | undefined;
    server.use(http.post("/api/ai/assistant/turns/:id/cancel", async () => {
      await new Promise<void>((resolve) => { release = resolve; });
      turn = { ...turn, state: "canceled", stage: "finished", cancelRequestedAtUtc: "2026-10-04T12:00:02Z",
        failure: { code: "Ai.Assistant.Canceled", detail: "Cancelación confirmada.", recovery: "newAttempt" } };
      return HttpResponse.json(turn);
    }));
    const { router } = renderRouteWithProviders(`/?conversacion=${conversationId}`);
    await screen.findByRole("button", { name: "Cancelar consulta" });
    await userEvent.click(screen.getByRole("button", { name: "Nueva conversación" }));
    const dialog = await screen.findByRole("dialog", { name: "¿Empezar otra conversación?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar y continuar" }));
    expect(within(dialog).getByRole("button", { name: "Cancelando…" })).toHaveAttribute("aria-busy", "true");
    expect(within(dialog).getByRole("button", { name: "Seguir editando" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Continuar en segundo plano" })).toBeDisabled();
    // Escape does not leave it halfway: the decision waits for the answer.
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "¿Empezar otra conversación?" })).toBe(dialog);
    await waitFor(() => expect(release).toBeDefined());
    release!();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(router.state.location.search).not.toContain("conversacion="));
  });
  it("shows on its own button when the acceptance is being checked and when the same request is being repeated", async () => {
    let turnReads = 0;
    let releaseCheck: (() => void) | undefined;
    let releaseRepeat: (() => void) | undefined;
    server.use(
      http.post("/api/ai/assistant/turns", async ({ request }) => {
        const body = (await request.json()) as AssistantSubmit;
        writes.push(body);
        if (writes.length === 1) return HttpResponse.error();
        await new Promise<void>((resolve) => { releaseRepeat = resolve; });
        turn = { ...turn, requestId: body.requestId, question: body.question };
        return HttpResponse.json(acceptedOf(turn), { status: 202 });
      }),
      http.get("/api/ai/assistant/turns/:id", async () => {
        turnReads++;
        if (turnReads > 1) return HttpResponse.json(turn);
        await new Promise<void>((resolve) => { releaseCheck = resolve; });
        return HttpResponse.json({ code: "Ai.Assistant.NotFound" }, { status: 404 });
      }),
    );
    renderRouteWithProviders("/");
    await pasteText(await screen.findByRole("textbox", { name: "Tu pregunta" }), "Pregunta privada");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    const acceptance = (await screen.findByText("Aceptación por confirmar")).closest("[role=status]") as HTMLElement;
    await userEvent.click(within(acceptance).getByRole("button", { name: "Consultar estado" }));
    expect(within(acceptance).getByRole("button", { name: "Consultando…" })).toHaveAttribute("aria-busy", "true");
    expect(within(acceptance).getByRole("button", { name: "Repetir el mismo pedido" })).toBeDisabled();
    await waitFor(() => expect(releaseCheck).toBeDefined());
    releaseCheck!();
    await userEvent.click(await within(acceptance).findByRole("button", { name: "Repetir el mismo pedido" }));
    expect(within(acceptance).getByRole("button", { name: "Enviando…" })).toHaveAttribute("aria-busy", "true");
    // The arrow does not say it: the repetition shows it on its own button.
    expect(screen.getByRole("button", { name: "Enviar" })).not.toHaveAttribute("aria-busy");
    await waitFor(() => expect(releaseRepeat).toBeDefined());
    releaseRepeat!();
    await waitFor(() => expect(screen.queryByText("Aceptación por confirmar")).not.toBeInTheDocument());
    expect(writes[1]).toEqual(writes[0]);
  });
  it("shows «Consultando…» on an uncertain turn while its status is read again", async () => {
    turn = { ...turn, state: "uncertain", stage: "finished", answer: null, evidences: [],
      failure: { code: "Ai.Assistant.Uncertain", detail: "No sabemos si terminó.", recovery: "reviewUncertainty" } };
    let hold: Promise<void> | undefined;
    server.use(http.get("/api/ai/assistant/conversations/:id/turns", async () => {
      if (hold) await hold;
      return HttpResponse.json(pageOf([turn]));
    }));
    renderRouteWithProviders(`/?conversacion=${conversationId}`);
    const check = await screen.findByRole("button", { name: "Consultar estado" });
    let release!: () => void;
    hold = new Promise<void>((resolve) => { release = resolve; });
    await userEvent.click(check);
    expect(screen.getByRole("button", { name: "Consultando…" })).toHaveAttribute("aria-busy", "true");
    release();
    expect(await screen.findByRole("button", { name: "Consultar estado" })).toBeEnabled();
  });
  it("shows «Reintentando…» on Retry while the failed history is read again", async () => {
    let fail = true;
    let hold: Promise<void> | undefined;
    server.use(http.get("/api/ai/assistant/conversations/:id/turns", async () => {
      if (hold) await hold;
      return fail ? HttpResponse.json({ code: "Unexpected" }, { status: 500 }) : HttpResponse.json(pageOf([turn]));
    }));
    renderRouteWithProviders(`/?conversacion=${conversationId}`);
    const retry = await screen.findByRole("button", { name: "Reintentar" });
    fail = false;
    let release!: () => void;
    hold = new Promise<void>((resolve) => { release = resolve; });
    await userEvent.click(retry);
    expect(screen.getByRole("button", { name: "Reintentando…" })).toHaveAttribute("aria-busy", "true");
    release();
    await screen.findByText("Hay tres usuarios activos.");
    expect(screen.queryByRole("button", { name: "Reintentando…" })).not.toBeInTheDocument();
  });
  it("shows «Cargando…» on «Cargar anteriores» while the earlier turns arrive", async () => {
    const older = { ...turn, turnId: "0199a0c0-0000-7000-8000-000000000555", requestId: "0199a0c0-0000-7000-8000-000000000666", ordinal: 1, question: "Consulta más vieja" };
    turn = { ...turn, ordinal: 2 };
    let release: (() => void) | undefined;
    server.use(http.get("/api/ai/assistant/conversations/:id/turns", async ({ request }) => {
      if (new URL(request.url).searchParams.get("page") === "2") {
        await new Promise<void>((resolve) => { release = resolve; });
        return HttpResponse.json({ ...pageOf([older]), page: 2, totalCount: 2, totalPages: 2, hasPrevious: true });
      }
      return HttpResponse.json({ ...pageOf([turn]), totalCount: 2, totalPages: 2, hasNext: true });
    }));
    renderRouteWithProviders(`/?conversacion=${conversationId}`);
    await userEvent.click(await screen.findByRole("button", { name: "Cargar anteriores" }));
    expect(screen.getByRole("button", { name: "Cargando…" })).toHaveAttribute("aria-busy", "true");
    await waitFor(() => expect(release).toBeDefined());
    release!();
    await screen.findByText("Consulta más vieja");
    expect(screen.queryByRole("button", { name: "Cargando…" })).not.toBeInTheDocument();
  });
  it("keeps the delete confirmation open with «Eliminando…» until the server answers", async () => {
    let release: (() => void) | undefined;
    server.use(http.delete("/api/ai/assistant/conversations/:id", async () => {
      await new Promise<void>((resolve) => { release = resolve; });
      return new HttpResponse(null, { status: 204 });
    }));
    renderRouteWithProviders("/");
    const panel = await screen.findByRole("complementary", { name: "Conversaciones" });
    // The row menu opens from the keyboard, as in the browser scene.
    (await within(panel).findByRole("button", { name: "Acciones de Conversación" })).focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.click(await screen.findByRole("menuitem", { name: "Eliminar conversación" }));
    const dialog = await screen.findByRole("dialog", { name: "¿Eliminar esta conversación?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Eliminar conversación" }));
    expect(within(dialog).getByRole("button", { name: "Eliminando…" })).toHaveAttribute("aria-busy", "true");
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toBeDisabled();
    await waitFor(() => expect(release).toBeDefined());
    release!();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
  it("shows «Reintentando…» on the availability Retry while it reads again", async () => {
    let hold: Promise<void> | undefined;
    server.use(http.get("/api/ai/assistant/bootstrap", async () => {
      if (hold) await hold;
      return HttpResponse.json({ availability: "capacityLimited", connectionRevision: 7, suggestions: [], limits: { questionMaxLength: 4000 }, configurationDestination: null, audio: false, attachments: false });
    }));
    renderRouteWithProviders("/");
    const availability = (await screen.findByText("La capacidad del asistente está ocupada")).closest("[role=status]") as HTMLElement;
    let release!: () => void;
    hold = new Promise<void>((resolve) => { release = resolve; });
    await userEvent.click(within(availability).getByRole("button", { name: "Reintentar" }));
    expect(within(availability).getByRole("button", { name: "Reintentando…" })).toHaveAttribute("aria-busy", "true");
    release();
    expect(await within(availability).findByRole("button", { name: "Reintentar" })).toBeEnabled();
  });
  const proposalTurn = () => ({
    ...turn,
    answer: { kind: "proposal", text: "Te propongo este formulario.", evidenceIds: [] },
    evidences: [],
    proposal: {
      id: "0199a0c0-0000-7000-8000-000000000555",
      capability: "forms.authoring.propose-form",
      version: 1,
      content: { culture: "es", name: "Control de carga", prefix: "CCC", submitLabel: "Enviar",
        questions: [{ label: "Patente", type: "shortText", required: true, options: [], catalog: null }] },
    },
  });
  it("shows the card an installed module lends under the answer, and the composer invites a change", async () => {
    server.use(
      http.get("/api/settings/presentation", () => HttpResponse.json({ installedFeatures: ["assistant", "forms"] })),
      http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["ai.assistant.use", "formtemplates.read", "formtemplates.manage"] })),
      http.get("/api/forms/definitions/assistant-proposals/:id", ({ params }) => HttpResponse.json({ proposalId: params.id, definitionId: null })),
    );
    turn = proposalTurn();
    renderRouteWithProviders("/?conversacion=" + conversationId);
    const card = await screen.findByRole("region", { name: "Formulario: Control de carga" });
    expect(within(card).getByRole("button", { name: "Crear borrador" })).toBeInTheDocument();
    expect(screen.getByText("Te propongo este formulario.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Tu pregunta" })).toHaveAttribute("placeholder", "Pedí un cambio o hacé otra consulta…");
  });
  it("reads a proposal answer alone when its module is not installed", async () => {
    turn = proposalTurn();
    renderRouteWithProviders("/?conversacion=" + conversationId);
    await screen.findByText("Te propongo este formulario.");
    expect(screen.queryByRole("region", { name: /Control de carga/ })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Tu pregunta" })).toHaveAttribute("placeholder", "Preguntale al sistema…");
  });
  it("adds the module's request to empty Home for whoever can design forms, and leaves it in the composer", async () => {
    server.use(
      http.get("/api/settings/presentation", () => HttpResponse.json({ installedFeatures: ["assistant", "forms"] })),
      http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["ai.assistant.use", "formtemplates.read", "formtemplates.manage"] })),
    );
    renderRouteWithProviders("/");
    const field = await screen.findByRole("textbox", { name: "Tu pregunta" });
    expect(field).toHaveAttribute("placeholder", "Preguntale al sistema o pedile que arme un formulario…");
    await userEvent.click(await screen.findByRole("button", { name: "Armame un formulario para…" }));
    expect(field).toHaveValue("Armame un formulario para ");
    expect(screen.getByRole("button", { name: "¿Cuántos usuarios activos hay?" })).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });
  it("keeps Home's own suggestions and text for whoever cannot design forms", async () => {
    server.use(
      http.get("/api/settings/presentation", () => HttpResponse.json({ installedFeatures: ["assistant", "forms"] })),
      http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["ai.assistant.use", "formtemplates.read"] })),
    );
    renderRouteWithProviders("/", { state: { assistantDraft: "Armame un formulario para " } });
    const field = await screen.findByRole("textbox", { name: "Tu pregunta" });
    expect(field).toHaveAttribute("placeholder", "Preguntale al sistema…");
    expect(field).toHaveValue("Armame un formulario para ");
    expect(screen.queryByRole("button", { name: "Armame un formulario para…" })).not.toBeInTheDocument();
  });
});
describe("dictated turns (IA4)", () => {
  const audioRequestId = "0199a0c0-0000-7000-8000-000000000555";
  const status = (state: string, transcript: string | null, failure: unknown = null) =>
    ({ requestId: audioRequestId, state, transcript, failure, pollingAfterSeconds: 1 });
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:recording");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    server.use(
      http.get("/api/ai/assistant/bootstrap", () => HttpResponse.json({ availability: "available", connectionRevision: 7, suggestions: [],
        limits: { questionMaxLength: 4000 }, configurationDestination: null, audio: true, attachments: false })),
      http.post("/api/ai/assistant/turns", async ({ request }) => {
        const body = (await request.json()) as AssistantSubmit;
        writes.push(body);
        turn = { ...turn, requestId: body.requestId, question: body.question,
          audio: body.audioRequestId ? { requestId: body.audioRequestId, transcript: "Armame un formulario de visitas" } : undefined };
        return HttpResponse.json(acceptedOf(turn), { status: 202 });
      }),
    );
  });
  afterEach(() => removeMicrophone());

  async function record() {
    await userEvent.click(await screen.findByRole("button", { name: "Grabar un audio" }));
    expect(await screen.findByText(/^Grabando · 0:0\d$/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Detener" }));
    expect((await screen.findByLabelText("Tu audio")).tagName).toBe("AUDIO");
  }

  it("records, lets the person listen and sends the recording with its text once the server heard it", async () => {
    installMicrophone();
    const uploads = captureUploads([{ status: 202, body: status("pending", null) }]);
    const polled: string[] = [];
    server.use(http.get("/api/ai/assistant/audio/:id", ({ params }) => {
      polled.push(String(params.id));
      return HttpResponse.json(status("completed", "Armame un formulario de visitas"));
    }));
    renderRouteWithProviders("/");
    await record();
    const field = screen.getByRole("textbox", { name: "Tu pregunta" });
    expect(field).toHaveAttribute("placeholder", "Agregá un texto, si querés…");
    expect(screen.queryByRole("button", { name: "Grabar un audio" })).not.toBeInTheDocument();
    await pasteText(field, "para clientes");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(writes).toHaveLength(1), { timeout: 3000 });
    const uploaded = String(uploads[0].body.get("requestId"));
    expect(uploads[0].url).toBe("/api/ai/assistant/audio");
    expect(polled).toEqual([uploaded]);
    expect(writes[0]).toMatchObject({ question: "para clientes", audioRequestId: uploaded });
    expect(await screen.findByText("Armame un formulario de visitas")).toHaveClass("assistant-transcript");
    expect(screen.getByRole("button", { name: "Escuchar" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Grabar un audio" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Tu audio")).not.toBeInTheDocument();
  });

  it("keeps the recording when the server could not hear it, and a new attempt uploads it under another request", async () => {
    installMicrophone();
    const uploads = captureUploads([
      { status: 202, body: status("failed", null, { code: "Ai.Assistant.ContentUnavailable", detail: "No se pudo leer el audio.", recovery: "newAttempt" }) },
      { status: 202, body: status("completed", "Armame un formulario de visitas") },
    ]);
    renderRouteWithProviders("/");
    await record();
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("No se pudo leer el audio.")).toBeInTheDocument();
    expect(screen.getByLabelText("Tu audio")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(uploads[1].body.get("requestId")).not.toBe(uploads[0].body.get("requestId"));
    expect(writes[0]).toMatchObject({ question: "", audioRequestId: uploads[1].body.get("requestId") });
  });

  it("discards a recording without sending anything", async () => {
    installMicrophone();
    const uploads = captureUploads([{ status: 202, body: status("completed", "x") }]);
    renderRouteWithProviders("/");
    await record();
    await userEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(screen.queryByLabelText("Tu audio")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Tu pregunta" })).toHaveAttribute("placeholder", "Preguntale al sistema…");
    expect(uploads).toHaveLength(0);
    expect(writes).toHaveLength(0);
  });

  it("says so under the composer when the person does not allow the microphone", async () => {
    installMicrophone({ allowed: false });
    renderRouteWithProviders("/");
    await userEvent.click(await screen.findByRole("button", { name: "Grabar un audio" }));
    expect(await screen.findByText("No se pudo usar el micrófono. Revisá el permiso del navegador.")).toBeInTheDocument();
  });

  it("offers no microphone when Home takes no recording or the browser cannot record", async () => {
    server.use(http.get("/api/ai/assistant/bootstrap", () => HttpResponse.json({ availability: "available", connectionRevision: 7, suggestions: [],
      limits: { questionMaxLength: 4000 }, configurationDestination: null, audio: false, attachments: false })));
    installMicrophone();
    renderRouteWithProviders("/");
    await screen.findByRole("textbox", { name: "Tu pregunta" });
    expect(screen.queryByRole("button", { name: "Grabar un audio" })).not.toBeInTheDocument();
  });

  it("starts the common wait after a 429 on the recording's upload: Enviar off with «Esperá N s» and nothing goes up again", async () => {
    installMicrophone();
    const error = vi.spyOn(toast, "error");
    const uploads = captureUploads([{ status: 429, body: { title: "Demasiados pedidos", status: 429, code: "Ai.Assistant.CapacityLimited",
      detail: "Esperá para continuar.", retryAfter: 40 } }]);
    renderRouteWithProviders("/");
    await record();
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("Esperá 40 s para enviar otra consulta.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    expect(error).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Tu audio")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(uploads).toHaveLength(1);
    expect(writes).toHaveLength(0);
    // The person can still discard it while waiting.
    await userEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(screen.queryByLabelText("Tu audio")).not.toBeInTheDocument();
  });

  it("does not upload again a recording the server already heard when its turn did not go", async () => {
    installMicrophone();
    const uploads = captureUploads([{ status: 202, body: status("completed", "Armame un formulario de visitas") }]);
    let rejected = false;
    server.use(http.post("/api/ai/assistant/turns", async ({ request }) => {
      const body = (await request.json()) as AssistantSubmit;
      writes.push(body);
      if (!rejected) {
        rejected = true;
        return HttpResponse.json({ title: "Conflicto", status: 409, code: "Ai.Assistant.ActiveTurn", detail: "Hay otra consulta en curso." }, { status: 409 });
      }
      turn = { ...turn, requestId: body.requestId, question: body.question, audio: { requestId: audioRequestId, transcript: "Armame un formulario de visitas" } };
      return HttpResponse.json(acceptedOf(turn), { status: 202 });
    }));
    renderRouteWithProviders("/");
    await record();
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Enviar" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(uploads).toHaveLength(1);
    expect(writes[1].audioRequestId).toBe(writes[0].audioRequestId);
    expect(writes[1].requestId).not.toBe(writes[0].requestId);
  });
});

// Stage 2: one spreadsheet per message, from the clip or from a suggestion that attaches; the browser stops what it sees does
// not serve and the server says the rest, under the composer and with the file kept.
describe("spreadsheets in Home (Stage 2)", () => {
  const withAttachments = (attachments: boolean) => http.get("/api/ai/assistant/bootstrap", () => HttpResponse.json({ availability: "available",
    connectionRevision: 7, suggestions: [], limits: { questionMaxLength: 4000 }, configurationDestination: null, audio: false, attachments }));
  const fileInput = () => document.querySelector<HTMLInputElement>("input[type=file]")!;
  const choose = (name: string, size = 1024) => {
    const file = new File([new Uint8Array(size)], name);
    fireEvent.change(fileInput(), { target: { files: [file] } });
    return file;
  };
  afterEach(() => vi.unstubAllGlobals());

  it("offers no clip to whoever the bootstrap says may not attach", async () => {
    renderRouteWithProviders("/");
    await screen.findByRole("textbox", { name: "Tu pregunta" });
    expect(screen.queryByRole("button", { name: "Adjuntar una planilla" })).not.toBeInTheDocument();
    expect(document.querySelector("input[type=file]")).toBeNull();
  });

  // Until the joint export brings the field to the captured bootstrap, a bootstrap without it offers no clip.
  it("offers no clip when the bootstrap does not say it", async () => {
    server.use(http.get("/api/ai/assistant/bootstrap", () => HttpResponse.json({ availability: "available", connectionRevision: 7,
      suggestions: [], limits: { questionMaxLength: 4000 }, configurationDestination: null, audio: false })));
    renderRouteWithProviders("/");
    await screen.findByRole("textbox", { name: "Tu pregunta" });
    expect(screen.queryByRole("button", { name: "Adjuntar una planilla" })).not.toBeInTheDocument();
  });

  it("sends the chosen file with the text, showing how much went up, and the message shows its file with its rows", async () => {
    server.use(withAttachments(true));
    let release!: () => void;
    const answer = { status: 202, body: {} as unknown, progress: [0.4], release: new Promise<void>((resolve) => { release = resolve; }) };
    const uploads = captureUploads([answer]);
    renderRouteWithProviders("/");
    const clip = await screen.findByRole("button", { name: "Adjuntar una planilla" });
    expect(clip.compareDocumentPosition(screen.getByRole("button", { name: "Enviar" }))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    const file = choose("clientes.xlsx", 24 * 1024);
    expect(screen.getByText("clientes.xlsx")).toBeInTheDocument();
    expect(screen.getByText("Excel · 24 KB")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adjuntar una planilla" })).not.toBeInTheDocument();
    const field = screen.getByRole("textbox", { name: "Tu pregunta" });
    expect(field).toHaveAttribute("placeholder", "Agregá un texto, si querés…");
    await pasteText(field, "Armame un catálogo");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByRole("button", { name: "Enviando… 40%" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Quitar clientes.xlsx" })).toBeDisabled();
    expect(uploads[0].url).toBe("/api/ai/assistant/file-turns");
    const requestId = String(uploads[0].body.get("requestId"));
    expect(Object.fromEntries([...uploads[0].body.entries()].filter(([key]) => key !== "file")))
      .toEqual({ requestId, expectedConnectionRevision: "7", question: "Armame un catálogo" });
    expect((uploads[0].body.get("file") as File).name).toBe(file.name);
    turn = { ...turn, requestId, question: "Armame un catálogo", attachment: { name: "clientes.xlsx", kind: "xlsx", rows: 86, size: 24 * 1024 } };
    answer.body = acceptedOf(turn);
    release();
    expect(await screen.findByText("Excel · 86 filas · 24 KB")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar clientes.xlsx" })).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Adjuntar una planilla" })).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it("stops in the browser what it sees does not serve, says why under the composer and sends nothing until it is removed", async () => {
    server.use(withAttachments(true));
    const uploads = captureUploads([{ status: 202, body: {} }]);
    renderRouteWithProviders("/");
    await screen.findByRole("button", { name: "Adjuntar una planilla" });
    choose("clientes.xls");
    expect(screen.getByText("No se puede leer un Excel viejo (.xls). Guardalo como .xlsx o .csv.")).toBeInTheDocument();
    expect(screen.getByText("XLS · 1 KB")).toBeInTheDocument();
    // Writing does not hide the reason while the file is there.
    await pasteText(screen.getByRole("textbox", { name: "Tu pregunta" }), "Armame un catálogo");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(screen.getByText("No se puede leer un Excel viejo (.xls). Guardalo como .xlsx o .csv.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Quitar clientes.xls" }));
    expect(screen.queryByText(/Excel viejo/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Adjuntar una planilla" }));
    choose("clientes.xlsx", 10 * 1024 * 1024 + 1);
    // Its weight rounds up: a byte over the limit never reads as the limit itself.
    expect(screen.getByText("La planilla pesa 10,1 MB y el tope es de 10 MB. Achicala o dividila y volvé a adjuntarla.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Quitar clientes.xlsx" }));
    choose("clientes.pdf");
    expect(screen.getByText("Sólo se puede adjuntar un Excel (.xlsx) o un CSV.")).toBeInTheDocument();
    expect(uploads).toHaveLength(0);
    expect(writes).toHaveLength(0);
  });

  it("moves the focus to the X when a file is chosen, and back to the clip when it is removed, never to the page", async () => {
    server.use(withAttachments(true));
    renderRouteWithProviders("/");
    await userEvent.click(await screen.findByRole("button", { name: "Adjuntar una planilla" }));
    choose("clientes.xlsx");
    expect(screen.getByRole("button", { name: "Quitar clientes.xlsx" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(screen.queryByText("clientes.xlsx")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adjuntar una planilla" })).toHaveFocus();
  });

  it("shows the server's reason for a file it did not read under the composer and keeps the file to remove or change it", async () => {
    server.use(withAttachments(true));
    const reason = "No se puede leer una planilla con contraseña. Quitale la contraseña y volvé a adjuntarla.";
    const uploads = captureUploads([{ status: 400, body: { code: "Ai.Assistant.AttachmentProtected", detail: reason, errors: { file: [reason] } } }]);
    renderRouteWithProviders("/");
    await screen.findByRole("button", { name: "Adjuntar una planilla" });
    choose("clientes.xlsx");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText(reason)).toBeInTheDocument();
    expect(screen.getByText("clientes.xlsx")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Tu pregunta" })).toHaveAttribute("aria-invalid", "true");
    // The same file is not sent again: it is removed or changed.
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(uploads).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Quitar clientes.xlsx" }));
    expect(screen.queryByText(reason)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adjuntar una planilla" })).toBeInTheDocument();
  });

  it("asks before browser Back leaves a chosen file unsent, like a draft", async () => {
    server.use(withAttachments(true));
    const { router } = renderRouteWithProviders("/");
    await screen.findByRole("button", { name: "Adjuntar una planilla" });
    await act(async () => {
      await router.navigate(`/?conversacion=${conversationId}`);
    });
    await screen.findByText("Hay tres usuarios activos.");
    choose("clientes.csv");
    expect(screen.getByText("CSV · 1 KB")).toBeInTheDocument();
    await act(async () => {
      await router.navigate(-1);
    });
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Seguir editando" }));
    expect(screen.getByText("clientes.csv")).toBeInTheDocument();
    expect(router.state.location.search).toContain(conversationId);
  });
});

// Stage 3: the message names the document a turn brought by its kind, the pages of a PDF (a photo is one, not counted) and its size;
// a Word renamed .xlsx passes the clip's filter and comes back as what it is.
describe("a document a turn brought (Stage 3)", () => {
  it.each([
    ["a Word renamed .xlsx", { name: "acta.xlsx", kind: "docx" as const, size: 12 * 1024 }, "Word · 12 KB"],
    ["a PDF with its pages", { name: "acta.pdf", kind: "pdf" as const, size: 96 * 1024, pages: 3 }, "PDF · 3 páginas · 96 KB"],
    ["a PDF of one page", { name: "acta.pdf", kind: "pdf" as const, size: 412 * 1024, pages: 1 }, "PDF · 1 página · 412 KB"],
    ["a photo, without its page", { name: "remito.jpeg", kind: "jpeg" as const, size: 1258291, pages: 1 }, "Foto · 1,2 MB"],
  ])("opens the conversation and shows %s by its name", async (_, attachment, description) => {
    turn = { ...turn, question: "", attachment };
    renderRouteWithProviders(`/?conversacion=${conversationId}`);
    expect(await screen.findByText(attachment.name)).toBeInTheDocument();
    expect(screen.getByText(description)).toBeInTheDocument();
    expect(screen.getByText("Hay tres usuarios activos.")).toBeInTheDocument();
  });
});

// Stage 3: the clip takes what the bootstrap says this person may attach. A photo or a PDF goes up under its own request and is read
// before its turn, which names the reading; a Word goes with its turn, like a spreadsheet.
describe("documents in Home (Stage 3)", () => {
  const documentRequestId = "0199a0c0-0000-7000-8000-000000000666";
  const read = { name: "comprobante.pdf", kind: "pdf", pages: 2, size: 412 * 1024, readability: "readable", problem: null };
  const status = (state: string, document: unknown = null, failure: unknown = null) =>
    ({ requestId: documentRequestId, state, document, failure, pollingAfterSeconds: 1 });
  let bootstrapReads: number;
  const withKinds = (kinds: { attachments?: boolean; documents?: boolean; documentReading?: boolean; audio?: boolean;
    suggestions?: { id: string; question: string }[] }) =>
    http.get("/api/ai/assistant/bootstrap", () => {
      bootstrapReads++;
      return HttpResponse.json({ availability: "available", connectionRevision: 7, suggestions: [], limits: { questionMaxLength: 4000 },
        configurationDestination: null, audio: false, ...kinds });
    });
  const all = { attachments: true, documents: true, documentReading: true };
  const fileInput = () => document.querySelector<HTMLInputElement>("input[type=file]")!;
  const choose = (name: string, size = 1024) => {
    const file = new File([new Uint8Array(size)], name);
    fireEvent.change(fileInput(), { target: { files: [file] } });
    return file;
  };
  // The turn that names a reading shows its document, as the server would.
  const turnsWithDocument = () => http.post("/api/ai/assistant/turns", async ({ request }) => {
    const body = (await request.json()) as AssistantSubmit;
    writes.push(body);
    turn = { ...turn, requestId: body.requestId, question: body.question,
      attachment: body.documentRequestId ? { name: read.name, kind: "pdf", pages: 2, size: read.size } : undefined };
    return HttpResponse.json(acceptedOf(turn), { status: 202 });
  });
  beforeEach(() => { bootstrapReads = 0; });
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ["a Word, to whoever designs forms", { documents: true }, ".docx"],
    ["also a photo or a PDF, when the installation reads them", { documents: true, documentReading: true }, ".pdf,.jpg,.jpeg,.png,.docx"],
    ["every kind, also to whoever manages catalogs", all, ".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.csv"],
  ])("offers the clip to attach a file: %s", async (_, kinds, accept) => {
    server.use(withKinds(kinds));
    renderRouteWithProviders("/");
    expect(await screen.findByRole("button", { name: "Adjuntar un archivo" })).toBeInTheDocument();
    expect(fileInput()).toHaveAttribute("accept", accept);
  });

  it("reads a PDF before its turn: how much went up, «Leyendo el documento…» while it is read, and the turn names its reading", async () => {
    server.use(withKinds({ ...all, suggestions: [{ id: "users", question: "¿Cuántos usuarios activos hay?" }] }), turnsWithDocument());
    let releaseUpload!: () => void;
    const uploads = captureUploads([{ status: 202, body: status("pending"), progress: [0.4],
      release: new Promise<void>((resolve) => { releaseUpload = resolve; }) }]);
    let releaseRead!: () => void;
    const reading = new Promise<void>((resolve) => { releaseRead = resolve; });
    const polled: string[] = [];
    server.use(http.get("/api/ai/assistant/documents/:id", async ({ params }) => {
      polled.push(String(params.id));
      await reading;
      return HttpResponse.json(status("completed", read));
    }));
    renderRouteWithProviders("/");
    await screen.findByRole("button", { name: "Adjuntar un archivo" });
    choose("comprobante.pdf", 412 * 1024);
    expect(screen.getByText("PDF · 412 KB")).toBeInTheDocument();
    const field = screen.getByRole("textbox", { name: "Tu pregunta" });
    expect(field).toHaveAttribute("placeholder", "Agregá un texto, si querés…");
    await pasteText(field, "Armame un formulario con este comprobante");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByRole("button", { name: "Enviando… 40%" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Quitar comprobante.pdf" })).toBeDisabled();
    expect(uploads[0].url).toBe("/api/ai/assistant/documents");
    expect([...uploads[0].body.keys()].sort()).toEqual(["file", "requestId"]);
    const requestId = String(uploads[0].body.get("requestId"));
    releaseUpload();
    expect(await screen.findByRole("button", { name: "Leyendo el documento…" })).toHaveAttribute("aria-busy", "true");
    // Its turn waits for this conversation: another one cannot be opened, nor a suggestion chosen, meanwhile.
    expect(within(screen.getByRole("complementary", { name: "Conversaciones" })).getByRole("button", { name: "Nueva conversación" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "¿Cuántos usuarios activos hay?" })).toBeDisabled();
    expect(writes).toHaveLength(0);
    await waitFor(() => expect(polled).toEqual([requestId]), { timeout: 3000 });
    releaseRead();
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual({ requestId: writes[0].requestId, conversationId: null, expectedRevision: null, expectedConnectionRevision: 7,
      question: "Armame un formulario con este comprobante", documentRequestId: requestId });
    expect(await screen.findByText("PDF · 2 páginas · 412 KB")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar comprobante.pdf" })).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Adjuntar un archivo" })).toBeInTheDocument();
    expect(uploads).toHaveLength(1);
  });

  it("sends a Word with its turn, like a spreadsheet, and its message says «Word · 24 KB»", async () => {
    server.use(withKinds({ documents: true }));
    let release!: () => void;
    const answer = { status: 202, body: {} as unknown, release: new Promise<void>((resolve) => { release = resolve; }) };
    const uploads = captureUploads([answer]);
    renderRouteWithProviders("/");
    await screen.findByRole("button", { name: "Adjuntar un archivo" });
    choose("acta.docx", 24 * 1024);
    expect(screen.getByText("Word · 24 KB")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(uploads).toHaveLength(1));
    expect(uploads[0].url).toBe("/api/ai/assistant/file-turns");
    const requestId = String(uploads[0].body.get("requestId"));
    expect(uploads[0].body.has("documentRequestId")).toBe(false);
    turn = { ...turn, requestId, question: "", attachment: { name: "acta.docx", kind: "docx", size: 24 * 1024 } };
    answer.body = acceptedOf(turn);
    release();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Quitar acta.docx" })).not.toBeInTheDocument());
    expect(await screen.findByText("Word · 24 KB")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it("normalizes the recording first, then reads the document, and the turn names both", async () => {
    installMicrophone();
    URL.createObjectURL = vi.fn(() => "blob:recording");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    const audioRequestId = "0199a0c0-0000-7000-8000-000000000555";
    server.use(withKinds({ ...all, audio: true }), turnsWithDocument());
    const uploads = captureUploads([
      { status: 202, body: { requestId: audioRequestId, state: "completed", transcript: "Con este comprobante", failure: null, pollingAfterSeconds: 1 } },
      { status: 202, body: status("completed", read) },
    ]);
    try {
      renderRouteWithProviders("/");
      await userEvent.click(await screen.findByRole("button", { name: "Grabar un audio" }));
      await screen.findByText(/^Grabando · 0:0\d$/);
      await userEvent.click(screen.getByRole("button", { name: "Detener" }));
      await screen.findByLabelText("Tu audio");
      choose("comprobante.pdf", 412 * 1024);
      await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
      await waitFor(() => expect(writes).toHaveLength(1));
      expect(uploads.map(upload => upload.url)).toEqual(["/api/ai/assistant/audio", "/api/ai/assistant/documents"]);
      expect(writes[0]).toMatchObject({ question: "", audioRequestId: String(uploads[0].body.get("requestId")),
        documentRequestId: String(uploads[1].body.get("requestId")) });
    } finally { removeMicrophone(); }
  });

  it("keeps the file with the server's reason when the reading fails, and the next attempt reads it under another request", async () => {
    server.use(withKinds(all), turnsWithDocument());
    const reason = "No se pudo leer el documento: el proveedor lo rechazó.";
    const uploads = captureUploads([{ status: 202, body: status("pending") }, { status: 202, body: status("completed", read) }]);
    server.use(http.get("/api/ai/assistant/documents/:id", () =>
      HttpResponse.json(status("failed", null, { code: "Ai.Assistant.ProviderRejected", detail: reason, recovery: "newAttempt" }))));
    renderRouteWithProviders("/");
    await screen.findByRole("button", { name: "Adjuntar un archivo" });
    choose("comprobante.pdf", 412 * 1024);
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText(reason, undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText("comprobante.pdf")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(uploads[1].body.get("requestId")).not.toBe(uploads[0].body.get("requestId"));
    expect(writes[0].documentRequestId).toBe(uploads[1].body.get("requestId"));
    expect(screen.queryByText(reason)).not.toBeInTheDocument();
  });

  it("keeps the file with the server's reason for a document it does not read, and sends it again only once it is changed", async () => {
    server.use(withKinds(all), turnsWithDocument());
    const reason = "Este PDF tiene contraseña. Mandá uno sin contraseña.";
    const uploads = captureUploads([{ status: 400, body: { code: "Ai.Assistant.AttachmentProtectedPdf", detail: reason, errors: { file: [reason] } } },
      { status: 202, body: status("completed", read) }]);
    renderRouteWithProviders("/");
    await screen.findByRole("button", { name: "Adjuntar un archivo" });
    choose("comprobante.pdf");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText(reason)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Tu pregunta" })).toHaveAttribute("aria-invalid", "true");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(uploads).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Quitar comprobante.pdf" }));
    expect(screen.queryByText(reason)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adjuntar un archivo" })).toHaveFocus();
    // Another file goes up under another request and its turn names that reading.
    choose("comprobante-sin-clave.pdf", 412 * 1024);
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(uploads).toHaveLength(2);
    expect(uploads[1].body.get("requestId")).not.toBe(uploads[0].body.get("requestId"));
    expect((uploads[1].body.get("file") as File).name).toBe("comprobante-sin-clave.pdf");
    expect(writes[0].documentRequestId).toBe(uploads[1].body.get("requestId"));
  });

  it("re-reads the bootstrap when the installation no longer reads photos or PDF files, with the server's reason under the composer", async () => {
    server.use(withKinds(all));
    const reason = "No se pueden leer fotos ni PDF en esta instalación.";
    const uploads = captureUploads([{ status: 400, body: { code: "Ai.Assistant.AttachmentDocumentUnavailable", detail: reason, errors: { file: [reason] } } }]);
    renderRouteWithProviders("/");
    await screen.findByRole("button", { name: "Adjuntar un archivo" });
    const before = bootstrapReads;
    choose("comprobante.pdf");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText(reason)).toBeInTheDocument();
    await waitFor(() => expect(bootstrapReads).toBeGreaterThan(before));
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(uploads).toHaveLength(1);
  });

  // The acceptance of a document's turn could not be confirmed: when «Consultar estado» or «Repetir el mismo pedido» confirms it, the
  // turn took the file and the recording, so they leave the composer, the next send does not repeat them and the guard lets go.
  it("clears the composer when «Consultar estado» confirms the turn of a document, and the leave guard lets go", async () => {
    server.use(withKinds(all));
    const uploads = captureUploads([{ status: 202, body: status("completed", read) }]);
    server.use(http.post("/api/ai/assistant/turns", async ({ request }) => {
      const body = (await request.json()) as AssistantSubmit;
      writes.push(body);
      turn = { ...turn, requestId: body.requestId, question: body.question, attachment: { name: read.name, kind: "pdf", pages: 2, size: read.size } };
      return HttpResponse.error();
    }));
    const { router } = renderRouteWithProviders("/");
    await screen.findByRole("button", { name: "Adjuntar un archivo" });
    choose("comprobante.pdf", 412 * 1024);
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    const operation = await screen.findByText("Aceptación por confirmar");
    await userEvent.click(within(operation.parentElement!).getByRole("button", { name: "Consultar estado" }));
    await waitFor(() => expect(router.state.location.search).toContain(conversationId));
    expect(await screen.findByText("PDF · 2 páginas · 412 KB")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar comprobante.pdf" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Tu pregunta" })).toHaveAttribute("placeholder", "Preguntale al sistema…");
    await act(async () => {
      await router.navigate("/");
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(router.state.location.search).not.toContain("conversacion=");
    expect(writes).toHaveLength(1);
    expect(uploads).toHaveLength(1);
  });

  it("clears the recording and the file when «Repetir el mismo pedido» confirms a dictated turn with a document", async () => {
    installMicrophone();
    URL.createObjectURL = vi.fn(() => "blob:recording");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    server.use(withKinds({ ...all, audio: true }));
    captureUploads([
      { status: 202, body: { requestId: "0199a0c0-0000-7000-8000-000000000555", state: "completed", transcript: "Con este comprobante",
        failure: null, pollingAfterSeconds: 1 } },
      { status: 202, body: status("completed", read) },
    ]);
    server.use(http.post("/api/ai/assistant/turns", async ({ request }) => {
      const body = (await request.json()) as AssistantSubmit;
      writes.push(body);
      turn = { ...turn, requestId: body.requestId, question: body.question, attachment: { name: read.name, kind: "pdf", pages: 2, size: read.size } };
      return writes.length === 1 ? HttpResponse.error() : HttpResponse.json(acceptedOf(turn), { status: 202 });
    }));
    try {
      renderRouteWithProviders("/");
      await userEvent.click(await screen.findByRole("button", { name: "Grabar un audio" }));
      await screen.findByText(/^Grabando · 0:0\d$/);
      await userEvent.click(screen.getByRole("button", { name: "Detener" }));
      await screen.findByLabelText("Tu audio");
      choose("comprobante.pdf", 412 * 1024);
      await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
      const operation = await screen.findByText("Aceptación por confirmar");
      await userEvent.click(within(operation.parentElement!).getByRole("button", { name: "Repetir el mismo pedido" }));
      await waitFor(() => expect(writes).toHaveLength(2));
      expect(writes[1]).toEqual(writes[0]);
      await waitFor(() => expect(screen.queryByLabelText("Tu audio")).not.toBeInTheDocument());
      expect(screen.queryByRole("button", { name: "Quitar comprobante.pdf" })).not.toBeInTheDocument();
    } finally { removeMicrophone(); }
  });

  // The readings' own quota renews at 00:00 UTC too: the wait after its 429 on the upload says that hour, in the profile's zone.
  it("starts the common wait after the reading quota's 429 on the upload: Enviar off with the hour it renews and nothing goes up again", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-11-15T23:59:20Z"));
      server.use(withKinds(all));
      const error = vi.spyOn(toast, "error");
      const uploads = captureUploads([{ status: 429, body: { title: "Demasiados pedidos", status: 429, code: "Ai.Assistant.QuotaExceeded",
        detail: "Esperá para continuar.", retryAfter: 40 } }]);
      renderRouteWithProviders("/");
      await screen.findByRole("button", { name: "Adjuntar un archivo" });
      choose("comprobante.pdf");
      await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
      expect(await screen.findByText("Podés enviar otra consulta a las 21:00, cuando se renueva la cuota del día.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
      expect(error).toHaveBeenCalledTimes(1);
      expect(screen.getByText("comprobante.pdf")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
      expect(uploads).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("says the server's reason for a conflict on the upload, and the next attempt goes up under another request", async () => {
    server.use(withKinds(all), turnsWithDocument());
    const error = vi.spyOn(toast, "error");
    const uploads = captureUploads([{ status: 409, body: { title: "Conflicto", status: 409, code: "Ai.Assistant.RequestReused",
      detail: "Ese pedido ya se usó con otro archivo." } }, { status: 202, body: status("completed", read) }]);
    renderRouteWithProviders("/");
    await screen.findByRole("button", { name: "Adjuntar un archivo" });
    choose("comprobante.pdf");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(error).toHaveBeenCalledWith("Ese pedido ya se usó con otro archivo.", expect.anything()));
    expect(writes).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(uploads[1].body.get("requestId")).not.toBe(uploads[0].body.get("requestId"));
  });

  it("closes Home when the upload says this person can no longer use the assistant", async () => {
    server.use(withKinds(all));
    captureUploads([{ status: 403, body: { title: "Prohibido", status: 403, code: "Ai.Assistant.Forbidden", detail: "Sin acceso." } }]);
    renderRouteWithProviders("/");
    await screen.findByRole("button", { name: "Adjuntar un archivo" });
    choose("comprobante.pdf");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByRole("heading", { name: "No tenés permiso" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Tu pregunta" })).not.toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it("keeps the request when the reading cannot be asked for: the next send asks again without uploading the file", async () => {
    server.use(withKinds(all), turnsWithDocument());
    const warning = vi.spyOn(toast, "warning");
    const uploads = captureUploads([{ status: 202, body: status("pending") }]);
    const polled: string[] = [];
    server.use(http.get("/api/ai/assistant/documents/:id", ({ params }) => {
      polled.push(String(params.id));
      return polled.length === 1 ? HttpResponse.error() : HttpResponse.json(status("completed", read));
    }));
    renderRouteWithProviders("/");
    await screen.findByRole("button", { name: "Adjuntar un archivo" });
    choose("comprobante.pdf", 412 * 1024);
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(warning).toHaveBeenCalledWith("No pudimos consultar la lectura del documento. Tocá Enviar para volver a consultarla.",
      expect.anything()), { timeout: 3000 });
    expect(screen.getByText("comprobante.pdf")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Enviar" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    const requestId = String(uploads[0].body.get("requestId"));
    expect(uploads).toHaveLength(1);
    expect(polled).toEqual([requestId, requestId]);
    expect(writes[0].documentRequestId).toBe(requestId);
  });

  it("uploads the file again under the same request when the server no longer knows its reading", async () => {
    server.use(withKinds(all), turnsWithDocument());
    const uploads = captureUploads([{ status: 202, body: status("pending") }, { status: 202, body: status("completed", read) }]);
    server.use(http.get("/api/ai/assistant/documents/:id", () =>
      HttpResponse.json({ title: "No encontrado", status: 404, code: "Ai.Assistant.NotFound", detail: "No se encontró." }, { status: 404 })));
    renderRouteWithProviders("/");
    await screen.findByRole("button", { name: "Adjuntar un archivo" });
    choose("comprobante.pdf", 412 * 1024);
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("comprobante.pdf")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Enviar" })).toBeEnabled(), { timeout: 3000 });
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(uploads).toHaveLength(2);
    expect(uploads[1].body.get("requestId")).toBe(uploads[0].body.get("requestId"));
  });

  it("starts the common wait after a 429 while the reading is asked for, and keeps the request for later", async () => {
    server.use(withKinds(all));
    const uploads = captureUploads([{ status: 202, body: status("pending") }]);
    server.use(http.get("/api/ai/assistant/documents/:id", () => HttpResponse.json({ title: "Demasiados pedidos", status: 429,
      code: "Http.TooManyRequests", detail: "Esperá para continuar.", retryAfter: 30 }, { status: 429 })));
    renderRouteWithProviders("/");
    await screen.findByRole("button", { name: "Adjuntar un archivo" });
    choose("comprobante.pdf");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("Esperá 30 s para enviar otra consulta.", undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    expect(screen.getByText("comprobante.pdf")).toBeInTheDocument();
    expect(uploads).toHaveLength(1);
  });

  it("says a completed reading without its document could not be read, and the next attempt goes up under another request", async () => {
    server.use(withKinds(all), turnsWithDocument());
    const uploads = captureUploads([{ status: 202, body: status("completed") }, { status: 202, body: status("completed", read) }]);
    renderRouteWithProviders("/");
    await screen.findByRole("button", { name: "Adjuntar un archivo" });
    choose("comprobante.pdf");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("No se pudo leer el documento. Probá mandarlo de nuevo.")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(uploads[1].body.get("requestId")).not.toBe(uploads[0].body.get("requestId"));
  });

  it("sends nothing and says nothing when the page closes during the reading", async () => {
    server.use(withKinds(all));
    const error = vi.spyOn(toast, "error");
    const warning = vi.spyOn(toast, "warning");
    captureUploads([{ status: 202, body: status("pending") }]);
    let polls = 0;
    server.use(http.get("/api/ai/assistant/documents/:id", () => { polls++; return HttpResponse.json(status("running")); }));
    const { unmount } = renderRouteWithProviders("/");
    await screen.findByRole("button", { name: "Adjuntar un archivo" });
    choose("comprobante.pdf");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await screen.findByRole("button", { name: "Leyendo el documento…" });
    unmount();
    const before = polls;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(polls).toBe(before);
    expect(writes).toHaveLength(0);
    expect(error).not.toHaveBeenCalled();
    expect(warning).not.toHaveBeenCalled();
  });

  // Leaving the conversation confirms discarding the draft: its file and its recording go, the reading stops and nothing reaches the
  // conversation that was left.
  it("discards the file and the recording and stops the reading when the person leaves during it", async () => {
    installMicrophone();
    URL.createObjectURL = vi.fn(() => "blob:recording");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    server.use(withKinds({ ...all, audio: true }), turnsWithDocument());
    captureUploads([
      { status: 202, body: { requestId: "0199a0c0-0000-7000-8000-000000000555", state: "completed", transcript: "Con este comprobante",
        failure: null, pollingAfterSeconds: 1 } },
      { status: 202, body: status("pending") },
    ]);
    let releaseRead!: () => void;
    const reading = new Promise<void>((resolve) => { releaseRead = resolve; });
    server.use(http.get("/api/ai/assistant/documents/:id", async () => { await reading; return HttpResponse.json(status("completed", read)); }));
    try {
      const { router } = renderRouteWithProviders("/");
      await screen.findByRole("button", { name: "Adjuntar un archivo" });
      await act(async () => {
        await router.navigate(`/?conversacion=${conversationId}`);
      });
      await screen.findByText("Hay tres usuarios activos.");
      await userEvent.click(screen.getByRole("button", { name: "Grabar un audio" }));
      await screen.findByText(/^Grabando · 0:0\d$/);
      await userEvent.click(screen.getByRole("button", { name: "Detener" }));
      await screen.findByLabelText("Tu audio");
      choose("comprobante.pdf", 412 * 1024);
      await pasteText(screen.getByRole("textbox", { name: "Tu pregunta" }), "Armame un formulario");
      await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
      await screen.findByRole("button", { name: "Leyendo el documento…" }, { timeout: 3000 });
      await act(async () => {
        await router.navigate(-1);
      });
      const dialog = await screen.findByRole("dialog");
      await userEvent.click(within(dialog).getByRole("button", { name: "Nueva conversación" }));
      await waitFor(() => expect(router.state.location.search).not.toContain("conversacion="));
      expect(screen.queryByRole("button", { name: "Quitar comprobante.pdf" })).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Tu audio")).not.toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Tu pregunta" })).toHaveValue("");
      releaseRead();
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(writes).toHaveLength(0);
      expect(screen.getByRole("button", { name: "Adjuntar un archivo" })).toBeEnabled();
    } finally { removeMicrophone(); }
  });

  it("repeats an upload whose outcome is unknown under the same request, and does not upload again a document already read", async () => {
    server.use(withKinds(all));
    const uploads = captureUploads([{ status: 503, body: { title: "Error", status: 503, detail: "No disponible." } },
      { status: 202, body: status("completed", read) }]);
    let rejected = false;
    server.use(http.post("/api/ai/assistant/turns", async ({ request }) => {
      const body = (await request.json()) as AssistantSubmit;
      writes.push(body);
      if (!rejected) {
        rejected = true;
        return HttpResponse.json({ title: "Conflicto", status: 409, code: "Ai.Assistant.ActiveTurn", detail: "Hay otra consulta en curso." }, { status: 409 });
      }
      turn = { ...turn, requestId: body.requestId, question: body.question, attachment: { name: read.name, kind: "pdf", pages: 2, size: read.size } };
      return HttpResponse.json(acceptedOf(turn), { status: 202 });
    }));
    renderRouteWithProviders("/");
    await screen.findByRole("button", { name: "Adjuntar un archivo" });
    choose("comprobante.pdf", 412 * 1024);
    const send = async () => {
      await waitFor(() => expect(screen.getByRole("button", { name: "Enviar" })).toBeEnabled());
      await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    };
    await send();
    await waitFor(() => expect(uploads).toHaveLength(1));
    await send();
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(uploads[1].body.get("requestId")).toBe(uploads[0].body.get("requestId"));
    await send();
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(uploads).toHaveLength(2);
    expect(writes[1].documentRequestId).toBe(uploads[0].body.get("requestId"));
    expect(writes[1].requestId).not.toBe(writes[0].requestId);
    expect(await screen.findByText("PDF · 2 páginas · 412 KB")).toBeInTheDocument();
  });

  it("says under the composer that this person can no longer attach documents, keeps Home and reads the bootstrap again", async () => {
    server.use(withKinds(all));
    const remedy = "Para adjuntar fotos, PDF o Word, pedile a quien administra la instalación el permiso de diseñar formularios.";
    const uploads = captureUploads([{ status: 403, body: { title: "Prohibido", status: 403, code: "Ai.Assistant.AttachmentDocumentForbidden", detail: remedy } }]);
    renderRouteWithProviders("/");
    await screen.findByRole("button", { name: "Adjuntar un archivo" });
    const before = bootstrapReads;
    choose("comprobante.pdf");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText(remedy)).toBeInTheDocument();
    expect(screen.getByText("comprobante.pdf")).toBeInTheDocument();
    await waitFor(() => expect(bootstrapReads).toBeGreaterThan(before));
    expect(screen.getByRole("textbox", { name: "Tu pregunta" })).toBeInTheDocument();
    // The same file is not sent again: it is removed or changed.
    await waitFor(() => expect(screen.getByRole("button", { name: "Enviar" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(uploads).toHaveLength(1);
    expect(screen.getByText(remedy)).toBeInTheDocument();
  });

  it.each([
    ["an old Word, when PDF files are not read", { documents: true }, "acta.doc", 1024, "No se puede leer un Word viejo (.doc). Guardalo como .docx."],
    ["an old Word", all, "acta.doc", 1024, "No se puede leer un Word viejo (.doc). Guardalo como .docx o en PDF."],
    ["a Word with macros, when PDF files are not read", { documents: true }, "acta.docm", 1024, "No se puede leer un Word con macros (.docm). Guardalo como .docx."],
    ["a Word with macros", all, "acta.docm", 1024, "No se puede leer un Word con macros (.docm). Guardalo como .docx o en PDF."],
    ["a Word with macros, to whoever may attach only spreadsheets", { attachments: true }, "acta.docm", 1024,
      "Sólo se puede adjuntar un Excel (.xlsx) o un CSV."],
    ["another type", all, "notas.txt", 1024, "Sólo se puede adjuntar un PDF, una foto JPEG o PNG, un Word (.docx), un Excel (.xlsx) o un CSV."],
    ["a PDF, when PDF files are not read", { documents: true }, "comprobante.pdf", 1024, "Sólo se puede adjuntar un Word (.docx)."],
    ["a document of more than 10 MB", all, "comprobante.pdf", 11 * 1024 * 1024, "El archivo pesa 11 MB y el tope es de 10 MB. Achicalo y volvé a adjuntarlo."],
    ["a document a byte over 10 MB, rounding its weight up", all, "comprobante.pdf", 10 * 1024 * 1024 + 1,
      "El archivo pesa 10,1 MB y el tope es de 10 MB. Achicalo y volvé a adjuntarlo."],
  ])("stops %s in the browser, says why under the composer and sends nothing", async (_, kinds, name, size, reason) => {
    server.use(withKinds(kinds));
    const uploads = captureUploads([{ status: 202, body: {} }]);
    renderRouteWithProviders("/");
    await screen.findByRole("button", { name: /^Adjuntar un/ });
    choose(name, size);
    expect(screen.getByText(reason)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(uploads).toHaveLength(0);
    expect(writes).toHaveLength(0);
  });

  it("asks before browser Back leaves a chosen document unsent, like a draft", async () => {
    server.use(withKinds(all));
    const { router } = renderRouteWithProviders("/");
    await screen.findByRole("button", { name: "Adjuntar un archivo" });
    await act(async () => {
      await router.navigate(`/?conversacion=${conversationId}`);
    });
    await screen.findByText("Hay tres usuarios activos.");
    choose("foto.jpg", 1258291);
    expect(screen.getByText("Foto · 1,2 MB")).toBeInTheDocument();
    await act(async () => {
      await router.navigate(-1);
    });
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Seguir editando" }));
    expect(screen.getByText("foto.jpg")).toBeInTheDocument();
    expect(router.state.location.search).toContain(conversationId);
  });
});

// A module's extension, without importing it: a suggestion that attaches and a card that says whether it was replaced.
describe("what a module adds to Home (Stage 2)", () => {
  function Card({ proposal, replaced }: AssistantProposalCardProps) {
    return <p>{proposal.capability + (replaced ? " · Reemplazada" : "")}</p>;
  }
  function renderPage(extension: AssistantProposalExtension, path = "/") {
    const router = createMemoryRouter([{ path: "/", element: <AssistantProposalContext value={extension}><AiAssistantPage /></AssistantProposalContext> }],
      { initialEntries: [path] });
    render(<AppProviders><RouterProvider router={router} /></AppProviders>);
  }
  const extension = (overrides: Partial<AssistantProposalExtension> = {}): AssistantProposalExtension => ({
    accepts: () => true,
    Card,
    suggestions: () => [{ id: "fixture.attach", question: "Armame un catálogo con una planilla", draft: "Armame un catálogo con esta planilla", attach: true }],
    ...overrides,
  });
  const bootstrapWith = (attachments: boolean) => server.use(http.get("/api/ai/assistant/bootstrap", () => HttpResponse.json({ availability: "available",
    connectionRevision: 7, suggestions: [], limits: { questionMaxLength: 4000 }, configurationDestination: null, audio: false, attachments })));

  it("offers a suggestion that attaches only to whoever may attach; choosing it writes its request and opens the file picker", async () => {
    bootstrapWith(true);
    const open = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    renderPage(extension());
    await userEvent.click(await screen.findByRole("button", { name: "Armame un catálogo con una planilla" }));
    expect(screen.getByRole("textbox", { name: "Tu pregunta" })).toHaveValue("Armame un catálogo con esta planilla");
    expect(open).toHaveBeenCalledOnce();
    expect(open.mock.contexts[0]).toBe(document.querySelector("input[type=file]"));
    expect(writes).toHaveLength(0);
  });

  it("leaves out a suggestion that attaches for whoever may not attach", async () => {
    bootstrapWith(false);
    renderPage(extension());
    await screen.findByRole("textbox", { name: "Tu pregunta" });
    expect(screen.queryByRole("button", { name: "Armame un catálogo con una planilla" })).not.toBeInTheDocument();
  });

  it("marks as replaced a proposal followed by another of its group, or of its capability when the module gives no group", async () => {
    const proposalTurn = (ordinal: number, capability: string): AssistantTurn => ({ ...turn, turnId: `0199a0c0-0000-7000-8009-00000000000${ordinal}`,
      requestId: `0199a0c0-0000-7000-800a-00000000000${ordinal}`, ordinal, answer: { kind: "proposal", text: "Propuesta " + ordinal, evidenceIds: [] },
      evidences: [], proposal: { id: `0199a0c0-0000-7000-800b-00000000000${ordinal}`, capability, version: 1, content: {} } });
    const turns = [proposalTurn(2, "fixture.propose-import"), proposalTurn(1, "fixture.propose-catalog")];
    server.use(http.get("/api/ai/assistant/conversations/:id/turns", () => HttpResponse.json(pageOf(turns))));
    bootstrapWith(false);
    renderPage(extension({ replacementGroup: () => "fixture.catalogs" }), "/?conversacion=" + conversationId);
    expect(await screen.findByText("fixture.propose-catalog · Reemplazada")).toBeInTheDocument();
    expect(screen.getByText("fixture.propose-import")).toBeInTheDocument();
  });

  it("without a group, a proposal of another capability does not replace it", async () => {
    const proposalTurn = (ordinal: number, capability: string): AssistantTurn => ({ ...turn, turnId: `0199a0c0-0000-7000-8009-00000000000${ordinal}`,
      requestId: `0199a0c0-0000-7000-800a-00000000000${ordinal}`, ordinal, answer: { kind: "proposal", text: "Propuesta " + ordinal, evidenceIds: [] },
      evidences: [], proposal: { id: `0199a0c0-0000-7000-800b-00000000000${ordinal}`, capability, version: 1, content: {} } });
    server.use(http.get("/api/ai/assistant/conversations/:id/turns", () =>
      HttpResponse.json(pageOf([proposalTurn(2, "fixture.propose-import"), proposalTurn(1, "fixture.propose-catalog")]))));
    bootstrapWith(false);
    renderPage(extension(), "/?conversacion=" + conversationId);
    expect(await screen.findByText("fixture.propose-catalog")).toBeInTheDocument();
    expect(screen.queryByText(/Reemplazada/)).not.toBeInTheDocument();
  });
});
