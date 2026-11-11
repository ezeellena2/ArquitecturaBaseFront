import { screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { useContext } from "react";
import { MemoryRouter } from "react-router";
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
