import { useId, type ReactNode, type Ref } from "react";

interface ProfileSectionProps {
  title: string;
  /// Hace al título enfocable desde el código (`tabIndex={-1}`, fuera del orden del Tab), para recibir el foco cuando
  /// se va el control que lo tenía, como en la tarjeta del resumen del rol (`RoleSummary`).
  titleRef?: Ref<HTMLHeadingElement>;
  children: ReactNode;
}

/// Una superficie de `/perfil` con su banda de encabezado (tablero "WhatsApp · Perfil: correo y WhatsApp"): la de los
/// medios de ingreso y la de los datos del perfil. Es la misma banda que abre la tarjeta de datos del rol
/// (`RoleEditorPage`): el tono de `--color-surface-header` y el rótulo en versalitas.
///
/// Es una `section` nombrada por su título, así un lector de pantalla la lista entre las regiones de la página.
export function ProfileSection({ title, titleRef, children }: ProfileSectionProps) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]"
    >
      <div className="flex h-10 shrink-0 items-center border-b border-[var(--color-surface-header-border)] bg-[var(--color-surface-header)] px-4">
        <h2
          ref={titleRef}
          id={titleId}
          tabIndex={titleRef ? -1 : undefined}
          className="text-[11px] font-semibold tracking-[0.06em] uppercase text-[var(--color-content-heading)] outline-none"
        >
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}
