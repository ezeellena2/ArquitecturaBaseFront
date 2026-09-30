import { OidcClient } from "oidc-client-ts";
import { authConfig } from "./authConfig";

// Uses the same state store as the provider: PKCE and the return destination survive the final callback.
export async function createSigninReturnUrl(returnTo: string, registration: boolean): Promise<string> {
  const request = await new OidcClient(authConfig).createSigninRequest({
    request_type: "si:r",
    state: { returnTo },
    ...(registration ? { extraQueryParams: { screen_hint: "signup" } } : {}),
  });
  const url = new URL(request.url);
  if (url.origin !== location.origin || url.pathname !== "/connect/authorize") {
    throw new Error("The authorization endpoint must use the application origin.");
  }
  return url.pathname + url.search;
}

// The server revokes the current authorization and clears its cookie. The document stays in the SPA.
export async function endServerSession(idToken: string | undefined): Promise<void> {
  const request = await new OidcClient(authConfig).createSignoutRequest({ id_token_hint: idToken });
  const url = new URL(request.url);
  if (url.origin !== location.origin || url.pathname !== "/connect/logout") {
    throw new Error("The logout endpoint must use the application origin.");
  }
  const response = await fetch(url.origin + url.pathname, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: url.searchParams.toString(),
  });
  if (!response.ok) {
    throw new Error("The server session could not be closed.");
  }
}
