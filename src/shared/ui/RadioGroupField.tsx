import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { RadioGroup } from "radix-ui";
import { cn } from "@/shared/lib/utils";
import { InfoTip } from "./InfoTip";
import { Label } from "./label";

export interface RadioOption {
  value: string;
  label: string;
  /// Un dato debajo de la etiqueta (un conteo, un correo). Una explicación de la opción no va acá sino en `help`.
  description?: string;
  /// La explicación de la opción: en la (i) al final de su texto, con su tooltip (tablero LC3). Tocarla no la elige.
  help?: string;
  disabled?: boolean;
}

interface RadioGroupFieldProps {
  /// El nombre accesible del grupo. No se dibuja: en el tablero, lo que dice de qué se trata es la casilla de arriba
  /// ("Mandarle una invitación"), y las opciones se leen solas ("Por correo", "Por WhatsApp").
  label: string;
  options: readonly RadioOption[];
  /// Undefined es "ninguna elegida".
  value: string | undefined;
  onValueChange: (value: string) => void;
  error?: string;
  variant?: "plain" | "cards";
  /// "row": pocas opciones cortas en un renglón desde el escritorio; en el celular se apilan igual.
  layout?: "column" | "row";
}

/// Una elección entre pocas opciones, una debajo de la otra, cada una con su etiqueta y su ayuda al lado: la del canal
/// de la invitación en el alta de un usuario (tablero "WhatsApp · Usuarios: alta con teléfono", punto 2). Es el Radio
/// Group de Radix, que da el rol `radiogroup`, las flechas para moverse y el foco en la elegida, con la misma fila que
/// `CheckboxField`.
export function RadioGroupField({ label, options, value, onValueChange, error, variant = "plain", layout = "column" }: RadioGroupFieldProps): ReactNode {
  const { t } = useTranslation();
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <RadioGroup.Root
        aria-label={label}
        aria-describedby={error ? errorId : undefined}
        // Radix toma `undefined` como "no controlado": la cadena vacía no coincide con ninguna opción.
        value={value ?? ""}
        onValueChange={onValueChange}
        className={cn("flex flex-col gap-1", layout === "row" && "sm:flex-row sm:flex-wrap sm:gap-x-1")}
      >
        {options.map((option) => {
          const optionId = `${id}-${option.value}`;
          const descriptionId = `${optionId}-description`;
          const helpId = `${optionId}-help`;
          const describedBy = [option.help ? helpId : undefined, option.description ? descriptionId : undefined].filter(Boolean).join(" ");

          return (
            // `relative`: dentro de un formulario, Radix pone al lado del botón un input escondido y posicionado, para
            // que el valor viaje con el formulario. Sin un ancestro posicionado cerca, se ubica contra el diálogo.
            <div key={option.value} className={cn("relative flex items-start gap-2.5 px-2.5 py-1.5", variant === "cards" && "rounded-[var(--radius-control)] border border-[var(--color-border)] py-2.5 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-[var(--color-surface-muted)]")}>
              <RadioGroup.Item
                id={optionId}
                value={option.value}
                disabled={option.disabled}
                aria-describedby={describedBy || undefined}
                className={cn(
                  "mt-px inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-[var(--color-content-muted)] bg-[var(--color-surface)] outline-none",
                  "focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=checked]:border-primary",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <RadioGroup.Indicator className="size-2 rounded-full bg-primary" />
              </RadioGroup.Item>
              <div className="flex flex-col gap-0.5">
                {option.help ? (
                  <span className="flex items-center gap-1">
                    <Label htmlFor={optionId} className={cn("text-[0.84375rem] leading-[1.2]", option.disabled ? "text-[var(--color-content-muted)]" : "cursor-pointer")}>
                      {option.label}
                    </Label>
                    <span className="-my-1 inline-flex"><InfoTip id={helpId} text={option.help} label={t("actions.moreInfo", { label: option.label })} /></span>
                  </span>
                ) : (
                  <Label
                    htmlFor={optionId}
                    className={cn(
                      "text-[0.84375rem] leading-[1.2]",
                      option.disabled ? "text-[var(--color-content-muted)]" : "cursor-pointer",
                    )}
                  >
                    {option.label}
                  </Label>
                )}
                {option.description ? (
                  <p id={descriptionId} className="text-[0.78125rem] leading-[1.4] text-[var(--color-content-muted)]">
                    {option.description}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </RadioGroup.Root>
      {error ? (
        <p id={errorId} role="alert" className="px-2.5 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
