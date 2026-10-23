import { useEffect } from "react";
import { MemoryRouter } from "react-router";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { server } from "@/test/mocks/server";
import { UserDataSectionContext, type UserDataSectionProps } from "@/shared/hooks/userDataSectionContext";
import { adminHandlers, detailOf, juan } from "../testData";
import { UserEditDialog } from "./UserEditDialog";

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");
  return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) };
});
async function mount(dirty: boolean, save: () => Promise<boolean>) {
  const events: string[] = [], close = vi.fn();
  server.use(...adminHandlers([juan]), http.get(`/api/users/${juan.id}`, () => HttpResponse.json(detailOf(juan))), http.put(`/api/users/${juan.id}`, () => { events.push("user"); return new HttpResponse(null, { status: 204 }); }));
  function Section({ onState, userSaved }: UserDataSectionProps) {
    useEffect(() => onState({ dirty, busy: false, ready: true, save: async () => { events.push("data"); return save(); } }), [onState]);
    return <section aria-label="Datos">{userSaved ? <p>El resto del usuario ya se guardó.</p> : null}</section>;
  }
  await act(async () => { renderWithProviders(<MemoryRouter><UserDataSectionContext.Provider value={{ Section, openUser: vi.fn() }}><UserEditDialog user={juan} onClose={close} /></UserDataSectionContext.Provider></MemoryRouter>); });
  const dialog = within(await screen.findByRole("dialog", { name: "Editar usuario" }));
  await dialog.findByRole("textbox", { name: "Nombre" });
  return { dialog, events, close };
}
it("saves account first and keeps the dialog when the independent data save fails", async () => {
  const save = vi.fn().mockResolvedValue(false);
  const { dialog, events, close } = await mount(true, save);
  await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));
  await waitFor(() => expect(events).toEqual(["user", "data"]));
  expect(close).not.toHaveBeenCalled();
  expect(dialog.getByText("El resto del usuario ya se guardó.")).toBeInTheDocument();
});
it("does not write unchanged optional data and closes after saving the account", async () => {
  const save = vi.fn().mockResolvedValue(true);
  const { dialog, close } = await mount(false, save);
  await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(save).not.toHaveBeenCalled();
});
