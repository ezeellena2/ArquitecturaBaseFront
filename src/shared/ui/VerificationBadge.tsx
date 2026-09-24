import type { ComponentProps } from "react";
import { Badge } from "./badge";
import { CheckIcon } from "./icons";
import { cn } from "@/shared/lib/utils";

interface VerificationBadgeProps extends Omit<ComponentProps<"span">, "children"> {
  /// Si la persona ya demostró que el correo o el número es suyo, entrando con él.
  verified: boolean;
  /// "Verificado" o "Sin verificar": el texto lo pone quien la usa, con su namespace.
  children: string;
}

/// La insignia de un correo o un número: "Verificado", en verde y con el tilde, o "Sin verificar", en ámbar. La usan
/// el perfil (tablero "WhatsApp · Perfil: correo y WhatsApp") y la administración de usuarios (tablero "WhatsApp ·
/// Usuarios: alta con teléfono"), que muestra también lo que un admin cargó y la persona todavía no usó.
///
/// La palabra va siempre: el color solo no dice nada a quien no lo distingue.
export function VerificationBadge({ verified, children, className, ...props }: VerificationBadgeProps) {
  return (
    <Badge
      {...props}
      className={cn(
        "text-[11.5px]",
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
}
