import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { MemoryRouter } from "react-router";
import { expect, it, vi } from "vitest";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { Sidebar } from "./Sidebar";

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));

it.each([
  [["formrecords.read"], true],
  [["formapprovals.decide"], true],
  [["formrecords.read", "formapprovals.decide"], true],
  [["formtemplates.read"], false],
] as const)("uses the same alternative permission rule in the menu for %j", async (permissions, allowed) => {
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })));
  renderWithProviders(<MemoryRouter><Sidebar collapsed={false} onToggleCollapsed={vi.fn()} isMobile={false} mobileOpen={false} onCloseMobile={vi.fn()} /></MemoryRouter>);
  const sidebar = await screen.findByRole("complementary");
  await within(sidebar).findByText("ana@example.com");
  await userEvent.click(within(sidebar).getByRole("button", { name: /^gestión de formularios$/i }));
  if (allowed) expect(await screen.findByRole("link", { name: "Formularios" })).toHaveAttribute("href", "/formularios/respuestas");
  else {
    expect(screen.queryByRole("link", { name: "Formularios" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Diseñar formularios" })).toBeVisible();
  }
});
