import type { ComponentProps } from "react";
import { ActionTooltip } from "./ActionTooltip";
import { Badge } from "./badge";
import { CheckIcon } from "./icons";
import { cn } from "@/shared/lib/utils";

interface VerificationBadgeProps extends Omit<ComponentProps<"span">, "children"> {
  /// Si la persona ya demostró que el correo o el número es suyo, entrando con él.
  verified: boolean;
  /// "Verificado" o "Sin verificar": el texto lo pone quien la usa, con su namespace.
  children: string;
  /// Por qué está así («Lo cargó un administrador…»): en el tooltip de la insignia, al pasar el mouse o al llegar con el
  /// teclado, y como texto para el lector de pantalla. Nunca una nota debajo de la fila.
  hint?: string;
}

/// La insignia de un estado de la cuenta: "Verificado", en verde y con el tilde, o "Sin verificar", en ámbar. La usan
/// el perfil (tablero PF1-A: los medios de ingreso y el chat de WhatsApp, «Vinculado» o «Sin vincular») y la
/// administración de usuarios (tablero "WhatsApp · Usuarios: alta con teléfono"), que muestra también lo que un admin
/// cargó y la persona todavía no usó.
///
/// La palabra va siempre: el color solo no dice nada a quien no lo distingue.
export function VerificationBadge({ verified, children, hint, className, ...props }: VerificationBadgeProps) {
  const badge = (
    <Badge
      {...props}
      className={cn(
        "text-[0.71875rem]",
        verified
          ? "gap-1 bg-[var(--color-success-50)] text-[var(--color-success-700)]"
          : "border-[var(--color-warning)]/45 bg-[var(--color-warning-50)] text-[var(--color-warning-700)]",
        className,
      )}
    >
      {verified ? <CheckIcon /> : null}
      {children}
    </Badge>
  );

  if (hint === undefined) {
    return badge;
  }

  // El lector de pantalla, en modo exploración, no lee la descripción de algo que no recibe foco: el porqué va también
  // como texto del disparador.
  return (
    <ActionTooltip label={hint}>
      <span
        tabIndex={0}
        className="inline-flex shrink-0 rounded-[var(--radius-control)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-500)]"
      >
        {badge}
        <span className="sr-only">{hint}</span>
      </span>
    </ActionTooltip>
  );
}
