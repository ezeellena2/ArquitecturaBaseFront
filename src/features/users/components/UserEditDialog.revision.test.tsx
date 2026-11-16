import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminHandlers, ana, carla, detailOf } from "../testData";
import type { UserDetail, UserListItem } from "../api/users";
import { loginMethodsQueryKey } from "@/shared/api/loginMethods";
import { queryClient } from "@/shared/api/queryClient";
import { whatsappLoginMethods } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) };
});

const conflictDetail = "La cuenta cambió mientras la editabas. Volvé a leerla y revisá tus cambios antes de guardar.";

/// El detalle que devuelve el servidor en cada lectura (`current`), y lo que recibió cada PUT. `respond` decide la
/// respuesta de cada guardado, en orden.
function withAccount(user: UserListItem, first: UserDetail, respond: (index: number) => Response) {
  const state = { current: first, updates: [] as unknown[], reads: 0 };

  server.use(
    ...adminHandlers([user]),
    http.get("/account/login-methods", () => HttpResponse.json(whatsappLoginMethods)),
    http.get(`/api/users/${user.id}`, () => {
      state.reads += 1;

      return HttpResponse.json(state.current);
    }),
    http.put(`/api/users/${user.id}`, async ({ request }) => {
      state.updates.push(await request.json());

      return respond(state.updates.length - 1);
    }),
  );

  return state;
}

const saved = () => new HttpResponse(null, { status: 204 });
const conflict = () => HttpResponse.json(
  { status: 409, code: "Users.User.RevisionConflict", title: "La cuenta cambió", detail: conflictDetail },
  { status: 409 },
);

/// Como el backend: compara la revisión y, si coincide, guarda el nombre y los roles y la avanza.
function serverLike(user: UserListItem, first: UserDetail) {
  const state = { current: first, updates: [] as { displayName: string | null; roles: string[]; expectedRevision: number }[] };

  server.use(
    ...adminHandlers([user]),
    http.get("/account/login-methods", () => HttpResponse.json(whatsappLoginMethods)),
    http.get(`/api/users/${user.id}`, () => HttpResponse.json(state.current)),
    http.put(`/api/users/${user.id}`, async ({ request }) => {
      const body = (await request.json()) as (typeof state.updates)[number];
      state.updates.push(body);
      if (body.expectedRevision !== state.current.revision) {
        return conflict();
      }

      state.current = { ...state.current, displayName: body.displayName, roles: body.roles, revision: state.current.revision + 1 };

      return new HttpResponse(null, { status: 204 });
    }),
  );

  return state;
}

async function openEdit(identifier: string) {
  renderRouteWithProviders("/usuarios");

  await userEvent.click(await screen.findByRole("button", { name: `Editar a ${identifier}` }));
  const dialog = await screen.findByRole("dialog", { name: "Editar usuario" });
  await within(dialog).findByRole("textbox", { name: "Nombre" });
  await waitFor(() => expect(queryClient.getQueryState(loginMethodsQueryKey)?.status).toBe("success"));

  return within(dialog);
}

/// Elige un rol en el combo del diálogo, por teclado (en jsdom el clic deja de abrir el menú de Radix).
async function pickRole(name: string) {
  const combo = await screen.findByRole("button", { name: "Roles" });
  combo.focus();
  await userEvent.keyboard("{Enter}");
  await userEvent.click(await screen.findByRole("menuitemcheckbox", { name: new RegExp(`^${name}`) }));
  await userEvent.keyboard("{Escape}");
}

async function rename(dialog: ReturnType<typeof within>, name: string) {
  const field = dialog.getByRole("textbox", { name: "Nombre" });
  await userEvent.clear(field);
  await userEvent.type(field, name);
}

beforeEach(() => {
  queryClient.clear();
});

afterEach(() => {
  toast.dismiss();
});

