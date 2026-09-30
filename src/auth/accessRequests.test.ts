import { http, HttpResponse } from "msw";
import { beforeEach, expect, it } from "vitest";
import { createSigninReturnUrl, endServerSession } from "./accessRequests";
import { server } from "@/test/mocks/server";

beforeEach(() => {
  sessionStorage.clear();
  server.use(http.get("/.well-known/openid-configuration", () => HttpResponse.json({
    issuer: location.origin,
    authorization_endpoint: `${location.origin}/connect/authorize`,
    end_session_endpoint: `${location.origin}/connect/logout`,
  })));
});

it("prepares a PKCE request and callback state without navigating the document", async () => {
  const returnUrl = await createSigninReturnUrl("/usuarios?page=2", true);
  const url = new URL(returnUrl, location.origin);
  expect(url.pathname).toBe("/connect/authorize");
  expect(url.searchParams.get("client_id")).toBe("web");
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  expect(url.searchParams.get("screen_hint")).toBe("signup");
  const state = JSON.parse(sessionStorage.getItem(`oidc.${url.searchParams.get("state")}`)!);
  expect(state.data).toEqual({ returnTo: "/usuarios?page=2" });
  expect(state.request_type).toBe("si:r");
  expect(state.code_verifier).toBeTruthy();
});

it("ends the server session using the OIDC logout endpoint and current identity hint", async () => {
  let hint: string | null = null;
  server.use(http.post("/connect/logout", async ({ request }) => {
    expect(request.headers.get("content-type")).toBe("application/x-www-form-urlencoded");
    hint = new URLSearchParams(await request.text()).get("id_token_hint");
    return new HttpResponse(null, { status: 200 });
  }));
  await endServerSession("identity-token");
  expect(hint).toBe("identity-token");
});

it("does not report a successful logout when the server failed", async () => {
  server.use(http.post("/connect/logout", () => new HttpResponse(null, { status: 500 })));
  await expect(endServerSession("identity-token")).rejects.toThrow();
});
