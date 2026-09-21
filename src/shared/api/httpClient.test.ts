import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./ApiError";
import { api, configureHttpClient, resetHttpClient } from "./httpClient";
import { server } from "@/test/mocks/server";

describe("httpClient", () => {
  beforeEach(() => resetHttpClient());
  afterEach(() => resetHttpClient());

  it("returns the parsed body and sends the token and the language", async () => {
    configureHttpClient({ getAccessToken: () => "token-123", getLanguage: () => "en" });
    let authorization: string | null = null;
    let language: string | null = null;
    server.use(
      http.get("/api/me", ({ request }) => {
        authorization = request.headers.get("authorization");
        language = request.headers.get("accept-language");
        return HttpResponse.json({ email: "ana@example.com" });
      }),
    );

    const me = await api.get<{ email: string }>("/api/me");

    expect(me.email).toBe("ana@example.com");
    expect(authorization).toBe("Bearer token-123");
    expect(language).toBe("en");
  });

  it("turns a problem details response into an ApiError", async () => {
    server.use(
      http.post("/account/login-code/verify", () =>
        HttpResponse.json(
          {
            title: "Datos inválidos",
            status: 400,
            detail: "El código no es válido.",
            code: "Auth.LoginCode.Invalid",
            traceId: "trace-1",
            attemptsLeft: 4,
          },
          { status: 400, headers: { "content-type": "application/problem+json" } },
        ),
      ),
    );

    const error = await api.post("/account/login-code/verify", { code: "000000" }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(400);
    expect(apiError.code).toBe("Auth.LoginCode.Invalid");
    expect(apiError.detail).toBe("El código no es válido.");
    expect(apiError.traceId).toBe("trace-1");
    expect(apiError.problem.attemptsLeft).toBe(4);
  });

  it("exposes the field errors of a validation problem", async () => {
    server.use(
      http.post("/account/login-code/verify", () =>
        HttpResponse.json(
          { status: 400, code: "Validation.Failed", errors: { returnUrl: ["La dirección de retorno no es válida."] } },
          { status: 400 },
        ),
      ),
    );

    const error = (await api.post("/account/login-code/verify", {}).catch((caught: unknown) => caught)) as ApiError;

    expect(error.errors?.returnUrl?.[0]).toBe("La dirección de retorno no es válida.");
  });

  it("renews the session once and retries after a 401", async () => {
    let token = "expired";
    const renewSession = vi.fn(async () => {
      token = "fresh";
      return token;
    });
    configureHttpClient({ getAccessToken: () => token, renewSession });
    server.use(
      http.get("/api/users", ({ request }) =>
        request.headers.get("authorization") === "Bearer fresh"
          ? HttpResponse.json({ items: [] })
          : new HttpResponse(null, { status: 401 }),
      ),
    );

    const page = await api.get<{ items: unknown[] }>("/api/users");

    expect(page.items).toEqual([]);
    expect(renewSession).toHaveBeenCalledTimes(1);
  });

  it("renews only once for several requests that fail at the same time", async () => {
    let token = "expired";
    const renewSession = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      token = "fresh";
      return token;
    });
    configureHttpClient({ getAccessToken: () => token, renewSession });
    server.use(
      http.get("/api/users", ({ request }) =>
        request.headers.get("authorization") === "Bearer fresh"
          ? HttpResponse.json({ items: [] })
          : new HttpResponse(null, { status: 401 }),
      ),
    );

    await Promise.all([api.get("/api/users"), api.get("/api/users"), api.get("/api/users")]);

    expect(renewSession).toHaveBeenCalledTimes(1);
  });

  it("gives up with a 401 error when the session cannot be renewed", async () => {
    const onSessionExpired = vi.fn();
    configureHttpClient({
      getAccessToken: () => "expired",
      renewSession: async () => undefined,
      onSessionExpired,
    });
    server.use(http.get("/api/users", () => new HttpResponse(null, { status: 401 })));

    const error = (await api.get("/api/users").catch((caught: unknown) => caught)) as ApiError;

    expect(error.status).toBe(401);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it("keeps the original 401 problem when the renewal callback rejects", async () => {
    const renewalFailure = new Error("login_required");
    const renewSession = vi.fn().mockRejectedValue(renewalFailure);
    const onSessionExpired = vi.fn();
    configureHttpClient({ getAccessToken: () => "expired", renewSession, onSessionExpired });
    server.use(
      http.get("/api/users", () =>
        HttpResponse.json(
          {
            status: 401,
            code: "Http.Unauthorized",
            detail: "La sesión venció.",
            traceId: "trace-renewal",
          },
          { status: 401 },
        ),
      ),
    );

    const error = await api.get("/api/users").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBe(renewalFailure);
    expect(error).toMatchObject({
      status: 401,
      code: "Http.Unauthorized",
      detail: "La sesión venció.",
      traceId: "trace-renewal",
    });
    expect(renewSession).toHaveBeenCalledTimes(1);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it("shares a rejected renewal and releases it for a later retry", async () => {
    let token = "expired";
    let rejectRenewal: (reason?: unknown) => void = () => undefined;
    const rejectedRenewal = new Promise<string | undefined>((_, reject) => {
      rejectRenewal = reject;
    });
    const renewSession = vi
      .fn<() => Promise<string | undefined>>()
      .mockReturnValueOnce(rejectedRenewal)
      .mockImplementationOnce(async () => {
        token = "fresh";
        return token;
      });
    const onSessionExpired = vi.fn();
    configureHttpClient({ getAccessToken: () => token, renewSession, onSessionExpired });
    server.use(
      http.get("/api/users", ({ request }) =>
        request.headers.get("authorization") === "Bearer fresh"
          ? HttpResponse.json({ items: [] })
          : HttpResponse.json({ status: 401, code: "Http.Unauthorized" }, { status: 401 }),
      ),
    );

    const failedRequests = [api.get("/api/users"), api.get("/api/users"), api.get("/api/users")];
    await vi.waitFor(() => expect(renewSession).toHaveBeenCalledTimes(1));
    rejectRenewal(new Error("login_required"));

    const errors = await Promise.all(failedRequests.map((request) => request.catch((caught: unknown) => caught)));

    expect(errors).toHaveLength(3);
    expect(errors.every((error) => error instanceof ApiError && error.status === 401)).toBe(true);
    expect(renewSession).toHaveBeenCalledTimes(1);
    expect(onSessionExpired).toHaveBeenCalledTimes(3);

    await expect(api.get<{ items: unknown[] }>("/api/users")).resolves.toEqual({ items: [] });
    expect(renewSession).toHaveBeenCalledTimes(2);
  });

  it("throws a 401 error without trying to renew when renewSession is not configured", async () => {
    const onSessionExpired = vi.fn();
    configureHttpClient({ getAccessToken: () => undefined, onSessionExpired });
    server.use(http.get("/api/me", () => new HttpResponse(null, { status: 401 })));

    const error = (await api.get("/api/me").catch((caught: unknown) => caught)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(401);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it("reports network failures", async () => {
    server.use(http.get("/api/me", () => HttpResponse.error()));

    const error = (await api.get("/api/me").catch((caught: unknown) => caught)) as ApiError;

    expect(error.isNetworkError).toBe(true);
    expect(error.status).toBe(0);
  });

  it("returns undefined for an empty response", async () => {
    server.use(http.delete("/api/users/1", () => new HttpResponse(null, { status: 204 })));

    await expect(api.delete("/api/users/1")).resolves.toBeUndefined();
  });
});
