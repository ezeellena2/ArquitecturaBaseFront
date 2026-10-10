import { useId, type ReactNode, type Ref } from "react";

interface SurfaceProps {
  title?: string;
  titleRef?: Ref<HTMLHeadingElement>;
  headingLevel?: 2 | 3;
  padded?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}

// La caja y su banda se definen acá: las features solo deciden el contenido.
// Una banda crece con el texto; un título largo no queda recortado en móvil.
export function Surface({ title, titleRef, headingLevel = 2, padded = false, actions, children }: SurfaceProps) {
  const id = useId();
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <section aria-labelledby={title ? id : undefined} data-slot="surface" className="flex min-w-0 shrink-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]">
      {title ? (
        <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-b border-[var(--color-surface-header-border)] bg-[var(--color-surface-header)] px-4 py-2">
          <Heading id={id} ref={titleRef} tabIndex={titleRef ? -1 : undefined} className="text-[length:var(--text-caption)] font-semibold tracking-[0.06em] uppercase text-[var(--color-surface-header-foreground)] outline-none">{title}</Heading>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {padded ? <div className="flex flex-col gap-4 p-4">{children}</div> : children}
    </section>
  );
}
