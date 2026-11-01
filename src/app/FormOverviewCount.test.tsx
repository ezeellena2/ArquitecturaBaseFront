import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQueryClient } from "@tanstack/react-query";
import { HttpResponse, http } from "msw";
import { expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { server } from "@/test/mocks/server";
import { currentUser } from "@/test/mocks/handlers";
import type { FormsOverviewNavigation } from "@/layouts/formsOverviewNavigation";
import { FormOverviewCount } from "./FormOverviewCount";
vi.mock("react-oidc-context", async () => { const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"); return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) }; });

// The menu draws its skeleton while the count is pending: Reintentar goes back to it until the count arrives, also when a
// count was already shown before the failure.
it("goes back to waiting while its retry reads the count again", async () => {
  let reads = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formapprovals.decide"] })),
    http.get("/api/forms/approvals/count", async () => {
      if (++reads === 2) return HttpResponse.json({ code: "Test.Count", detail: "No se pudo contar." }, { status: 400 });
      if (reads > 2) await gate;
      return HttpResponse.json({ count: 2 });
    }));
  let state: Omit<FormsOverviewNavigation, "setActive"> | undefined;
  function Host() {
    const client = useQueryClient();
    return <><button type="button" onClick={() => { void client.invalidateQueries({ queryKey: ["form-approvals"] }); }}>Leer de nuevo</button><FormOverviewCount onState={value => { state = value; }}/></>;
  }
  renderWithProviders(<Host/>);
  await waitFor(() => expect(state?.count).toBe(2));
  await userEvent.click(screen.getByRole("button", { name: "Leer de nuevo" }));
  await waitFor(() => expect(state?.failed).toBe(true));
  expect(state?.pending).toBe(false);
  act(() => state?.retry());
  await waitFor(() => expect(state?.pending).toBe(true));
  await act(async () => release());
  await waitFor(() => expect(state).toMatchObject({ pending: false, failed: false, count: 2 }));
});
