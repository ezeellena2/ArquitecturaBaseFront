import type { ProblemDetails } from "./problemDetails";

/// Error de una llamada al backend, ya traducido por el servidor al idioma de la petición.
export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails;
  readonly isNetworkError: boolean;

  constructor(status: number, problem: ProblemDetails, isNetworkError = false) {
    super(problem.detail ?? problem.title ?? `HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
    this.isNetworkError = isNetworkError;
  }

  /// Código estable del backend (Area.Entidad.Motivo). El front decide por este, nunca por el texto.
  get code(): string | undefined {
    return this.problem.code;
  }

  get detail(): string | undefined {
    return this.problem.detail;
  }

  get traceId(): string | undefined {
    return this.problem.traceId;
  }

  /// Errores por campo de una validación, en camelCase, listos para setError de react-hook-form.
  get errors(): Record<string, string[]> | undefined {
    return this.problem.errors;
  }

  /// Segundos a esperar que informan los 429.
  get retryAfterSeconds(): number | undefined {
    return typeof this.problem.retryAfter === "number" ? this.problem.retryAfter : undefined;
  }

  static network(): ApiError {
    return new ApiError(0, { code: "Network.Unavailable" }, true);
  }
}
