import type { ApiError } from "./ApiError";

type SetError = (field: string, error: { type: string; message: string }) => void;

/// Lleva los errores por campo del backend al formulario. Devuelve false si el error no era de validación,
/// para que la pantalla lo muestre de otra forma.
export function applyApiErrorToForm(error: ApiError, setError: SetError): boolean {
  const errors = error.errors;

  if (!errors) {
    return false;
  }

  for (const [field, messages] of Object.entries(errors)) {
    const message = messages[0];

    if (message) {
      setError(field, { type: "server", message });
    }
  }

  return true;
}
