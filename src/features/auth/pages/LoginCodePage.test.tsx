import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { server } from "@/test/mocks/server";

const assign = vi.fn();

vi.stubGlobal("location", { ...globalThis.location, assign, origin: "https://localhost:5173" });

const returnUrl = "/connect/authorize?client_id=web";

describe("LoginCodePage", () => {
  it("verifies the code and goes to the authorize request", async () => {
    server.use(
      http.post("/account/login-code/verify", () => HttpResponse.json({ returnUrl })),
    );
    renderRouteWithProviders(`/login/codigo?returnUrl=${encodeURIComponent(returnUrl)}`, {
      state: { email: "ana@example.com" },
    });

    await userEvent.type(screen.getAllByRole("textbox")[0], "482913");
    await userEvent.click(screen.getByRole("button", { name: /verificar/i }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith(returnUrl));
  });

  it("shows the message and the attempts left when the code is wrong", async () => {
    server.use(
      http.post("/account/login-code/verify", () =>
        HttpResponse.json(
          { status: 400, code: "Auth.LoginCode.Invalid", detail: "El código no es válido.", attemptsLeft: 4 },
          { status: 400 },
        ),
      ),
    );
    renderRouteWithProviders(`/login/codigo?returnUrl=${encodeURIComponent(returnUrl)}`, {
      state: { email: "ana@example.com" },
    });

    await userEvent.type(screen.getAllByRole("textbox")[0], "000000");
    await userEvent.click(screen.getByRole("button", { name: /verificar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El código no es válido.");
    expect(screen.getByText(/te quedan 4 intentos/i)).toBeInTheDocument();
  });

  it("waits before letting the code be sent again", async () => {
    renderRouteWithProviders(`/login/codigo?returnUrl=${encodeURIComponent(returnUrl)}`, {
      state: { email: "ana@example.com", resendAfterSeconds: 60 },
    });

    expect(screen.getByRole("button", { name: /reenviar/i })).toBeDisabled();
  });
});
