import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { server } from "@/test/mocks/server";
import { currentUser } from "@/test/mocks/handlers";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import {
  responseDetailFixture,
  responseFormId,
  responseRecordId,
  responseSheetFixture,
} from "@/test/responseFixtures";
import { notify } from "@/shared/ui/notifications";
vi.mock("react-oidc-context", async () => ({
  ...(await vi.importActual<typeof import("react-oidc-context")>(
    "react-oidc-context",
  )),
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { access_token: "test" },
  }),
}));
vi.mock("@/shared/ui/notifications", async () => ({
  ...(await vi.importActual<typeof import("@/shared/ui/notifications")>(
    "@/shared/ui/notifications",
  )),
  notify: vi.fn(),
}));
function setup(
  permissions = ["formrecords.read", "formrecords.export", "whatsapp.read"],
) {
  server.use(
    http.get("/api/me", () =>
      HttpResponse.json({ ...currentUser, permissions }),
    ),
    http.get("/api/forms/navigation", () =>
      HttpResponse.json({
        items: [
          {
            id: responseFormId,
            name: "Formulario publicado",
            prefix: "TEST",
            versionNumber: 2,
          },
        ],
        page: 1,
        pageSize: 4,
        totalCount: 1,
        totalPages: 1,
        hasPrevious: false,
        hasNext: false,
      }),
    ),
    http.post("/api/forms/definitions/:id/records/search", () =>
      HttpResponse.json(responseSheetFixture()),
    ),
    http.get("/api/forms/records/:id", ({ params }) =>
      HttpResponse.json(responseDetailFixture(String(params.id))),
    ),
    http.post(
      "/api/forms/definitions/:id/records/filter-counts/search",
      async ({ request }) => {
        const body = (await request.json()) as {
          dimension: string;
          fieldId?: string;
        };
        const sheet = responseSheetFixture();
        const field = sheet.columns.find(
          (column) => column.fieldId === body.fieldId,
        );
        const items =
          body.dimension === "version"
            ? sheet.versions.map((version) => ({
                id: version.id,
                label: String(version.number),
                count: 1,
              }))
            : body.dimension === "actor"
              ? [
                  {
                    id: sheet.records.items[0].actor.userId,
                    label: "Ana",
                    count: 2,
                  },
                ]
              : body.dimension === "presence"
                ? ["answered", "unanswered", "notAsked"].map((id, index) => ({
                    id,
                    label: id,
                    count:
                      field?.type === "shortText"
                        ? index === 0
                          ? 0
                          : 1
                        : index === 0
                          ? 2
                          : 0,
                  }))
                : field?.type === "choice"
                  ? field.options.map((option) => ({
                      id: option.id,
                      label: option.label,
                      count: 2,
                    }))
                  : [
                      { id: "true", label: "true", count: 0 },
                      { id: "false", label: "false", count: 2 },
                    ];
        return HttpResponse.json({
          items,
          page: 1,
          pageSize: 20,
          totalCount: items.length,
          totalPages: 1,
          hasPrevious: false,
          hasNext: false,
        });
      },
    ),
  );
}
beforeEach(() => {
  queryClient.clear();
  vi.clearAllMocks();
});
describe("response sheet", () => {
  it("shows zero, false, unanswered and a missing question without requiring template permission", async () => {
    setup();
    renderRouteWithProviders(`/formularios/${responseFormId}/respuestas`);
    expect(
      await screen.findByRole("link", { name: "TEST-000002" }),
    ).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getAllByText("0")).toHaveLength(2);
    expect(within(table).getAllByText("No")).toHaveLength(2);
    expect(within(table).getByText("Sin respuesta")).toBeInTheDocument();
    expect(within(table).getByText("—")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Diseñar formularios" }),
    ).not.toBeInTheDocument();
  });
  it("sends private search in POST and retains rows when that search fails", async () => {
    setup();
    let captured: unknown;
    server.use(
      http.post(
        "/api/forms/definitions/:id/records/search",
        async ({ request }) => {
          const body = (await request.json()) as { search?: string };
          captured = body;
          return body.search
            ? HttpResponse.json(
                { detail: "Temporary failure", code: "Test.Failure" },
                { status: 500 },
              )
            : HttpResponse.json(responseSheetFixture());
        },
      ),
    );
    const { router } = renderRouteWithProviders(
      `/formularios/${responseFormId}/respuestas`,
    );
    await screen.findByRole("link", { name: "TEST-000002" });
    await userEvent.type(
      screen.getByRole("searchbox", { name: "Buscar en textos largos" }),
      "private notes",
    );
    await waitFor(() =>
      expect(captured).toMatchObject({ search: "private notes" }),
    );
    expect(router.state.location.search).not.toContain("private");
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "error",
          action: expect.objectContaining({
            label: "Reintentar",
            onClick: expect.any(Function),
          }),
        }),
      ),
    );

    expect(
      await screen.findByRole("link", { name: "TEST-000002" }),
    ).toBeInTheDocument();
  });
  it("stores only selected question IDs in the URL and keeps fixed columns", async () => {
    setup();
    const { router } = renderRouteWithProviders(
      `/formularios/${responseFormId}/respuestas`,
    );
    await screen.findByRole("table");
    const trigger = screen.getByRole("button", { name: "Columnas" });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.click(
      await screen.findByRole("menuitemcheckbox", { name: "Observaciones" }),
    );
    await userEvent.keyboard("{Escape}");
    expect(
      within(screen.getByRole("table")).queryByRole("columnheader", {
        name: /Observaciones/,
      }),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("table")).getByRole("columnheader", {
        name: /N°/,
      }),
    ).toBeInTheDocument();
    expect(router.state.location.search).toContain("columns=");
    expect(router.state.location.search).not.toContain("Observaciones");
  });
  it("opens the historical detail and moves within the same sheet", async () => {
    setup();
    renderRouteWithProviders(`/formularios/${responseFormId}/respuestas`);
    await userEvent.click(
      await screen.findByRole("link", { name: "TEST-000002" }),
    );
    await screen.findByRole("heading", { name: "TEST-000002" });
    expect(screen.getByText("Texto completo para revisar")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Abrir conversación" }),
    ).toHaveAttribute("href", expect.stringContaining("conversacion="));
    await userEvent.click(
      await screen.findByRole("button", { name: "Siguiente" }),
    );
    await screen.findByRole("heading", { name: "TEST-000001" });
  });
  it("counts only a settled valid decimal draft and applies that normalized value", async () => {
    setup();
    const captured: { filter: { conditions?: { values: string[] }[] } }[] = [];
    server.use(http.post("/api/forms/definitions/:id/records/filter-counts/search", async ({ request }) => {
      captured.push(await request.json() as typeof captured[number]);
      return HttpResponse.json({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false });
    }));
    let applied: unknown;
    server.use(http.post("/api/forms/definitions/:id/records/search", async ({ request }) => {
      applied = await request.json();
      return HttpResponse.json(responseSheetFixture());
    }));
    renderRouteWithProviders(`/formularios/${responseFormId}/respuestas`);
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("button", { name: "Más filtros" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Importe" }));
    await waitFor(() => expect(captured).toHaveLength(1));
    const input = within(dialog).getByRole("textbox", { name: "Desde" });
    await userEvent.type(input, "-");
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
    expect(captured).toHaveLength(1);
    expect(within(dialog).getByRole("button", { name: "Aplicar filtros" })).toBeDisabled();
    await userEvent.clear(input);
    await userEvent.type(input, "12,");
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
    expect(captured).toHaveLength(1);
    await userEvent.type(input, "5");
    expect(captured).toHaveLength(1);
    await waitFor(() => expect(captured.at(-1)?.filter.conditions).toEqual([
      expect.objectContaining({ operator: "gte", values: ["12.5"] }),
    ]));
    await userEvent.click(within(dialog).getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(applied).toMatchObject({ conditions: [expect.objectContaining({ operator: "gte", values: ["12.5"] })] }));
    expect(notify).not.toHaveBeenCalled();
  });
  it.each([400, 429])("does not offer an immediate retry after a facet HTTP %s", async status => {
    setup();
    const requested = vi.fn();
    server.use(http.post("/api/forms/definitions/:id/records/filter-counts/search", () => {
      requested();
      return HttpResponse.json({ detail: "Review the filter", code: "Test.Filter", retryAfter: 60 }, { status });
    }));
    renderRouteWithProviders(`/formularios/${responseFormId}/respuestas`);
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("button", { name: "Más filtros" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cargó" }));
    await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
    expect(vi.mocked(notify).mock.calls[0][0].action).toBeUndefined();
    if (status === 429) {
      expect(within(dialog).getByRole("button", { name: "Reintentar" })).toBeDisabled();
      expect(within(dialog).getByRole("status")).toHaveTextContent("60");
    } else expect(within(dialog).queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    expect(requested).toHaveBeenCalledTimes(1);
  });
  it("names an account without a display name in the person filter", async () => {
    setup();
    const sheet = responseSheetFixture();
    server.use(
      http.post("/api/forms/definitions/:id/records/filter-counts/search", () =>
        HttpResponse.json({
          items: [
            { id: sheet.records.items[0].actor.userId, label: "", count: 2 },
          ],
          page: 1,
          pageSize: 20,
          totalCount: 1,
          totalPages: 1,
          hasPrevious: false,
          hasNext: false,
        }),
      ),
    );
    renderRouteWithProviders(`/formularios/${responseFormId}/respuestas`);
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("button", { name: "Más filtros" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cargó" }),
    );
    expect(
      await within(dialog).findByRole("checkbox", {
        name: "Persona sin información",
      }),
    ).toBeInTheDocument();
  });
  it("offers yes and no directly without a text search for a boolean question", async () => {
    setup();
    renderRouteWithProviders(`/formularios/${responseFormId}/respuestas`);
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("button", { name: "Más filtros" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Confirmado" }),
    );
    expect(
      await within(dialog).findByRole("checkbox", { name: "No" }),
    ).toBeEnabled();
    expect(
      within(dialog).queryByRole("searchbox", { name: "Buscar opciones" }),
    ).not.toBeInTheDocument();
  });
  it("withdraws all values and counts after a denied filter count", async () => {
    setup();
    server.use(
      http.post("/api/forms/definitions/:id/records/filter-counts/search", () =>
        HttpResponse.json({ code: "Forms.Record.Forbidden" }, { status: 403 }),
      ),
    );
    renderRouteWithProviders(`/formularios/${responseFormId}/respuestas`);
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("button", { name: "Más filtros" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cargó" }),
    );
    await screen.findByRole("heading", { name: /permiso/i });
    expect(screen.queryByText("TEST-000002")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
  it("hides export without its permission and exports the visible IDs with filters when allowed", async () => {
    setup(["formrecords.read"]);
    const rendered = renderRouteWithProviders(
      `/formularios/${responseFormId}/respuestas`,
    );
    await screen.findByRole("table");
    expect(
      screen.queryByRole("button", { name: "Exportar a Excel" }),
    ).not.toBeInTheDocument();
    rendered.unmount();
    queryClient.clear();
    setup();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:export"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    let sent: unknown;
    server.use(
      http.post(
        "/api/forms/definitions/:id/records/export",
        async ({ request }) => {
          sent = await request.json();
          return new HttpResponse(new Uint8Array([80, 75]), {
            headers: {
              "content-type":
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              "content-disposition": "attachment; filename*=UTF-8''TEST.xlsx",
            },
          });
        },
      ),
    );
    renderRouteWithProviders(
      `/formularios/${responseFormId}/respuestas?columns=none`,
    );
    await screen.findByRole("table");
    await userEvent.click(
      screen.getByRole("button", { name: "Exportar a Excel" }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("radio", { name: /Solo las visibles/ }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Exportar a Excel" }),
    );
    await waitFor(() =>
      expect(sent).toMatchObject({
        columns: [],
        filter: { page: 1, pageSize: 20 },
      }),
    );
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "success" }),
      ),
    );
  });
  it("closes a denied export and preserves the readable sheet", async () => {
    setup();
    server.use(http.post("/api/forms/definitions/:id/records/export", () => HttpResponse.json({ code: "Forms.Record.Forbidden" }, { status: 403 })));
    renderRouteWithProviders(`/formularios/${responseFormId}/respuestas`);
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("button", { name: "Exportar a Excel" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Exportar a Excel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "TEST-000002" })).toBeInTheDocument();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ message: "Ya no tenés permiso para exportar respuestas." }));
  });
  it("does not request responses without read permission", async () => {
    setup([]);
    const requested = vi.fn();
    server.use(
      http.post("/api/forms/definitions/:id/records/search", () => {
        requested();
        return HttpResponse.json(responseSheetFixture());
      }),
    );
    renderRouteWithProviders(`/formularios/${responseFormId}/respuestas`);
    await screen.findByRole("heading", { name: /permiso/i });
    expect(requested).not.toHaveBeenCalled();
  });
  it("treats a missing response as unavailable without an operational notification", async () => {
    setup();
    server.use(
      http.get("/api/forms/records/:id", () =>
        HttpResponse.json({ code: "Forms.Record.NotFound" }, { status: 404 }),
      ),
    );
    renderRouteWithProviders(
      `/formularios/${responseFormId}/respuestas/${responseRecordId}`,
    );
    await screen.findByRole("heading", {
      name: "No encontramos esa respuesta o no está disponible",
    });
    expect(notify).not.toHaveBeenCalled();
  });
});