describe("UserEditDialog revision (N2)", () => {
  it("sends the revision of the detail it opened with", async () => {
    const state = withAccount(ana, detailOf(ana, { revision: 7 }), saved);

    const dialog = await openEdit("ana@example.com");
    await rename(dialog, "Ana María");
    await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(state.updates).toEqual([{ displayName: "Ana María", roles: ["Admin"], expectedRevision: 7 }]));
  });

  it("keeps the draft on a conflict and offers to read the account again before saving", async () => {
    const state = withAccount(ana, detailOf(ana, { revision: 1 }), index => (index === 0 ? conflict() : saved()));

    const dialog = await openEdit("ana@example.com");
    await rename(dialog, "Ana María");
    // Otro administrador le sumó un rol mientras tanto.
    state.current = detailOf(ana, { roles: ["Admin", "User"], revision: 2 });
    await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));

    // El aviso trae el texto del servidor y la acción para releer; el borrador sigue y Guardar espera la revisión.
    expect(await screen.findByText(conflictDetail)).toBeInTheDocument();
    expect(dialog.getByRole("textbox", { name: "Nombre" })).toHaveValue("Ana María");
    expect(dialog.getByRole("button", { name: "Guardar" })).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));
    expect(state.updates).toHaveLength(1);

    await userEvent.click(dialog.getByRole("button", { name: "Revisar valores actuales" }));

    // La comparación pone lado a lado lo guardado y lo que quedaría al conservar, sólo en lo que difiere: el rol que sumó
    // el otro también queda al conservar, así que no está.
    const review = await dialog.findByRole("heading", { name: "Revisar cambios" });
    await waitFor(() => expect(review).toHaveFocus());
    const table = dialog.getByRole("table");
    expect(within(table).getAllByRole("rowheader").map((header) => header.textContent)).toEqual(["Nombre"]);
    expect(within(table).getByText("Ana")).toBeInTheDocument();
    expect(within(table).getByText("Ana María")).toBeInTheDocument();

    // Conservar mis cambios: el nombre que escribí y el rol que sumó el otro, con la revisión nueva.
    await userEvent.click(dialog.getByRole("button", { name: "Conservar mis cambios" }));
    expect(dialog.queryByRole("heading", { name: "Revisar cambios" })).not.toBeInTheDocument();
    expect(dialog.getByRole("textbox", { name: "Nombre" })).toHaveValue("Ana María");
    await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(state.updates).toHaveLength(2));
    expect(state.updates[1]).toEqual({ displayName: "Ana María", roles: ["Admin", "User"], expectedRevision: 2 });
  });

  it("takes the values saved by someone else when asked to", async () => {
    const state = withAccount(ana, detailOf(ana, { revision: 1 }), index => (index === 0 ? conflict() : saved()));

    const dialog = await openEdit("ana@example.com");
    await rename(dialog, "Ana María");
    state.current = detailOf(ana, { displayName: "Ana Paz", revision: 3 });
    await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));
    await userEvent.click(await dialog.findByRole("button", { name: "Revisar valores actuales" }));
    await dialog.findByRole("heading", { name: "Revisar cambios" });

    await userEvent.click(dialog.getByRole("button", { name: "Usar valores actuales" }));

    expect(dialog.getByRole("textbox", { name: "Nombre" })).toHaveValue("Ana Paz");
    await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(state.updates).toHaveLength(2));
    expect(state.updates[1]).toEqual({ displayName: "Ana Paz", roles: ["Admin"], expectedRevision: 3 });
  });

  it("does not report its own unlink as a conflict: the next save carries the revision it left", async () => {
    const state = withAccount(carla, detailOf(carla, { revision: 4 }), saved);
    server.use(http.delete(`/api/users/${carla.id}/whatsapp`, () => {
      state.current = detailOf(carla, { phoneNumber: null, formattedPhoneNumber: null, phoneNumberConfirmed: false, revision: 5 });

      return new HttpResponse(null, { status: 204 });
    }));

    const dialog = await openEdit("carla@example.com");
    await userEvent.click(dialog.getByRole("button", { name: "Desvincular el WhatsApp de Carla Paz" }));
    const confirmation = await screen.findByRole("dialog", { name: "¿Desvincular el WhatsApp de Carla Paz?" });
    await userEvent.click(within(confirmation).getByRole("button", { name: "Desvincular" }));
    await waitFor(() => expect(dialog.getByRole("button", { name: "Agregar número" })).toBeInTheDocument());

    await rename(dialog, "Carla Paz Ríos");
    await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(state.updates).toEqual([{ displayName: "Carla Paz Ríos", roles: ["User"], expectedRevision: 5 }]));
  });

  it("keeps the revision it opened with when someone else changed the name meanwhile", async () => {
    const state = withAccount(carla, detailOf(carla, { revision: 4 }), saved);
    server.use(http.delete(`/api/users/${carla.id}/whatsapp`, () => {
      // El otro cambio (el nombre) llegó antes que el desvínculo: lo que se relee ya no es lo que se abrió.
      state.current = detailOf(carla, { displayName: "Carla P.", phoneNumber: null, formattedPhoneNumber: null, phoneNumberConfirmed: false, revision: 6 });

      return new HttpResponse(null, { status: 204 });
    }));

    const dialog = await openEdit("carla@example.com");
    await userEvent.click(dialog.getByRole("button", { name: "Desvincular el WhatsApp de Carla Paz" }));
    const confirmation = await screen.findByRole("dialog", { name: "¿Desvincular el WhatsApp de Carla Paz?" });
    await userEvent.click(within(confirmation).getByRole("button", { name: "Desvincular" }));
    await waitFor(() => expect(dialog.getByRole("button", { name: "Agregar número" })).toBeInTheDocument());

    await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(state.updates).toEqual([{ displayName: "Carla Paz", roles: ["User"], expectedRevision: 4 }]));
  });

  it("saves without a comparison when someone else only changed the status", async () => {
    const state = serverLike(ana, detailOf(ana, { revision: 1 }));

    const dialog = await openEdit("ana@example.com");
    await rename(dialog, "Ana María");
    // Otro administrador la desactivó: avanza la revisión sin tocar nada de lo que el PUT reemplaza.
    state.current = { ...state.current, isActive: false, revision: 2 };
    await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));

    // Relee, adopta la revisión y guarda una sola vez más: no hay nada ajeno que comparar.
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Editar usuario" })).not.toBeInTheDocument());
    expect(state.updates).toEqual([
      { displayName: "Ana María", roles: ["Admin"], expectedRevision: 1 },
      { displayName: "Ana María", roles: ["Admin"], expectedRevision: 2 },
    ]);
    expect(screen.queryByText(conflictDetail)).not.toBeInTheDocument();
  });

  it("retries only once, and a second conflict leads to the comparison", async () => {
    const state = withAccount(ana, detailOf(ana, { revision: 1 }), conflict);

    const dialog = await openEdit("ana@example.com");
    await rename(dialog, "Ana María");
    state.current = detailOf(ana, { isActive: false, revision: 2 });
    await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText(conflictDetail)).toBeInTheDocument();
    expect(state.updates).toEqual([
      { displayName: "Ana María", roles: ["Admin"], expectedRevision: 1 },
      { displayName: "Ana María", roles: ["Admin"], expectedRevision: 2 },
    ]);
    expect(dialog.getByRole("button", { name: "Guardar" })).toHaveAttribute("aria-disabled", "true");

    await userEvent.click(dialog.getByRole("button", { name: "Revisar valores actuales" }));
    await dialog.findByRole("heading", { name: "Revisar cambios" });
    expect(within(dialog.getByRole("table")).getAllByRole("rowheader").map((header) => header.textContent)).toEqual(["Nombre"]);
  });

  it("keeping my changes mixes the roles one by one and does not bring back one someone else took away", async () => {
    const state = serverLike(ana, detailOf(ana, { roles: ["Admin"], revision: 1 }));

    const dialog = await openEdit("ana@example.com");
    // Yo le sumo User; mientras tanto, otro le sacó Admin.
    await pickRole("User");
    state.current = { ...state.current, roles: [], revision: 2 };
    await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));
    await userEvent.click(await dialog.findByRole("button", { name: "Revisar valores actuales" }));
    await dialog.findByRole("heading", { name: "Revisar cambios" });

    // «Mi borrador» es lo que quedaría al conservar: sólo el rol que sumé.
    const table = within(dialog.getByRole("table"));
    expect(table.getAllByRole("rowheader").map((header) => header.textContent)).toEqual(["Roles"]);
    expect(table.getByText("User")).toBeInTheDocument();

    await userEvent.click(dialog.getByRole("button", { name: "Conservar mis cambios" }));
    await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(state.updates).toHaveLength(2));
    expect(state.updates[1]).toEqual({ displayName: "Ana", roles: ["User"], expectedRevision: 2 });
  });

  it("seeds the draft again only with a fresh read when it is opened again", async () => {
    const state = serverLike(ana, detailOf(ana, { revision: 1 }));
    let dialog = await openEdit("ana@example.com");
    await userEvent.click(dialog.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Editar usuario" })).not.toBeInTheDocument());

    // Otro administrador le cambió el nombre y la caché quedó vieja, sin pedirla de nuevo (como pasados los 30 s).
    state.current = { ...state.current, displayName: "Ana Paz", revision: 2 };
    await queryClient.invalidateQueries({ queryKey: ["user", ana.id], refetchType: "none" });

    await userEvent.click(await screen.findByRole("button", { name: "Editar a ana@example.com" }));
    dialog = within(await screen.findByRole("dialog", { name: "Editar usuario" }));

    expect(await dialog.findByRole("textbox", { name: "Nombre" })).toHaveValue("Ana Paz");
    await rename(dialog, "Ana Paz Ríos");
    await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(state.updates).toEqual([{ displayName: "Ana Paz Ríos", roles: ["Admin"], expectedRevision: 2 }]));
  });
});
