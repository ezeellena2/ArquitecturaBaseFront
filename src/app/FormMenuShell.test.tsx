import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { useContext } from "react";
import { MemoryRouter, useNavigate } from "react-router";
import { expect, it, vi } from "vitest";
import { initialAppearance } from "@/shared/lib/appearance";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { server } from "@/test/mocks/server";
import { currentUser } from "@/test/mocks/handlers";
import { FolderMenuNavigationContext } from "@/layouts/folderMenuNavigation";
import { FormMenuShell } from "./FormMenuShell";
vi.mock("react-oidc-context", async () => { const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"); return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) }; });

// Synthetic menu for the composition; the HTTP contract test consumes the backend capture separately.
const route = "0199a0c0-0000-7000-8000-0000000000a1";
const menu = { menus: [{ folderId: "0199a0c0-0000-7000-8000-0000000000f2", name: "Repartos", icon: "truck", forms: [{ id: route, name: "Hoja de ruta" }], groups: [] }], forms: [], administration: [] };
function Probe() {
  const value = useContext(FolderMenuNavigationContext);
  return <p data-testid="menu">{value?.pending ? "pending" : value?.content?.sections.map(section => `${section.label}:${section.links.map(link => link.to).join(",")}`).join(";") ?? "none"}</p>;
}
const presentation = (features: string[]) => http.get("/api/settings/presentation", () => HttpResponse.json({ appearance: initialAppearance, defaultCulture: "es", defaultTimeZoneId: "UTC", defaultPageSize: 20, installedFeatures: features }));

it.each([
  [["formrecords.read"], `Repartos:/formularios/${route}/respuestas`],
  [["formrecords.create"], `Repartos:/formularios/${route}/cargar`],
] as const)("reads the menu of the forms module and sends each form where the person can open it (%j)", async (permissions, expected) => {
  server.use(presentation(["forms"]), http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })), http.get("/api/forms/menu", () => HttpResponse.json(menu)));
  renderWithProviders(<MemoryRouter><FormMenuShell><Probe /></FormMenuShell></MemoryRouter>);
  await waitFor(() => expect(screen.getByTestId("menu")).toHaveTextContent(expected));
});

it.each([
  ["without the forms module", [], ["formrecords.read"]],
  ["without a permission that opens forms", ["forms"], ["formtemplates.read"]],
] as const)("does not read the menu %s", async (_case, features, permissions) => {
  const read = vi.fn();
  server.use(presentation([...features]), http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })), http.get("/api/forms/menu", () => { read(); return HttpResponse.json(menu); }));
  renderWithProviders(<MemoryRouter><FormMenuShell><Probe /></FormMenuShell></MemoryRouter>);
  await waitFor(() => expect(screen.getByTestId("menu")).toHaveTextContent("none"));
  expect(read).not.toHaveBeenCalled();
});

it("remembers the form opened from the menu while its screens are open, and forgets it on leaving them", async () => {
  server.use(presentation(["forms"]), http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.read"] })), http.get("/api/forms/menu", () => HttpResponse.json(menu)));
  function Entry() {
    const value = useContext(FolderMenuNavigationContext);
    const navigate = useNavigate();
    return <>
      <p data-testid="entry">{value?.entry?.formLabel ?? "none"}</p>
      <button type="button" onClick={() => { value?.enter({ key: "k", formId: route, panel: "folder-menu:x", menuLabel: "Repartos", formLabel: "Hoja de ruta" }); void navigate(`/formularios/${route}/respuestas`); }}>Abrir desde el menú</button>
      <button type="button" onClick={() => { void navigate(`/formularios/${route}/respuestas/registro`); }}>Abrir una respuesta</button>
      <button type="button" onClick={() => { void navigate("/"); }}>Volver a Inicio</button>
      <button type="button" onClick={() => { void navigate(`/formularios/${route}/respuestas`); }}>Abrir desde Formularios</button>
    </>;
  }
  renderWithProviders(<MemoryRouter><FormMenuShell><Entry /></FormMenuShell></MemoryRouter>);
  await userEvent.click(await screen.findByRole("button", { name: "Abrir desde el menú" }));
  await waitFor(() => expect(screen.getByTestId("entry")).toHaveTextContent("Hoja de ruta"));
  await userEvent.click(screen.getByRole("button", { name: "Abrir una respuesta" }));
  expect(screen.getByTestId("entry")).toHaveTextContent("Hoja de ruta");
  await userEvent.click(screen.getByRole("button", { name: "Volver a Inicio" }));
  await waitFor(() => expect(screen.getByTestId("entry")).toHaveTextContent("none"));
  await userEvent.click(screen.getByRole("button", { name: "Abrir desde Formularios" }));
  expect(screen.getByTestId("entry")).toHaveTextContent("none");
});
