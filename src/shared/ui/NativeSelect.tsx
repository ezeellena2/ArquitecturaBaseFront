import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/utils";

// Para listas extensas que necesitan la búsqueda por teclado y el selector nativo del teléfono.
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-[30px] w-full min-w-0 rounded-md border border-input bg-[var(--color-control-surface)] px-2.5 py-1 text-base transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:bg-[var(--color-surface-muted)] disabled:opacity-50 md:text-sm dark:bg-input/30 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}
