import type { CSSProperties } from "react";
import { appearanceVariables, initialAppearanceVariables, type SystemAppearance } from "@/shared/lib/appearance";
import { Surface } from "./Surface";
import { Button } from "./button";
import { FormField } from "./FormField";
import { Input } from "./input";
import { DataTable } from "./DataTable";
import { FilterBar } from "./FilterBar";
import { SearchInput } from "./SearchInput";

export interface AppearancePreviewLabels {
  title: string; home: string; administration: string; name: string; role: string; search: string; newUser: string;
  users: string; roles: string; export: string; filters: string; success: string; warning: string; danger: string;
}

/// ME1-A and ME3-B: the menu strip carries the logo (or the name) and marks its current item with the accent; ME4: all in the chosen
/// font. ME10: the panel, the top bar, the three buttons, the field, the filters, a table and the notices, so every group of pieces
/// shows somewhere.
export function AppearancePreview({ appearance, brand, labels }: {
  appearance: SystemAppearance; brand?: { appName: string; logoUrl: string | null }; labels: AppearancePreviewLabels;
}) {
  return <div style={{ ...initialAppearanceVariables, ...appearanceVariables(appearance), fontFamily: "var(--font-sans)" } as CSSProperties}>
    <Surface title={labels.title} padded>
      <div className="overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-border)]">
        <div className="navigation-surface flex flex-wrap items-center gap-6 bg-[var(--color-nav-surface)] px-4 py-3">
          {brand ? brand.logoUrl
            ? <img src={brand.logoUrl} alt={brand.appName} className="block h-7 w-auto max-w-40 object-contain object-left" />
            : <span className="font-semibold">{brand.appName}</span> : null}
          <span>{labels.home}</span>
          <span className="border-l-2 border-[var(--color-nav-accent)] pl-2 font-medium text-[var(--color-nav-current)]">{labels.administration}</span>
        </div>
        <div className="flex flex-col sm:flex-row">
          <div className="subnavigation-surface flex shrink-0 flex-col gap-0.5 border-b border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 text-sm sm:w-40 sm:border-r sm:border-b-0">
            <span className="rounded-[var(--radius-control)] border-l-2 border-[var(--color-brand-600)] bg-[var(--color-surface-muted)] px-2 py-1 font-medium">{labels.users}</span>
            <span className="px-2 py-1">{labels.roles}</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="topbar-surface flex min-h-9 items-center gap-1 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm">
              <span>{labels.home} /</span><strong>{labels.users}</strong>
            </div>
            <div className="flex flex-col gap-3 p-3">
              <div className="flex flex-wrap gap-2"><Button>{labels.newUser}</Button><Button variant="secondary">{labels.export}</Button><Button variant="outline">{labels.filters}</Button></div>
              <div className="max-w-sm"><FormField label={labels.name}><Input value="Ana Pérez" readOnly /></FormField></div>
              <FilterBar><SearchInput value="" onChange={() => {}} label={labels.search} /></FilterBar>
              <Surface><DataTable columns={[{ sortable: false, id: "name", header: labels.name, cell: row => row.name }, { sortable: false, id: "role", header: labels.role, cell: row => row.role }]}
                rows={[{ id: "1", name: "Ana Pérez", role: "Admin" }, { id: "2", name: "Juan Gómez", role: "User" }, { id: "3", name: "Laura Ríos", role: "User" }, { id: "4", name: "Carla Paz", role: "User" }]} rowKey={row => row.id} /></Surface>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="rounded-[var(--radius-control)] bg-[var(--color-success-50)] px-2 py-1 text-[var(--color-success-700)]">{labels.success}</span>
                <span className="rounded-[var(--radius-control)] bg-[var(--color-warning-50)] px-2 py-1 text-[var(--color-warning-700)]">{labels.warning}</span>
                <span className="rounded-[var(--radius-control)] border border-[var(--color-danger)] px-2 py-1 text-[var(--color-danger)]">{labels.danger}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Surface>
  </div>;
}
