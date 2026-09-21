import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { currentUser } from "@/test/mocks/handlers";
import { queryClient } from "@/shared/api/queryClient";
import { fetchRoles, rolesQueryKey } from "@/shared/api/roles";
import { server } from "@/test/mocks/server";

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) };
});

const page = {
  items: [
    { id: "1", email: "ana@example.com", displayName: "Ana", isActive: true, createdAtUtc: "2026-09-18T12:00:00Z" },
    { id: "2", email: "beto@example.com", displayName: null, isActive: false, createdAtUtc: "2026-09-18T13:00:00Z" },
  ],
  page: 1,
  pageSize: 20,
  totalCount: 2,
  totalPages: 1,
  hasPrevious: false,
  hasNext: false,
};

/// El perfil de quien sí puede administrar. El handler por defecto solo trae "users.read".
const admin = { ...currentUser, permissions: ["users.read", "users.manage", "roles.read"] };

const roles = [
  { id: "r1", name: "Admin", description: "Puede hacer todo.", isSystemRole: true, userCount: 1, permissions: [] },
  { id: "r2", name: "User", description: null, isSystemRole: true, userCount: 3, permissions: [] },
];

/// El arnés corre con `onUnhandledRequest: "error"`: cada test declara todo lo que su pantalla va a pedir.
function adminHandlers() {
  return [
    http.get("/api/me", () => HttpResponse.json(admin)),
    http.get("/api/users", () => HttpResponse.json(page)),
    http.get("/api/roles", () => HttpResponse.json(roles)),
  ];
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
    server.use(http.get("/api/users", () => HttpResponse.json(page)));

    renderRouteWithProviders("/usuarios");

    // El usuario de sesión por defecto (test/mocks/handlers.ts) también se llama Ana <ana@example.com> y su
    // correo aparece siempre al pie del sidebar: hay que acotar la búsqueda a la tabla para no toparse con
    // esa otra coincidencia (y de paso, esperar a que la tabla haya montado, no cualquier texto suelto).
    const table = await screen.findByRole("table");
    expect(within(table).getByText("ana@example.com")).toBeInTheDocument();
    expect(within(table).getByText("beto@example.com")).toBeInTheDocument();
  });

  it("says the status in words and not only with a colour", async () => {
    // "El color nunca comunica solo" (fundamento visual). El punto es decorativo: lo que se lee es la
    // palabra, y sin esta prueba el día que alguien deje el punto solo nadie se entera.
    server.use(http.get("/api/users", () => HttpResponse.json(page)));

    renderRouteWithProviders("/usuarios");

    const rows = within(await screen.findByRole("table")).getAllByRole("row");

    expect(within(rows[1]).getByText("Activo")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Inactivo")).toBeInTheDocument();
  });

  it("sends the search to the backend and keeps it in the URL", async () => {
    const requests: string[] = [];
    server.use(
      http.get("/api/users", ({ request }) => {
        requests.push(new URL(request.url).search);
        return HttpResponse.json(page);
      }),
    );

    renderRouteWithProviders("/usuarios");
    await screen.findByRole("table");
    await userEvent.type(screen.getByRole("searchbox"), "ana");

    await waitFor(() => expect(requests.at(-1)).toContain("search=ana"));
  });

  it("shows the message when the search returns nothing", async () => {
    server.use(http.get("/api/users", () => HttpResponse.json({ ...page, items: [], totalCount: 0, totalPages: 0 })));

    renderRouteWithProviders("/usuarios");

    expect(await screen.findByRole("heading", { name: /no encontramos usuarios/i })).toBeInTheDocument();
  });

  it("shows the forbidden page when the backend answers 403", async () => {
    server.use(
      http.get("/api/users", () =>
        HttpResponse.json({ status: 403, code: "Http.Forbidden", detail: "No tenés permiso." }, { status: 403 }),
      ),
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
    );

    renderRouteWithProviders("/usuarios");

    expect(await screen.findByRole("heading", { name: /ocurrió un error inesperado/i })).toBeInTheDocument();
    // El texto exacto: el toast del queryClient global también menciona el traceId (sección 6.1 del spec),
    // así que no alcanza con buscar "trace-123" a secas.
    expect(screen.getByText("Código para reportar: trace-123")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
  });

  it("creates a user from the new user dialog", async () => {
    const created: unknown[] = [];
    server.use(
      ...adminHandlers(),
      http.post("/api/users", async ({ request }) => {
        created.push(await request.json());

        return HttpResponse.json("0199a0c0-0000-7000-8000-000000000001");
      }),
    );

    renderRouteWithProviders("/usuarios");

    await userEvent.click(await screen.findByRole("button", { name: "Nuevo usuario" }));
    await userEvent.type(await screen.findByRole("textbox", { name: "Correo electrónico" }), "nueva@example.com");
    await userEvent.click(await screen.findByRole("checkbox", { name: "Admin" }));
    await userEvent.click(screen.getByRole("button", { name: "Dar de alta" }));

    await waitFor(() =>
      expect(created).toEqual([{ email: "nueva@example.com", displayName: null, roles: ["Admin"] }]),
    );
  });

  it("keeps the dialog open and explains that the email already has an account", async () => {
    server.use(
      ...adminHandlers(),
      http.post("/api/users", () =>
        HttpResponse.json(
          { status: 409, code: "Users.User.AlreadyExists", detail: "Ese correo ya tiene cuenta." },
          { status: 409 },
        ),
      ),
    );

    renderRouteWithProviders("/usuarios");

    await userEvent.click(await screen.findByRole("button", { name: "Nuevo usuario" }));
    await userEvent.type(await screen.findByRole("textbox", { name: "Correo electrónico" }), "ana@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Dar de alta" }));

    // El texto lo decide el `code`, no el `detail`: el del backend no dice qué hacer con una cuenta borrada.
    expect(await screen.findByRole("alert")).toHaveTextContent("Ya hay una cuenta con ese correo.");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows the message of the field the backend rejected when creating a user", async () => {
    server.use(
      ...adminHandlers(),
      http.post("/api/users", () =>
        HttpResponse.json(
          {
            status: 400,
            code: "Validation.Failed",
            detail: "Revisá los datos ingresados.",
            errors: { displayName: ["El nombre no puede tener más de 100 caracteres."] },
          },
          { status: 400 },
        ),
      ),
    );

    renderRouteWithProviders("/usuarios");

    await userEvent.click(await screen.findByRole("button", { name: "Nuevo usuario" }));
    await userEvent.type(await screen.findByRole("textbox", { name: "Correo electrónico" }), "nueva@example.com");
    await userEvent.type(screen.getByRole("textbox", { name: "Nombre" }), "Ana");
    await userEvent.click(screen.getByRole("button", { name: "Dar de alta" }));

    // Sin esto el diálogo quedaba abierto sin un solo mensaje, como si el botón no hiciera nada:
    // `applyApiErrorToForm` daba el error por mostrado y el campo no lo pintaba.
    expect(await screen.findByRole("alert")).toHaveTextContent("El nombre no puede tener más de 100 caracteres.");
  });

  it("prefers the backend's message for the email over the generic one", async () => {
    server.use(
      ...adminHandlers(),
      http.post("/api/users", () =>
        HttpResponse.json(
          {
            status: 400,
            code: "Validation.Failed",
            detail: "Revisá los datos ingresados.",
            errors: { email: ["El correo no puede tener más de 254 caracteres."] },
          },
          { status: 400 },
        ),
      ),
    );

    renderRouteWithProviders("/usuarios");

    await userEvent.click(await screen.findByRole("button", { name: "Nuevo usuario" }));
    await userEvent.type(await screen.findByRole("textbox", { name: "Correo electrónico" }), "nueva@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Dar de alta" }));

    // "Ingresá un correo electrónico válido" no explicaría qué pasó: el formato estaba bien.
    expect(await screen.findByRole("alert")).toHaveTextContent("El correo no puede tener más de 254 caracteres.");
  });

  it("explains the error and offers to retry when the user detail cannot be loaded", async () => {
    server.use(
      ...adminHandlers(),
      http.get("/api/users/1", () =>
        HttpResponse.json(
          { status: 404, code: "Users.User.NotFound", detail: "No encontramos la cuenta." },
          { status: 404 },
        ),
      ),
    );

    renderRouteWithProviders("/usuarios");

    await userEvent.click(await screen.findByRole("button", { name: "Editar los roles de ana@example.com" }));

    // Pasa de verdad con dos administradores a la vez: uno elimina la cuenta y el otro abre el diálogo desde
    // un listado viejo. Antes quedaban dos bloques grises para siempre, sin mensaje ni reintento.
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("No encontramos la cuenta.");
    expect(within(dialog).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("gives the focus back to the button that opened the dialog", async () => {
    server.use(...adminHandlers());

    renderRouteWithProviders("/usuarios");

    const newUser = await screen.findByRole("button", { name: "Nuevo usuario" });
    newUser.focus();
    await userEvent.click(newUser);
    await screen.findByRole("dialog");

    await userEvent.keyboard("{Escape}");

    // Radix solo le devuelve el foco a un DialogTrigger propio, y acá lo abre un Button cualquiera: sin
    // `onCloseAutoFocus` el foco cae en <body> y el siguiente Tab arranca desde el principio del documento.
    await waitFor(() => expect(newUser).toHaveFocus());
  });

  it("saves the roles of a user without erasing the name", async () => {
    const updates: unknown[] = [];
    server.use(
      ...adminHandlers(),
      http.get("/api/users/1", () => HttpResponse.json({ ...page.items[0], roles: ["User"] })),
      http.put("/api/users/1", async ({ request }) => {
        updates.push(await request.json());

        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderRouteWithProviders("/usuarios");

    await userEvent.click(await screen.findByRole("button", { name: "Editar los roles de ana@example.com" }));
    await userEvent.click(await screen.findByRole("checkbox", { name: "Admin" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    // El PUT reemplaza nombre y roles: el nombre que ya tenía tiene que volver tal cual.
    await waitFor(() => expect(updates).toEqual([{ displayName: "Ana", roles: ["User", "Admin"] }]));
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
    server.use(http.get("/api/users", () => HttpResponse.json(page)));

    renderRouteWithProviders("/usuarios");

    // Hay que esperar a que /api/me haya resuelto: hasta que no llega, los permisos están pendientes y las
    // acciones tampoco se ven, con lo cual la aserción pasaría sin haber probado nada. El pie del sidebar
    // solo pinta el correo cuando esa consulta trajo al usuario (mismo patrón que Sidebar.test.tsx).
    const sidebar = await screen.findByRole("complementary");
    await within(sidebar).findByText(currentUser.email);

    expect(screen.queryByRole("button", { name: "Nuevo usuario" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /eliminar a/i })).not.toBeInTheDocument();
  });
});
