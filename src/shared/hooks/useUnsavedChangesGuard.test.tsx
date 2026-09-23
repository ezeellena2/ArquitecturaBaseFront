import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Link, RouterProvider, createMemoryRouter, useNavigate } from "react-router";
import { describe, expect, it } from "vitest";
import { useUnsavedChangesGuard } from "./useUnsavedChangesGuard";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

/// Una pantalla de edición mínima, que monta el `ConfirmDialog` como lo va a hacer la del rol: abierto
/// mientras la guarda frena una salida, "Descartar" sale y cerrarlo de cualquier otra forma se queda.
function Editor() {
  const [dirty, setDirty] = useState(false);
  const guard = useUnsavedChangesGuard(dirty);
  const navigate = useNavigate();

  return (
    <>
      <h1>Editar el rol</h1>
      <p>{dirty ? "Con cambios" : "Sin cambios"}</p>
      <button type="button" onClick={() => setDirty(true)}>
        Cambiar algo
      </button>
      <Link to="/roles">Volver al listado</Link>
      <Link to="?seccion=permisos">Ir a los permisos</Link>
      <button
        type="button"
        onClick={() => {
          guard.allowNextNavigation();
          void navigate("/roles/def");
        }}
      >
        Guardar y pasar al siguiente
      </button>
      <ConfirmDialog
        open={guard.isBlocked}
        onOpenChange={(next) => {
          if (!next) {
            guard.stay();
          }
        }}
        title="¿Descartar los cambios?"
        confirmLabel="Descartar"
        cancelLabel="Seguir editando"
        destructive
        onConfirm={guard.leave}
      />
    </>
  );
}

function renderEditor(initialEntries = ["/roles/abc"]) {
  const router = createMemoryRouter(
    [
      { path: "/roles", element: <h1>Listado de roles</h1> },
      { path: "/roles/:roleId", element: <Editor /> },
    ],
    { initialEntries, initialIndex: initialEntries.length - 1 },
  );

  renderWithProviders(<RouterProvider router={router} />);

  return router;
}

async function makeAChange() {
  await userEvent.click(await screen.findByRole("button", { name: "Cambiar algo" }));
  expect(screen.getByText("Con cambios")).toBeInTheDocument();
}

describe("useUnsavedChangesGuard", () => {
  it("leaves right away when there is nothing to lose", async () => {
    const router = renderEditor();

    await userEvent.click(await screen.findByRole("link", { name: "Volver al listado" }));

    expect(await screen.findByRole("heading", { name: "Listado de roles" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/roles");
  });

  it("stops a way out while there are unsaved changes", async () => {
    const router = renderEditor();
    await makeAChange();

    await userEvent.click(screen.getByRole("link", { name: "Volver al listado" }));

    expect(await screen.findByRole("dialog", { name: "¿Descartar los cambios?" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/roles/abc");
  });

  it("stays with the changes when the person keeps editing, and asks again on the next way out", async () => {
    const router = renderEditor();
    await makeAChange();
    await userEvent.click(screen.getByRole("link", { name: "Volver al listado" }));

    await userEvent.click(await screen.findByRole("button", { name: "Seguir editando" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe("/roles/abc");
    expect(screen.getByText("Con cambios")).toBeInTheDocument();

    // Quedarse no apaga la guarda: la próxima salida vuelve a preguntar.
    await userEvent.click(screen.getByRole("link", { name: "Volver al listado" }));
    expect(await screen.findByRole("dialog", { name: "¿Descartar los cambios?" })).toBeInTheDocument();
  });

  it("leaves when the person discards the changes", async () => {
    const router = renderEditor();
    await makeAChange();
    await userEvent.click(screen.getByRole("link", { name: "Volver al listado" }));

    await userEvent.click(await screen.findByRole("button", { name: "Descartar" }));

    expect(await screen.findByRole("heading", { name: "Listado de roles" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/roles");
  });

  it("leaves through the browser's Back button when the person discards the changes", async () => {
    // Con el Atrás, `proceed()` no navega en el momento: vuelve a mover el historial más tarde. El
    // `ConfirmDialog` llama a "Descartar" y enseguida se cierra, en el mismo clic; si ese cierre hiciera
    // `reset()`, la salida se volvería a evaluar con los cambios todavía puestos y el diálogo reaparecería.
    const router = renderEditor(["/roles", "/roles/abc"]);
    await makeAChange();

    await act(() => router.navigate(-1));

    expect(await screen.findByRole("dialog", { name: "¿Descartar los cambios?" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/roles/abc");

    await userEvent.click(screen.getByRole("button", { name: "Descartar" }));

    expect(await screen.findByRole("heading", { name: "Listado de roles" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/roles");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("lets exactly one navigation through after allowNextNavigation", async () => {
    // Es lo que usa el guardado: lo guardado ya no se pierde, así que volver al listado no pregunta. Pero
    // el permiso vale para esa salida y nada más.
    const router = renderEditor();
    await makeAChange();

    await userEvent.click(screen.getByRole("button", { name: "Guardar y pasar al siguiente" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/roles/def"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Con cambios")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("link", { name: "Volver al listado" }));

    expect(await screen.findByRole("dialog", { name: "¿Descartar los cambios?" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/roles/def");
  });

  it("does not ask when only the query string changes", async () => {
    // Guarda salidas de la pantalla, no cualquier cambio de la URL: en la misma ruta, lo escrito sigue ahí.
    const router = renderEditor();
    await makeAChange();

    await userEvent.click(screen.getByRole("link", { name: "Ir a los permisos" }));

    await waitFor(() => expect(router.state.location.search).toBe("?seccion=permisos"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks the browser to confirm a reload only while there are unsaved changes", async () => {
    // Recargar o cerrar la pestaña no pasa por el router, así que ahí el que pregunta es el navegador.
    renderEditor();
    await screen.findByRole("button", { name: "Cambiar algo" });

    const whileClean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(whileClean);
    expect(whileClean.defaultPrevented).toBe(false);

    await makeAChange();

    const whileDirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(whileDirty);
    expect(whileDirty.defaultPrevented).toBe(true);
  });
});
