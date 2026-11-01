import { cloneElement, useId, type ReactElement, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { InfoTip } from "./InfoTip";
import { Label } from "./label";

interface FormFieldProps {
  label: ReactNode;
  /// Id del control. Si no se pasa, se genera uno y se le enchufa al hijo.
  htmlFor?: string;
  /// Un dato debajo del control, que el error reemplaza: el texto original en el otro idioma o un valor. Una
  /// explicación de cómo funciona no va acá sino en `help`.
  hint?: string;
  /// La explicación que sirve pero no hace falta leer siempre: va en la (i) junto a la etiqueta, con su tooltip, y
  /// es parte de la descripción accesible del control (decisión del usuario, 2026-10-31; tablero LC3).
  help?: string;
  /// El nombre de la (i) cuando la etiqueta no es un texto.
  helpLabel?: string;
  error?: string;
  required?: boolean;
  /// "polite": el error se anuncia como estado (role="status"), no como alerta. Para un mensaje que cambia con cada tecla,
  /// como el que cita el valor escrito, que una alerta volvería a interrumpir en cada una.
  liveError?: "polite";
  children: ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>;
}

/// Etiqueta, control y mensaje de error, atados entre sí para lectores de pantalla (sección 7.4).
export function FormField({ label, htmlFor, hint, help, helpLabel, error, required, liveError, children }: FormFieldProps): ReactNode {
  const { t } = useTranslation();
  const generatedId = useId();
  const controlId = htmlFor ?? children.props.id ?? generatedId;
  const messageId = `${controlId}-message`;
  const helpId = `${controlId}-help`;
  const message = error ?? hint;
  const describedBy = [help ? helpId : undefined, message ? messageId : undefined].filter(Boolean).join(" ");

  const labelNode = (
    <Label htmlFor={controlId}>
      {label}
      {required ? <span aria-hidden="true"> *</span> : null}
    </Label>
  );

  return (
    <div className="flex flex-col gap-1.5">
      {help ? (
        <div className="flex items-center gap-1">
          {labelNode}
          {/* La (i) no agranda el renglón de la etiqueta. */}
          <span className="-my-1 inline-flex">
            <InfoTip id={helpId} text={help} label={helpLabel ?? (typeof label === "string" ? t("actions.moreInfo", { label }) : t("actions.moreInfoPlain"))} />
          </span>
        </div>
      ) : labelNode}
      {cloneElement(children, {
        id: controlId,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy || undefined,
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
