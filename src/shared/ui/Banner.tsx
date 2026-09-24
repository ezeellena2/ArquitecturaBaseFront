import type { ReactNode } from "react";
import { AlertCircleIcon, InfoIcon } from "./icons";
import { cn } from "@/shared/lib/utils";

interface BannerProps {
  /// `info` (por defecto) describe una condición que sigue vigente mientras la pantalla está abierta: es un
  /// `status`, que el lector de pantalla anuncia sin interrumpir. `danger` es un error que hay que corregir: un
  /// `alert`, como cualquier error de formulario (fundamento visual, "Avisos y estados").
  tone?: "info" | "danger";
  /// Lo que se puede hacer al respecto ("Agregar correo"). Va a la derecha, sin partirse.
  action?: ReactNode;
  children: ReactNode;
}

/// Un aviso con su ícono, en el cuerpo de la pantalla o de un diálogo: el "banner persistente" del fundamento visual
/// y el error que no es de un campo. Lo usan el inicio (falta el correo) y los diálogos del perfil (el número o el
/// correo ya son de otra cuenta).
export function Banner({ tone = "info", action, children }: BannerProps) {
  const Icon = tone === "danger" ? AlertCircleIcon : InfoIcon;

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--radius-control)] border px-3.5 py-2.5",
        tone === "danger"
          ? "border-danger/30 bg-danger/5"
          : "border-brand-500/30 bg-[var(--color-brand-50)]",
      )}
    >
      {/* El ícono va con el primer renglón del texto, no con el centro del bloque: un texto de dos renglones no lo
          deja flotando entre los dos. */}
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <Icon
          className={cn(
            "mt-0.5 size-[18px] shrink-0",
            tone === "danger" ? "text-[var(--color-danger)]" : "text-[var(--color-brand-700)]",
          )}
        />
        <p className="min-w-0 text-sm leading-normal text-[var(--color-content)]">{children}</p>
      </div>
      {action ? <div className="ml-auto shrink-0">{action}</div> : null}
    </div>
  );
}
