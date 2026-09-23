import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { PermissionGroup } from "../api/roles";
import { pickedSummary } from "../lib/permissionPicker";
import { cn } from "@/shared/lib/utils";

interface RoleSummaryProps {
  groups: readonly PermissionGroup[];
  picked: readonly string[];
  /// Quita un permiso desde su chip. Sin esto, como en Admin, que no se cambia, los chips no tienen botón.
  onRemove?: (code: string) => void;
}

/// La tarjeta "Lo que va a poder hacer" del editor de un rol: lo elegido, agrupado por área y en el orden del
/// catálogo. Con veinte áreas, casi todas cerradas en el selector, es el único lugar donde se lee de un vistazo
/// qué habilita el rol.
export function RoleSummary({ groups, picked, onRemove }: RoleSummaryProps): ReactNode {
  const { t } = useTranslation("roles");
  const id = useId();
  const summary = pickedSummary(groups, picked);

  // Cada número se pluraliza por su lado: "1 permiso en 1 área", "3 permisos en 2 áreas".
  const count =
    summary.permissions === 0
      ? t("summary.none")
      : t("summary.count", {
          permissions: t("permissionsCount", { count: summary.permissions }),
          areas: t("summary.areas", { count: summary.areas }),
        });

  // `min-h-0` y la columna flexible: si la columna de la izquierda no tiene lugar para todo (una pantalla baja),
  // la tarjeta se achica y la lista scrollea en lo que queda. La banda no se achica nunca.
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]"
    >
      {/* En 340 px, el título y "3 permisos en 2 áreas" entran justo en una línea. Con números de dos cifras ya
          no: el conteo no se parte nunca, y el que baja de renglón es el título, con la banda creciendo con él. */}
      <div className="flex min-h-10 shrink-0 items-center justify-between gap-2 border-b border-[var(--color-surface-header-border)] bg-[var(--color-surface-header)] px-4 py-2">
        <h2
          id={`${id}-title`}
          className="min-w-0 text-[11px] font-semibold tracking-[0.06em] uppercase text-[var(--color-content-heading)]"
        >
          {t("summary.title")}
        </h2>
        <span className="shrink-0 text-[12.5px] whitespace-nowrap tabular-nums text-[var(--color-content-muted)]">
          {count}
        </span>
      </div>

      {/* Con alto máximo y scroll propio: la columna de la izquierda queda adherida al scrollear, y un rol con
          muchos permisos no puede empujar el resto fuera de la pantalla. */}
      <div className="flex max-h-[330px] min-h-0 flex-col gap-3 overflow-y-auto px-4 py-3.5">
        {summary.groups.length === 0 ? (
          <p className="text-[13px] leading-normal text-[var(--color-content-muted)]">{t("summary.empty")}</p>
        ) : (
          summary.groups.map(({ group, permissions }) => (
            <div key={group.area} className="flex flex-col gap-1.5">
              <p
                id={`${id}-${group.area}`}
                className="text-xs leading-[1.2] font-semibold text-[var(--color-content-heading)]"
              >
                {group.name}
              </p>
              <ul aria-labelledby={`${id}-${group.area}`} className="flex flex-wrap gap-[5px]">
                {permissions.map((permission) => (
                  <li
                    key={permission.code}
                    className={cn(
                      "inline-flex h-7 items-center gap-[5px] rounded-full border border-[var(--color-brand-500)]/30 bg-[var(--color-brand-50)] text-[12.5px] text-[var(--color-brand-700)]",
                      onRemove ? "pr-1 pl-[9px]" : "px-[9px]",
                    )}
                  >
                    {permission.name}
                    {onRemove ? (
                      <button
                        type="button"
                        aria-label={t("summary.remove", { name: permission.name })}
                        onClick={() => onRemove(permission.code)}
                        className="inline-flex size-[18px] items-center justify-center rounded-full hover:bg-[var(--color-brand-500)]/20"
                      >
                        <span aria-hidden="true" className="text-[13px] leading-none">
                          ×
                        </span>
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
