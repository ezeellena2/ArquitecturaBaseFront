import "./AiAssistantPage";
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
import type { AssistantTurn, AssistantSubmit } from "../api/assistant";
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
beforeEach(() => {
  queryClient.clear();
  writes = [];
  access = "allowed";
  turn = {
    turnId: "turn1",
    requestId: "request1",
    conversationId,
    ordinal: 1,
    conversationRevision: 2,
    turnRevision: 2,
    state: "Completed",
    stage: "verifying",
    contentAccess: "allowed",
    question: "Consulta anterior",
    answer: {
      kind: "answer",
      text: "Hay tres usuarios activos.",
      evidenceIds: ["e1"],
    },
    evidences: [
      {
        id: "e1",
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
    culture: "es",
    timeZoneId: "UTC",
    submittedAtUtc: "2026-10-04T12:00:00Z",
    serverNowUtc: "2026-10-04T12:00:00Z",
    pollingAfterSeconds: 2,
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
        activeRequestId: turn.state === "Running" ? turn.requestId : null,
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
      return HttpResponse.json(turn, { status: 202 });
    }),
    http.post("/api/ai/assistant/turns/:id/cancel", () => {
      turn = { ...turn, state: "Canceled", turnRevision: 3 };
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
    turn = { ...turn, state: "Running", answer: null, evidences: [] };
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
      state: "Failed",
      failure: {
        code: "Ai.Assistant.ProviderRejected",
        detail: "El proveedor rechazó la consulta.",
        recovery: "newRequest",
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
    turn = { ...turn, state: "Running", answer: null, evidences: [] };
    server.use(
      http.post("/api/ai/assistant/turns/:id/cancel", () => {
        turn = {
          ...turn,
          state: "Canceled",
          failure: {
            code: "Ai.Assistant.Canceled",
            detail: "Cancelación confirmada.",
            recovery: "newRequest",
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
    turn = { ...turn, state: "Running", answer: null, evidences: [] };
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
    expect(turn.state).toBe("Running");
    expect(writes).toHaveLength(0);
  });
  it("publishes the confirmed completion when cancellation loses its race", async () => {
    const answer = turn.answer;
    turn = { ...turn, state: "Running", answer: null };
    server.use(
      http.post("/api/ai/assistant/turns/:id/cancel", () => {
        turn = { ...turn, state: "Completed", answer };
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
            code: "Ai.Assistant.QuotaExceeded",
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
});

