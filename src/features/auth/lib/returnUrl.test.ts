import { describe, expect, it } from "vitest";
import { authorizeReturnUrl, loginPathFor } from "./returnUrl";

describe("authorizeReturnUrl", () => {
  it("accepts the authorize request the server sends", () => {
    expect(authorizeReturnUrl("/connect/authorize")).toBe("/connect/authorize");
    expect(authorizeReturnUrl("/connect/authorize?client_id=web&scope=openid")).toBe(
      "/connect/authorize?client_id=web&scope=openid",
    );
  });

  it("treats anything else as if there were no returnUrl", () => {
    expect(authorizeReturnUrl(null)).toBeUndefined();
    expect(authorizeReturnUrl("")).toBeUndefined();
    expect(authorizeReturnUrl("/")).toBeUndefined();
    expect(authorizeReturnUrl("/usuarios")).toBeUndefined();
    // No es el endpoint de autorización, aunque empiece igual.
    expect(authorizeReturnUrl("/connect/authorizely")).toBeUndefined();
    // Una redirección abierta: el returnUrl es siempre una ruta local.
    expect(authorizeReturnUrl("https://malo.example/connect/authorize")).toBeUndefined();
    expect(authorizeReturnUrl("//malo.example/connect/authorize")).toBeUndefined();
    expect(authorizeReturnUrl("/connect/authorize?client_id=web\n")).toBeUndefined();
  });
});

describe("loginPathFor", () => {
  it("goes to /login without query when there is no returnUrl to keep", () => {
    expect(loginPathFor(undefined)).toBe("/login");
  });

  it("carries the returnUrl when it is valid", () => {
    expect(loginPathFor("/connect/authorize?client_id=web")).toBe(
      "/login?returnUrl=%2Fconnect%2Fauthorize%3Fclient_id%3Dweb",
    );
  });
});
