import type { ComponentType, ReactNode } from "react";
import { AlertCircleIcon, AlertTriangleIcon, InfoIcon } from "./icons";
import { cn } from "@/shared/lib/utils";

type Tone = "info" | "warning" | "danger";

interface BannerProps {
  /// `info` (por defecto) describe una condición que sigue vigente mientras la pantalla está abierta: es un
  /// `status`, que el lector de pantalla anuncia sin interrumpir. `warning` también es un `status`: avisa una
  /// consecuencia de algo que se puede hacer igual ("es su único medio de ingreso"), no algo que haya que corregir.
  /// `danger` es un error que hay que corregir: un `alert`, como cualquier error de formulario (fundamento visual,
  /// "Avisos y estados").
  tone?: Tone;
  /// Lo que se puede hacer al respecto ("Agregar correo"). Va a la derecha, sin partirse.
  action?: ReactNode;
  children: ReactNode;
}

const tones: Record<Tone, { icon: ComponentType<{ className?: string }>; box: string; iconClass: string }> = {
  info: {
    icon: InfoIcon,
    box: "border-brand-500/30 bg-[var(--color-brand-50)]",
    iconClass: "text-[var(--color-brand-700)]",
  },
  warning: {
    icon: AlertTriangleIcon,
    box: "border-[var(--color-warning)]/45 bg-[var(--color-warning-50)]",
    iconClass: "text-[var(--color-warning-700)]",
  },
  danger: {
    icon: AlertCircleIcon,
    box: "border-danger/30 bg-danger/5",
    iconClass: "text-[var(--color-danger)]",
  },
};

/// Un aviso con su ícono, en el cuerpo de la pantalla o de un diálogo: el "banner persistente" del fundamento visual
/// y el error que no es de un campo. Lo usan el inicio (falta el correo), los diálogos del perfil (el número o el
/// correo ya son de otra cuenta) y la edición de un usuario (el número es su único medio de ingreso).
export function Banner({ tone = "info", action, children }: BannerProps) {
  const { icon: Icon, box, iconClass } = tones[tone];

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--radius-control)] border px-3.5 py-2.5",
        box,
      )}
    >
      {/* El ícono va con el primer renglón del texto, no con el centro del bloque: un texto de dos renglones no lo
          deja flotando entre los dos. */}
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <Icon className={cn("mt-0.5 size-[18px] shrink-0", iconClass)} />
        <p className="min-w-0 text-sm leading-normal text-[var(--color-content)]">{children}</p>
      </div>
      {action ? <div className="ml-auto shrink-0">{action}</div> : null}
    </div>
  );
}
