import { useId, type ReactNode } from "react";
import { RadioGroup } from "radix-ui";
import { cn } from "@/shared/lib/utils";
import { Label } from "./label";

export interface RadioOption {
  value: string;
  label: string;
  /// Línea de ayuda debajo de la etiqueta. En una opción apagada, es el porqué ("Cargá un correo para usar esta
  /// opción"): un botón de opción apagado no recibe foco, así que la razón tiene que estar a la vista.
  description?: string;
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
}

/// Una elección entre pocas opciones, una debajo de la otra, cada una con su etiqueta y su ayuda al lado: la del canal
/// de la invitación en el alta de un usuario (tablero "WhatsApp · Usuarios: alta con teléfono", punto 2). Es el Radio
/// Group de Radix, que da el rol `radiogroup`, las flechas para moverse y el foco en la elegida, con la misma fila que
/// `CheckboxField`.
export function RadioGroupField({ label, options, value, onValueChange, error }: RadioGroupFieldProps): ReactNode {
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
        className="flex flex-col gap-1"
      >
        {options.map((option) => {
          const optionId = `${id}-${option.value}`;
          const descriptionId = `${optionId}-description`;

          return (
            // `relative`: dentro de un formulario, Radix pone al lado del botón un input escondido y posicionado, para
            // que el valor viaje con el formulario. Sin un ancestro posicionado cerca, se ubica contra el diálogo.
            <div key={option.value} className="relative flex items-start gap-2.5 px-2.5 py-1.5">
              <RadioGroup.Item
                id={optionId}
                value={option.value}
                disabled={option.disabled}
                aria-describedby={option.description ? descriptionId : undefined}
                className={cn(
                  "mt-px inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-[var(--color-content-muted)] bg-[var(--color-surface)] outline-none",
                  "focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=checked]:border-primary",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <RadioGroup.Indicator className="size-2 rounded-full bg-primary" />
              </RadioGroup.Item>
              <div className="flex flex-col gap-0.5">
                <Label
                  htmlFor={optionId}
                  className={cn(
                    "text-[13.5px] leading-[1.2]",
                    option.disabled ? "text-[var(--color-content-muted)]" : "cursor-pointer",
                  )}
                >
                  {option.label}
                </Label>
                {option.description ? (
                  <p id={descriptionId} className="text-[12.5px] leading-[1.4] text-[var(--color-content-muted)]">
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
