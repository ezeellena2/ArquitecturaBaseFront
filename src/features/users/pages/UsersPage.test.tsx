import { isInaccessible, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminHandlers, ana, beto, carla, counts, juan, laura, pageOf } from "../testData";
import type { UserListItem } from "../api/users";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { queryClient } from "@/shared/api/queryClient";
import { fetchRoles, rolesQueryKey } from "@/shared/api/roles";
import { server } from "@/test/mocks/server";

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) };
});

const page = pageOf([ana, beto]);

/// Lo mínimo para dibujar la pantalla con la barra de filtros: el listado, el perfil y los conteos.
function listHandlers(body: ReturnType<typeof pageOf> = page) {
  return [
    http.get("/api/users", () => HttpResponse.json(body)),
    http.get("/api/users/filter-counts", () => HttpResponse.json(counts)),
  ];
}

/// La fila de una persona, ya con la tabla cargada. Se busca por el nombre, que está en todas las filas de estos datos.
async function rowOf(user: UserListItem) {
  const table = await screen.findByRole("table");
  const cell = await within(table).findByText(user.displayName ?? "");
  const row = cell.closest("tr");

  if (row === null) {
    throw new Error(`No row for ${user.displayName ?? user.id}`);
  }

  return within(row);
}

describe("UsersPage", () => {
  // AppProviders usa el queryClient de la app (un singleton, con staleTime). Sin esto, la respuesta de
  // /api/users de un test queda cacheada y se filtra al siguiente, que pisó el handler con otra respuesta
  // (mismo patrón que Sidebar.test.tsx).
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the users of the first page", async () => {
    server.use(...listHandlers());

    renderRouteWithProviders("/usuarios");

    // El usuario de sesión por defecto (test/mocks/handlers.ts) también se llama Ana <ana@example.com> y su
    // correo aparece siempre al pie del sidebar: hay que acotar la búsqueda a la tabla para no toparse con
    // esa otra coincidencia (y de paso, esperar a que la tabla haya montado, no cualquier texto suelto).
    const table = await screen.findByRole("table");
    expect(within(table).getByText("ana@example.com")).toBeInTheDocument();
    expect(within(table).getByText("beto@example.com")).toBeInTheDocument();
  });

  it("calls the first column Usuario, and searches by email, name or number", async () => {
    server.use(...listHandlers());

    renderRouteWithProviders("/usuarios");

    const table = await screen.findByRole("table");
    // Una cuenta puede no tener correo: la columna dice quién es, con el correo o con el número.
    expect(within(table).getByRole("columnheader", { name: /usuario/i })).toBeInTheDocument();
    expect(within(table).queryByRole("columnheader", { name: /correo/i })).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Buscar por correo, nombre o número" })).toHaveAttribute(
      "placeholder",
      "Buscar por correo, nombre o número",
    );
  });

  it("shows the email and marks that the person also enters with WhatsApp", async () => {
    server.use(...listHandlers(pageOf([carla])));

    renderRouteWithProviders("/usuarios");

    const row = await rowOf(carla);
    expect(row.getByText("carla@example.com")).toBeInTheDocument();
    // El número no se repite al lado del correo: el ícono alcanza para decir que también entra con WhatsApp.
    expect(row.getByRole("img", { name: "También entra con WhatsApp" })).toBeInTheDocument();
    expect(row.queryByText("+54 9 11 5555-4444")).not.toBeInTheDocument();
  });

  it("shows only the email when the person has no number", async () => {
    server.use(...listHandlers(pageOf([ana])));

    renderRouteWithProviders("/usuarios");

    const row = await rowOf(ana);
    expect(row.getByText("ana@example.com")).toBeInTheDocument();
    expect(row.queryByRole("img", { name: "También entra con WhatsApp" })).not.toBeInTheDocument();
    expect(row.queryByText("Sin verificar")).not.toBeInTheDocument();
  });

  it("shows the formatted number when there is no email", async () => {
    server.use(...listHandlers(pageOf([juan])));

    renderRouteWithProviders("/usuarios");

    const row = await rowOf(juan);
    // El número formateado que manda el backend, nunca el E.164.
    expect(row.getByText("+54 9 11 2345-6789")).toBeInTheDocument();
    expect(row.queryByText("+5491123456789")).not.toBeInTheDocument();
    // El número ya dice que entra con WhatsApp: el ícono de al lado no se anuncia otra vez, con ningún nombre.
    expect(row.queryByRole("img", { name: /whatsapp/i })).not.toBeInTheDocument();
    expect(row.queryByText("Sin verificar")).not.toBeInTheDocument();
  });

  it("marks a number that the person has not used yet, and says what that means", async () => {
    server.use(...listHandlers(pageOf([laura])));

    renderRouteWithProviders("/usuarios");

    const row = await rowOf(laura);
    expect(row.getByText("+54 9 351 555-1234")).toBeInTheDocument();
    expect(row.getByText("Sin verificar")).toBeInTheDocument();
    // Lo que quiere decir es texto de la fila, al alcance del lector de pantalla. Un `aria-describedby` sobre algo que
    // no recibe foco no alcanza: jsdom calcula la descripción igual, pero NVDA y JAWS no la leen en modo exploración.
    const explanation = row.getByText("Número que cargó un admin y con el que la persona todavía no entró.");
    expect(isInaccessible(explanation)).toBe(false);
  });

  describe("the help on the marks, which the keyboard reaches too", () => {
    const explanation = "Número que cargó un admin y con el que la persona todavía no entró.";

    /// Lo que tiene el foco después de un Shift+Tab desde "Editar", la primera acción de la fila: lo último de la
    /// columna "Usuario", porque el nombre, los roles y la fecha no reciben foco.
    async function focusBeforeEdit(row: Awaited<ReturnType<typeof rowOf>>, identifier: string) {
      row.getByRole("button", { name: `Editar a ${identifier}` }).focus();
      await userEvent.tab({ shift: true });

      return document.activeElement;
    }

    it("reaches Sin verificar with the keyboard, and what shows up there is what it means", async () => {
      // "Lo que hace el puntero también lo hace el teclado" (fundamento visual): la ayuda que aparece al pasar el mouse
      // aparece también al llegar con Tab, y para eso la insignia tiene que poder recibir el foco.
      server.use(...adminHandlers([laura]));

      renderRouteWithProviders("/usuarios");

      const focused = await focusBeforeEdit(await rowOf(laura), "+54 9 351 555-1234");
      expect(focused).toHaveTextContent("Sin verificar");
      expect(focused).toHaveTextContent(explanation);
    });

    it("reaches the WhatsApp mark next to the email with the keyboard", async () => {
      server.use(...adminHandlers([carla]));

      renderRouteWithProviders("/usuarios");

      const row = await rowOf(carla);
      await focusBeforeEdit(row, "carla@example.com");
      expect(row.getByRole("img", { name: "También entra con WhatsApp" })).toHaveFocus();
    });

    // jsdom no aplica el CSS: lo que se puede comprobar acá es el atributo que oculta la ayuda, no que se oculte.
    it("closes the help with Esc without moving the focus, and brings it back on the next visit", async () => {
      server.use(...adminHandlers([laura]));

      renderRouteWithProviders("/usuarios");

      const row = await rowOf(laura);
      const badge = await focusBeforeEdit(row, "+54 9 351 555-1234");
      await userEvent.keyboard("{Escape}");

      // WCAG 1.4.13: la ayuda tapa la fila de arriba, así que tiene que poder cerrarse sin irse de donde se está.
      expect(badge).toHaveFocus();
      expect(badge).toHaveAttribute("data-dismissed");

      await userEvent.tab();
      await focusBeforeEdit(row, "+54 9 351 555-1234");
      expect(badge).toHaveFocus();
      expect(badge).not.toHaveAttribute("data-dismissed");
    });

    it("closes the help with Esc while the pointer is on the mark, wherever the focus is", async () => {
      server.use(...adminHandlers([carla]));

      renderRouteWithProviders("/usuarios");

      const mark = (await rowOf(carla)).getByRole("img", { name: "También entra con WhatsApp" });
      await userEvent.hover(mark);
      await userEvent.keyboard("{Escape}");

      expect(mark).not.toHaveFocus();
      expect(mark).toHaveAttribute("data-dismissed");

      await userEvent.unhover(mark);
      expect(mark).not.toHaveAttribute("data-dismissed");
    });
  });

  it("says the status in words and not only with a colour", async () => {
    // "El color nunca comunica solo" (fundamento visual). El punto es decorativo: lo que se lee es la
    // palabra, y sin esta prueba el día que alguien deje el punto solo nadie se entera.
    server.use(...listHandlers());

    renderRouteWithProviders("/usuarios");

    const rows = within(await screen.findByRole("table")).getAllByRole("row");

    expect(within(rows[1]).getByText("Activo")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Inactivo")).toBeInTheDocument();
  });

  it("shows the roles of each row", async () => {
    // Sin esta columna, saber qué rol tiene alguien obliga a abrir su diálogo fila por fila.
    server.use(...listHandlers());

    renderRouteWithProviders("/usuarios");

    const rows = within(await screen.findByRole("table")).getAllByRole("row");

    expect(within(rows[1]).getByText("Admin")).toBeInTheDocument();
    // Quien no tiene ninguno muestra la raya, no una celda vacía que parece un dato que no cargó. Por celda
    // y no por texto: beto tampoco tiene nombre, así que la raya aparece dos veces en su fila.
    expect(within(rows[2]).getAllByRole("cell")[2]).toHaveTextContent("—");
  });

  it("offers Editar first, and names every action with the email or, without one, the number", async () => {
    server.use(...adminHandlers([ana, juan]));

    renderRouteWithProviders("/usuarios");

    const anaRow = await rowOf(ana);
    const anaActions = anaRow.getAllByRole("button");
    expect(anaActions.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Editar a ana@example.com",
      "Desactivar a ana@example.com",
      "Eliminar a ana@example.com",
    ]);

    const juanRow = await rowOf(juan);
    expect(juanRow.getByRole("button", { name: "Editar a +54 9 11 2345-6789" })).toBeInTheDocument();
    expect(juanRow.getByRole("button", { name: "Desactivar a +54 9 11 2345-6789" })).toBeInTheDocument();
    expect(juanRow.getByRole("button", { name: "Eliminar a +54 9 11 2345-6789" })).toBeInTheDocument();
  });

  it("names the confirmation with the number when the person has no email", async () => {
    server.use(...adminHandlers([juan]));

    renderRouteWithProviders("/usuarios");

    await userEvent.click(await screen.findByRole("button", { name: "Eliminar a +54 9 11 2345-6789" }));

    expect(await screen.findByRole("dialog", { name: "Eliminar a +54 9 11 2345-6789" })).toBeInTheDocument();
  });

  it("sends the search to the backend and keeps it in the URL", async () => {
    const requests: string[] = [];
    server.use(
      http.get("/api/users", ({ request }) => {
        requests.push(new URL(request.url).search);
        return HttpResponse.json(page);
      }),
      http.get("/api/users/filter-counts", () => HttpResponse.json(counts)),
    );

    renderRouteWithProviders("/usuarios");
    await screen.findByRole("table");
    await userEvent.type(screen.getByRole("searchbox"), "ana");

    await waitFor(() => expect(requests.at(-1)).toContain("search=ana"));
  });

  it("shows the message when the search returns nothing", async () => {
    server.use(...listHandlers(pageOf([])));

    renderRouteWithProviders("/usuarios");

    expect(await screen.findByRole("heading", { name: /no encontramos usuarios/i })).toBeInTheDocument();
  });

  it("sends the filters to the backend and keeps them in the URL", async () => {
    const requests: string[] = [];
    server.use(
      http.get("/api/users", ({ request }) => {
        requests.push(new URL(request.url).search);
        return HttpResponse.json(page);
      }),
      http.get("/api/users/filter-counts", () => HttpResponse.json(counts)),
    );

    renderRouteWithProviders("/usuarios");
    await screen.findByRole("table");

    await userEvent.click(screen.getByRole("button", { name: "Inactivos" }));


    await waitFor(() => expect(requests.at(-1)).toContain("isActive=false"));
  });

  it("shows a chip per filter and takes it out one by one", async () => {
    server.use(...listHandlers());

    renderRouteWithProviders("/usuarios?isActive=false");
    await screen.findByRole("table");

    const quitar = screen.getByRole("button", { name: /quitar el filtro estado/i });

    await userEvent.click(quitar);

    expect(screen.queryByRole("button", { name: /quitar el filtro estado/i })).not.toBeInTheDocument();
  });

  it("disables the options that would bring nothing", async () => {
    // El número no está para decorar: si una opción da cero, elegirla es un camino que no lleva a ningún
    // lado, y el desplegable lo dice antes de que se apriete.
    server.use(...listHandlers());

    renderRouteWithProviders("/usuarios");
    await screen.findByRole("table");

    // Con teclado y no con clic, por la descoordinación conocida de userEvent con el `pointerdown` de Radix
    // (el mismo motivo que `openMenu` en UserMenu.test.tsx).
    const trigger = screen.getByRole("button", { name: /filtrar por rol/i });
    trigger.focus();
    await userEvent.keyboard("{Enter}");

    expect(await screen.findByRole("menuitem", { name: /soporte/i })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("menuitem", { name: /admin/i })).not.toHaveAttribute("aria-disabled", "true");
  });

  it("tells apart an empty list from one that no filter matches", async () => {
    server.use(...listHandlers(pageOf([])));

    renderRouteWithProviders("/usuarios?isActive=false&role=Admin");

    // Son dos vacíos distintos: "todavía no hay usuarios" no se arregla igual que "ninguno coincide".
    expect(await screen.findByRole("heading", { name: /ningún usuario coincide/i })).toBeInTheDocument();
    expect(screen.getByText(/2 filtros aplicados/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /limpiar filtros/i })).toBeInTheDocument();
  });

  it("shows the forbidden page when the backend answers 403", async () => {
    server.use(
      http.get("/api/users", () =>
        HttpResponse.json({ status: 403, code: "Http.Forbidden", detail: "No tenés permiso." }, { status: 403 }),
      ),
      http.get("/api/users/filter-counts", () => HttpResponse.json(counts)),
    );

    renderRouteWithProviders("/usuarios");

    // La sección 6.1 del spec pide la pantalla de "sin permiso", no un error dentro del listado.
    expect(await screen.findByRole("heading", { name: /no tenés permiso/i })).toBeInTheDocument();
  });

  it("shows the error state with the traceId when the backend fails", async () => {
    server.use(
      http.get("/api/users", () =>
        HttpResponse.json(
          { status: 500, code: "General.Unexpected", detail: "Ocurrió un error inesperado.", traceId: "trace-123" },
          { status: 500 },
        ),
      ),
      http.get("/api/users/filter-counts", () => HttpResponse.json(counts)),
    );

    renderRouteWithProviders("/usuarios");

    expect(await screen.findByRole("heading", { name: /ocurrió un error inesperado/i })).toBeInTheDocument();
    // El texto exacto: el toast del queryClient global también menciona el traceId (sección 6.1 del spec),
    // así que no alcanza con buscar "trace-123" a secas.
    expect(screen.getByText("Código para reportar: trace-123")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
  });

  it("explains the protection rule when the backend refuses to deactivate the last admin", async () => {
    const toastError = vi.spyOn(toast, "error");
    server.use(
      ...adminHandlers(),
      http.post("/api/users/1/deactivate", () =>
        HttpResponse.json(
          { status: 409, code: "Users.User.LastAdmin", detail: "Tiene que quedar un administrador." },
          { status: 409 },
        ),
      ),
    );

    renderRouteWithProviders("/usuarios");

    await userEvent.click(await screen.findByRole("button", { name: "Desactivar a ana@example.com" }));
    await userEvent.click(await screen.findByRole("button", { name: "Desactivar" }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "No podés dejar al sistema sin administradores. Asigná el rol Admin a otra cuenta activa y volvé a intentar.",
      ),
    );
  });

  it("says what is lost before deleting, and deletes when confirmed", async () => {
    let deleted = 0;
    server.use(
      ...adminHandlers(),
      http.delete("/api/users/1", () => {
        deleted += 1;

        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderRouteWithProviders("/usuarios");

    await userEvent.click(await screen.findByRole("button", { name: "Eliminar a ana@example.com" }));

    expect(await screen.findByText(/su historial de ingresos se conserva/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => expect(deleted).toBe(1));
  });

  it("marks the roles catalogue as stale after deleting a user", async () => {
    server.use(...adminHandlers(), http.delete("/api/users/1", () => new HttpResponse(null, { status: 204 })));

    renderRouteWithProviders("/usuarios");

    // La caché de roles, como si se viniera de /roles.
    await queryClient.fetchQuery({ queryKey: rolesQueryKey, queryFn: fetchRoles });
    expect(queryClient.getQueryState(rolesQueryKey)?.isInvalidated).toBe(false);

    await userEvent.click(await screen.findByRole("button", { name: "Eliminar a ana@example.com" }));
    await userEvent.click(await screen.findByRole("button", { name: "Eliminar" }));

    // Eliminar una cuenta cambia el `userCount` de los roles que tenía. Sin invalidar, /roles muestra el
    // conteo viejo durante los 30 s de staleTime, y puede ofrecer borrar un rol que todavía tiene gente.
    await waitFor(() => expect(queryClient.getQueryState(rolesQueryKey)?.isInvalidated).toBe(true));
  });

  it("hides the new user button and the row actions without users.manage", async () => {
    // El handler por defecto de /api/me devuelve permissions: ["users.read"].
    server.use(...listHandlers());

    renderRouteWithProviders("/usuarios");

    // Hay que esperar a que /api/me haya resuelto: hasta que no llega, los permisos están pendientes y las
    // acciones tampoco se ven, con lo cual la aserción pasaría sin haber probado nada. El pie del sidebar
    // solo pinta el correo cuando esa consulta trajo al usuario (mismo patrón que Sidebar.test.tsx).
    const sidebar = await screen.findByRole("complementary");
    await within(sidebar).findByText("ana@example.com");

    expect(screen.queryByRole("button", { name: "Nuevo usuario" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /editar a/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /eliminar a/i })).not.toBeInTheDocument();
  });
});
