import { ApiError } from "./ApiError";
import { isProblemDetails, type ProblemDetails } from "./problemDetails";

interface HttpClientOptions {
  getAccessToken?: () => string | undefined;
  getLanguage?: () => string;
  /// Renueva la sesión y devuelve el token nuevo, o undefined si ya no se puede.
  renewSession?: () => Promise<string | undefined>;
  /// Se llama cuando un 401 no se pudo recuperar: la app manda al login.
  onSessionExpired?: () => void;
}

const defaults: HttpClientOptions = {};
let options: HttpClientOptions = defaults;

/// Una sola renovación a la vez: el backend revoca toda la cadena si se reusa un refresh token.
let renewal: Promise<string | undefined> | undefined;

export function configureHttpClient(next: HttpClientOptions): void {
  options = { ...defaults, ...next };
}

export function resetHttpClient(): void {
  options = defaults;
  renewal = undefined;
}

function renewOnce(): Promise<string | undefined> {
  renewal ??= (options.renewSession?.() ?? Promise.resolve(undefined)).finally(() => {
    renewal = undefined;
  });

  return renewal;
}

async function readProblem(response: Response): Promise<ProblemDetails> {
  try {
    const body: unknown = await response.json();

    return isProblemDetails(body) ? body : {};
  } catch {
    return {};
  }
}

async function send(path: string, init: RequestInit, token: string | undefined): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");

  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  const language = options.getLanguage?.();

  if (language) {
    headers.set("accept-language", language);
  }

  if (init.body !== undefined) {
    headers.set("content-type", "application/json");
  }

  return fetch(path, { ...init, headers });
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let token = options.getAccessToken?.();
  let response: Response;

  try {
    response = await send(path, init, token);
  } catch {
    throw ApiError.network();
  }

  // Un 401 puede ser solo un access token vencido: se renueva una vez y se reintenta.
  if (response.status === 401 && options.renewSession) {
    token = await renewOnce();

    if (token) {
      try {
        response = await send(path, init, token);
      } catch {
        throw ApiError.network();
      }
    }
  }

  if (response.status === 401) {
    options.onSessionExpired?.();
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readProblem(response));
  }

  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, init?: RequestInit) => request<T>(path, { ...init, method: "GET" }),
  post: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, { ...init, method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, { ...init, method: "PUT", body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T>(path: string, init?: RequestInit) => request<T>(path, { ...init, method: "DELETE" }),
};
