import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { parseSort, sortValue, startsDescending, type SortKind } from "@/shared/lib/sort";
import { Button } from "./button";
import type { Column } from "./DataTable";
import { Dialog, DialogContent, DialogTitle } from "./dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { CheckIcon, ChevronDownIcon, SortIcon } from "./icons";

interface SortOption {
  id: string;
  label: string;
  kind: SortKind;
}

interface PhoneOption {
  key: string;
  label: string;
  checked: boolean;
  onSelect: () => void;
}

/// Un grupo de la lista a pantalla completa del celular: su título y un renglón de 44 px por opción, con la tilde a la
/// izquierda en la elegida.
function PhoneGroup({ id, title, options }: { id: string; title: string; options: readonly PhoneOption[] }) {
  return (
    <div role="radiogroup" aria-labelledby={id}>
      <p id={id} className="px-4 pt-4 pb-1 text-[length:var(--text-caption)] font-semibold tracking-[0.06em] uppercase text-[var(--color-content-muted)]">{title}</p>
      {options.map(option => (
        <button key={option.key} type="button" role="radio" aria-checked={option.checked} onClick={option.onSelect}
          className="flex min-h-11 w-full items-center gap-3 border-b border-[var(--color-border)]/50 px-4 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-brand-600)]">
          <span className="flex size-4 shrink-0 items-center justify-center">{option.checked ? <CheckIcon className="size-4" /> : null}</span>
          <span className="min-w-0 flex-1">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

/// «Ordenar por» (OT1-C, 2026-11-22): va último en la barra de filtros, separado de ellos porque no saca filas. Dice el
/// orden con palabras («Recibida, más reciente primero») y abre una lista con la columna (las que ordenan, en el orden de
/// la tabla) y los dos sentidos, nombrados según el dato. Cada elección se aplica enseguida y la lista queda abierta hasta
/// tocar afuera o Escape; elegir otra columna la ordena en su sentido útil. Mueve el mismo `sort` que el encabezado.
/// Sin orden elegido y con un orden de siempre compuesto, dice «Ordenar por». En el celular ocupa el ancho y su lista se
/// abre a pantalla completa, con la × para cerrar.
///
/// Arma la lista con las piezas de menú de «Columnas»; cuando llegue la pieza única para elegir (DS1-A), pasa a ella.
export function SortMenu<TRow>({ columns, sort, onSortChange }: {
  /// Las columnas visibles de la tabla: la lista ofrece las que ordenan.
  columns: readonly Column<TRow>[];
  /// El orden que se ve: el de la dirección o, sin uno elegido, el de siempre si es una columna.
  sort?: string;
  /// Recibe el orden elegido, "campo" o "-campo" (`usePagination.setSort`).
  onSortChange: (sort: string) => void;
}) {
  const { t } = useTranslation();
  const phone = useMediaQuery("(width < 640px)");
  const [open, setOpen] = useState(false);
  // En el celular el botón sólo abre la lista: al cerrarla, el foco vuelve al botón.
  const restore = useRestoreFocusOnClose(open && phone);
  const columnTitle = useId();
  const orderTitle = useId();
  const options: SortOption[] = columns.flatMap(column => column.sortable ? [{ id: column.id, label: column.header, kind: column.sortKind }] : []);
  const parsed = parseSort(sort);
  const current = parsed ? options.find(option => option.id === parsed.field) : undefined;
  const descending = !!parsed?.descending;
  const direction = (desc: boolean) => desc ? "desc" : "asc";
  const label = current ? t("sort.button", { column: current.label, order: t(`sort.${current.kind}.${direction(descending)}Short`) }) : t("sort.label");
  // Los dos sentidos, primero el útil.
  const directions = current ? [startsDescending(current.kind), !startsDescending(current.kind)] : [];
  const pickColumn = (option: SortOption) => {
    if (option.id !== current?.id) onSortChange(sortValue(option.id, startsDescending(option.kind)));
  };
  const pickDirection = (desc: boolean) => {
    if (current && desc !== descending) onSortChange(sortValue(current.id, desc));
  };
  const trigger = (
    <Button type="button" variant="outline" aria-label={current ? t("sort.current", { order: label }) : undefined}
      onClick={phone ? () => setOpen(true) : undefined} className="max-sm:w-full sm:ml-auto">
      <SortIcon className="size-4" />
      <span className="min-w-0 truncate max-sm:flex-1 max-sm:text-left">{label}</span>
      <ChevronDownIcon className="size-3.5" />
    </Button>
  );

  if (phone) {
    return (
      <>
        {trigger}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent mobileFullscreen aria-describedby={undefined} onCloseAutoFocus={restore} className="gap-0 p-0">
            <div className="flex h-14 shrink-0 items-center border-b border-[var(--color-border)] px-4"><DialogTitle>{t("sort.label")}</DialogTitle></div>
            <div className="min-h-0 flex-1 overflow-y-auto pb-4">
              <PhoneGroup id={columnTitle} title={t("sort.column")} options={options.map(option => ({
                key: option.id, label: option.label, checked: option.id === current?.id, onSelect: () => pickColumn(option) }))} />
              {current ? <PhoneGroup id={orderTitle} title={t("sort.order")} options={directions.map(desc => ({
                key: direction(desc), label: t(`sort.${current.kind}.${direction(desc)}`), checked: desc === descending, onSelect: () => pickDirection(desc) }))} /> : null}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel id={columnTitle}>{t("sort.column")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={current?.id ?? ""} aria-labelledby={columnTitle}>
          {options.map(option => (
            <DropdownMenuRadioItem key={option.id} value={option.id} onSelect={event => { event.preventDefault(); pickColumn(option); }}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {current ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel id={orderTitle}>{t("sort.order")}</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={direction(descending)} aria-labelledby={orderTitle}>
              {directions.map(desc => (
                <DropdownMenuRadioItem key={direction(desc)} value={direction(desc)} onSelect={event => { event.preventDefault(); pickDirection(desc); }}>
                  {t(`sort.${current.kind}.${direction(desc)}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
