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
}

/// ME1-A and ME3-B: the menu strip carries the logo (or the name) and marks its current item with the accent; ME4: all in the chosen font.
export function AppearancePreview({ appearance, brand, labels }: {
  appearance: SystemAppearance; brand?: { appName: string; logoUrl: string | null }; labels: AppearancePreviewLabels;
}) {
  return <div style={{ ...initialAppearanceVariables, ...appearanceVariables(appearance), fontFamily: "var(--font-sans)" } as CSSProperties}>
    <Surface title={labels.title} padded>
      <div className="navigation-surface flex flex-wrap items-center gap-6 rounded-[var(--radius-control)] bg-[var(--color-nav-surface)] px-4 py-3">
        {brand ? brand.logoUrl
          ? <img src={brand.logoUrl} alt={brand.appName} className="block h-7 w-auto max-w-40 object-contain object-left" />
          : <span className="font-semibold">{brand.appName}</span> : null}
        <span>{labels.home}</span>
        <span className="border-l-2 border-[var(--color-nav-accent)] pl-2 font-medium text-[var(--color-nav-current)]">{labels.administration}</span>
      </div>
      <div className="max-w-sm"><FormField label={labels.name}><Input value="Ana Pérez" readOnly /></FormField></div>
      <div><Button>{labels.newUser}</Button></div>
      <FilterBar><SearchInput value="" onChange={() => {}} label={labels.search} /></FilterBar>
      <Surface><DataTable columns={[{ sortable: false, id: "name", header: labels.name, cell: row => row.name }, { sortable: false, id: "role", header: labels.role, cell: row => row.role }]}
        rows={[{ id: "1", name: "Ana Pérez", role: "Admin" }, { id: "2", name: "Juan Gómez", role: "User" }, { id: "3", name: "Laura Ríos", role: "User" }, { id: "4", name: "Carla Paz", role: "User" }]} rowKey={row => row.id} /></Surface>
    </Surface>
  </div>;
}
