import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { useState } from "react";
import { RouterProvider, createMemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCurrentUser } from "./useCurrentUser";
import { useProfileLanguageSync } from "./useLanguagePreference";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import i18n, { changeLanguage } from "@/shared/i18n";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) };
});

// Lo que monta `AppLayout`: la sincronización con el idioma de la cuenta, que acá además muestra el perfil leído.
function Shell() {
  useProfileLanguageSync();
  const { data: user } = useCurrentUser();

  return <p>{user ? `Perfil en ${user.culture}` : "Sin perfil"}</p>;
}

// Un editor cuya clave lleva la cultura, con cambios sin guardar hasta que se guarda.
function Editor() {
  const [dirty, setDirty] = useState(true);
  useUnsavedChangesGuard(dirty, { remountsOnLanguageChange: true });

  return (
    <button type="button" onClick={() => setDirty(false)}>
      {dirty ? "Guardar" : "Guardado"}
    </button>
  );
}

// Se avisa apenas empieza un cambio de idioma, antes de que carguen sus textos: sirve para afirmar que no empezó.
const languageChanging = vi.fn();

describe("useProfileLanguageSync", () => {
  beforeEach(() => {
    i18n.on("languageChanging", languageChanging);
  });

  afterEach(async () => {
    i18n.off("languageChanging", languageChanging);
    languageChanging.mockReset();
    await changeLanguage("es");
  });

  it("applies the account language", async () => {
    server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, culture: "en" })));
    renderWithProviders(<Shell />);

    await screen.findByText("Perfil en en");
    await waitFor(() => expect(i18n.language).toBe("en"));
  });

  it("waits for an editor that remounts with the language to have no unsaved changes before applying the account language", async () => {
    // El idioma de la cuenta cambió en otra pestaña y el perfil se vuelve a leer: aplicarlo ya volvería a montar el
    // editor y perdería lo escrito sin preguntar.
    server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, culture: "en" })));
    const router = createMemoryRouter([{ path: "/", element: <><Shell /><Editor /></> }]);
    renderWithProviders(<RouterProvider router={router} />);

    await screen.findByText("Perfil en en");
    expect(languageChanging).not.toHaveBeenCalled();
    expect(i18n.language).toBe("es");

    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(i18n.language).toBe("en"));
  });

  it("does not undo a menu change when the editor that had unsaved changes remounts before the profile is saved", async () => {
    // Al descartar los cambios para cambiar el idioma desde el menú, el editor se vuelve a montar sin cambios mientras
    // el perfil todavía dice el idioma anterior: ese idioma ya se aplicó y no se vuelve a aplicar.
    function DiscardingEditor() {
      const [dirty, setDirty] = useState(true);
      useUnsavedChangesGuard(dirty, { remountsOnLanguageChange: true });

      return (
        <button type="button" onClick={() => { setDirty(false); void changeLanguage("en"); }}>
          Descartar y cambiar a inglés
        </button>
      );
    }
    const router = createMemoryRouter([{ path: "/", element: <><Shell /><DiscardingEditor /></> }]);
    renderWithProviders(<RouterProvider router={router} />);
    await screen.findByText("Perfil en es");

    await userEvent.click(screen.getByRole("button", { name: "Descartar y cambiar a inglés" }));

    await waitFor(() => expect(i18n.language).toBe("en"));
    expect(languageChanging.mock.calls).toEqual([["en"]]);
  });
});
