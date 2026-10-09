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

export function AppearancePreview({ appearance, labels }: { appearance: SystemAppearance; labels: AppearancePreviewLabels }) {
  return <div style={{ ...initialAppearanceVariables, ...appearanceVariables(appearance) } as CSSProperties}>
    <Surface title={labels.title} padded>
      <div className="navigation-surface flex flex-wrap items-center gap-6 rounded-[var(--radius-control)] bg-[var(--color-nav-surface)] px-4 py-3"><span>{labels.home}</span><span>{labels.administration}</span></div>
      <div className="max-w-sm"><FormField label={labels.name}><Input value="Ana Pérez" readOnly /></FormField></div>
      <div><Button>{labels.newUser}</Button></div>
      <FilterBar><SearchInput value="" onChange={() => {}} label={labels.search} /></FilterBar>
      <Surface><DataTable columns={[{ id: "name", header: labels.name, cell: row => row.name }, { id: "role", header: labels.role, cell: row => row.role }]}
        rows={[{ id: "1", name: "Ana Pérez", role: "Admin" }, { id: "2", name: "Juan Gómez", role: "User" }, { id: "3", name: "Laura Ríos", role: "User" }, { id: "4", name: "Carla Paz", role: "User" }]} rowKey={row => row.id} /></Surface>
    </Surface>
  </div>;
}
