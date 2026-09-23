import type { ComponentProps, ReactNode } from "react";
import { cn } from "cn";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "./dropdown-menu";
import { ChevronDownIcon } from "./icons";

export interface MultiSelectOption {
  value: string;
  label: string;
  /// Línea de ayuda debajo de la opción.
  description?: string;
}

interface MultiSelectProps {
  options: readonly MultiSelectOption[];
  value: readonly string[];
  onChange: (value: string[]) => void;
  /// Lo que dice el control mientras no hay nada elegido.
  placeholder: string;
  id?: string;
  "aria-invalid"?: ComponentProps<"button">["aria-invalid"];
  "aria-describedby"?: string;
}

/// Un control con la altura de un campo que, al abrirse, deja marcar varias opciones. Muestra lo elegido
/// separado por comas. Va adentro de `FormField`: el `id` que este le enchufa ata la etiqueta al botón, y así
/// "Roles" es su nombre accesible.
///
/// Elegir una opción no cierra el menú (`preventDefault` en `onSelect`): se marcan varias de una vez, y
/// cerrarlo en cada clic obligaría a reabrirlo por cada una.
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder,
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: MultiSelectProps): ReactNode {
  // En el orden de las opciones y no en el de los clics: así el texto no cambia según cómo se llegó.
  const picked = options.filter((option) => value.includes(option.value));

  function toggle(optionValue: string, checked: boolean) {
    onChange(checked ? [...value, optionValue] : value.filter((item) => item !== optionValue));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        id={id}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        className={cn(
          "flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-left text-sm shadow-xs outline-none",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          picked.length > 0 ? "text-[var(--color-content)]" : "text-[var(--color-content-muted)]",
        )}
      >
        <span className="truncate">
          {picked.length > 0 ? picked.map((option) => option.label).join(", ") : placeholder}
        </span>
        <ChevronDownIcon aria-hidden="true" className="size-3.5 shrink-0 text-[var(--color-content-muted)]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-48">
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={value.includes(option.value)}
            onCheckedChange={(checked) => toggle(option.value, checked)}
            onSelect={(event) => event.preventDefault()}
            className="items-start"
          >
            <span className="flex flex-col gap-0.5">
              <span>{option.label}</span>
              {option.description ? (
                <span className="text-xs text-[var(--color-content-muted)]">{option.description}</span>
              ) : null}
            </span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
