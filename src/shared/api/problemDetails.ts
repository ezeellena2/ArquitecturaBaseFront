/// El cuerpo de error que devuelve el backend (RFC 9457, sección 6.1 del spec).
export interface ProblemDetails {
  readonly type?: string;
  readonly title?: string;
  readonly status?: number;
  readonly detail?: string;
  readonly code?: string;
  readonly traceId?: string;
  readonly errors?: Record<string, string[]>;
  /// Los errores agregan datos propios: retryAfter en los 429, attemptsLeft en un código incorrecto.
  readonly [extension: string]: unknown;
}

export function isProblemDetails(value: unknown): value is ProblemDetails {
  return typeof value === "object" && value !== null;
}
