import { cloneElement, useId, type ReactElement, type ReactNode } from "react";
import { Label } from "./label";

interface FormFieldProps {
  label: ReactNode;
  /// Id del control. Si no se pasa, se genera uno y se le enchufa al hijo.
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /// "polite": el error se anuncia como estado (role="status"), no como alerta. Para un mensaje que cambia con cada tecla,
  /// como el que cita el valor escrito, que una alerta volvería a interrumpir en cada una.
  liveError?: "polite";
  children: ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>;
}

/// Etiqueta, control y mensaje de error, atados entre sí para lectores de pantalla (sección 7.4).
export function FormField({ label, htmlFor, hint, error, required, liveError, children }: FormFieldProps): ReactNode {
  const generatedId = useId();
  const controlId = htmlFor ?? children.props.id ?? generatedId;
  const messageId = `${controlId}-message`;
  const message = error ?? hint;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={controlId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </Label>
      {cloneElement(children, {
        id: controlId,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": message ? messageId : undefined,
      })}
      {message ? (
        <p
          id={messageId}
          role={error ? (liveError === "polite" ? "status" : "alert") : undefined}
          className={error ? "text-sm text-[var(--color-danger)]" : "text-sm text-[var(--color-content-muted)]"}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
