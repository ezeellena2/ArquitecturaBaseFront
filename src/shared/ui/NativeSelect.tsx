import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/utils";

// Para listas extensas que necesitan la búsqueda por teclado y el selector nativo del teléfono. `size="touch"` mide 44 px, como el
// botón del mismo nombre: quien la usa la pide en el celular.
export function NativeSelect({ className, size = "default", ...props }: Omit<ComponentProps<"select">, "size"> & { size?: "default" | "touch" }) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        props.multiple ? "h-auto" : size === "touch" ? "h-11" : "h-[var(--height-control)]",
        "w-full min-w-0 rounded-md border border-input bg-[var(--color-control-surface)] px-2.5 py-1 text-sm transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:bg-[var(--color-surface-muted)] disabled:opacity-50 dark:bg-input/30 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}
