import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { server } from "@/test/mocks/server";
import { loginMethods } from "@/test/mocks/handlers";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";

const { signinRedirect } = vi.hoisted(() => ({ signinRedirect: vi.fn().mockResolvedValue(undefined) }));
vi.mock("react-oidc-context", async () => ({
  ...await vi.importActual("react-oidc-context"),
  useAuth: () => ({ isAuthenticated: false, isLoading: false, user: undefined,
    signinRedirect, signinSilent: () => Promise.reject(new Error("login_required")) }),
}));

const returnUrl = "/connect/authorize?client_id=web";
const registration = `/registro?returnUrl=${encodeURIComponent(returnUrl)}`;
beforeEach(() => {
  queryClient.clear();
  signinRedirect.mockClear();
  server.use(http.get("/account/login-methods", () => HttpResponse.json({ ...loginMethods, registrationOpen: true })));
});

it("welcomes an anonymous visitor without starting interactive sign-in", async () => {
  renderRouteWithProviders("/");
  expect(await screen.findByRole("link", { name: "Crear una cuenta" })).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.queryByText(/ArquitecturaBase/)).not.toBeInTheDocument();
  expect(await screen.findByRole("link", { name: "Crear una cuenta" })).toHaveAttribute("href", "/registro");
  expect(signinRedirect).not.toHaveBeenCalled();
});

it("starts registration through OIDC with the signup hint", async () => {
  const { router } = renderRouteWithProviders("/registro");
  await screen.findByRole("textbox", { name: "Correo electrónico" });
  const authorize = new URL(new URLSearchParams(router.state.location.search).get("returnUrl")!, location.origin);
  expect(authorize.searchParams.get("screen_hint")).toBe("signup");
  expect(signinRedirect).not.toHaveBeenCalled();
});

it("requires a name and carries registration data privately to verification", async () => {
  server.use(http.post("/account/login-code", () => HttpResponse.json({ resendAfterSeconds: 60 }, { status: 202 })));
  const { router } = renderRouteWithProviders(registration);
  await userEvent.type(await screen.findByRole("textbox", { name: "Correo electrónico" }), "ana@example.com");
  await userEvent.click(screen.getByRole("button", { name: "Enviar código" }));
  expect(router.state.location.pathname).toBe("/registro");
  await userEvent.type(screen.getByRole("textbox", { name: "Nombre y apellido" }), "Ana Perez");
  await userEvent.click(screen.getByRole("button", { name: "Enviar código" }));
  expect(await screen.findByRole("heading", { name: "Revisá tu correo" })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/registro/codigo");
  expect(router.state.location.state).toMatchObject({ displayName: "Ana Perez", register: true });
  expect(router.state.location.search).not.toContain("Ana");
});

it("does not offer registration when the server closes it", async () => {
  server.use(http.get("/account/login-methods", () => HttpResponse.json({ ...loginMethods, registrationOpen: false })));
  renderRouteWithProviders(registration);
  expect(await screen.findByRole("heading", { name: "Acceso por invitación" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Enviar código" })).not.toBeInTheDocument();
});

it("keeps the name when switching to WhatsApp and returning from verification", async () => {
  server.use(
    http.get("/account/login-methods", () => HttpResponse.json({ ...loginMethods, registrationOpen: true, whatsapp: true, whatsappCountries: ["AR"] })),
    http.post("/account/login-code/whatsapp", () => HttpResponse.json({ resendAfterSeconds: 60, phone: "+5493415551234", maskedPhone: "+54 9 341 •••• 1234" }, { status: 202 })),
  );
  const { router } = renderRouteWithProviders(registration);
  await userEvent.type(await screen.findByRole("textbox", { name: "Nombre y apellido" }), "Ana Perez");
  await userEvent.click(screen.getByRole("button", { name: "WhatsApp" }));
  expect(screen.getByRole("textbox", { name: "Nombre y apellido" })).toHaveValue("Ana Perez");
  await userEvent.type(screen.getByRole("textbox", { name: "Número de WhatsApp" }), "3415551234");
  await userEvent.click(screen.getByRole("button", { name: "Enviar código" }));
  expect(await screen.findByRole("heading", { name: "Revisá tu WhatsApp" })).toBeInTheDocument();
  expect(router.state.location.state).toMatchObject({ register: true, displayName: "Ana Perez", channel: "whatsapp" });
  await userEvent.click(screen.getByRole("link", { name: "Usar otro número" }));
  expect(await screen.findByRole("textbox", { name: "Nombre y apellido" })).toHaveValue("Ana Perez");
  expect(screen.getByRole("button", { name: "WhatsApp" })).toHaveAttribute("aria-pressed", "true");
});

it("offers sign-in after an already registered account without reusing its consumed code", async () => {
  let payload: unknown;
  server.use(http.post("/account/login-code/verify", async ({ request }) => {
    payload = await request.json();
    return HttpResponse.json({ status: 403, code: "Auth.Account.AlreadyRegistered", detail: "Ya tenés una cuenta." }, { status: 403 });
  }));
  renderRouteWithProviders(`/registro/codigo?returnUrl=${encodeURIComponent(returnUrl)}`, {
    state: { channel: "email", email: "ana@example.com", displayName: "Ana", register: true, resendAfterSeconds: 0 },
  });
  const boxes = await screen.findAllByRole("textbox");
  for (const [index, box] of boxes.entries()) { await userEvent.type(box, String(index + 1)); }
  await userEvent.click(screen.getByRole("button", { name: "Verificar y crear cuenta" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Ya tenés una cuenta.");
  expect(payload).toEqual({ email: "ana@example.com", code: "123456", returnUrl, register: true, displayName: "Ana" });
  expect(screen.getByRole("button", { name: "Verificar y crear cuenta" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Reenviar código" })).toBeDisabled();
  expect(screen.getAllByRole("link", { name: "Iniciar sesión" }).every(link => link.getAttribute("href")?.startsWith("/login?"))).toBe(true);
});
