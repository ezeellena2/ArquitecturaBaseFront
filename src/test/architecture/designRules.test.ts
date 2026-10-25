import { describe, expect, it } from "vitest";
import { inspectDesign, unsavedStatusTexts } from "./designRules";

describe("design boundaries", () => {
  it.each(["button", "input", "select", "textarea", "table", "thead", "tbody", "tr", "th", "td"])("requires shared UI instead of a native %s", (tag) => {
    expect(inspectDesign(`const Screen = () => <${tag} />;`)).toContainEqual({ line: 1, rule: "shared-control" });
  });

  it.each(["text-[13.5px]", "rounded-[10px]", "bg-[#abc123]", "text-blue-600"])("rejects a feature-owned visual value: %s", (value) => {
    expect(inspectDesign(`const style = '${value}';`)).toContainEqual({ line: 1, rule: "design-token" });
  });

  it("finds a button appearance override through its import alias and class constant", () => {
    const source = `import { Button as Action } from '@/shared/ui/button';
      const appearance = 'h-12 text-lg';
      const Screen = () => <Action className={appearance}>Guardar</Action>;`;
    expect(inspectDesign(source)).toContainEqual({ line: 3, rule: "component-variant" });
  });

  it("rejects visual styles passed inline", () => {
    expect(inspectDesign('const Screen = () => <div style={{ color: "green" }} />;')).toContainEqual({ line: 1, rule: "inline-style" });
  });

  it("keeps field colors and typography in the library while allowing layout", () => {
    expect(inspectDesign(`import { Input as Field } from '@/shared/ui/input';
      const Screen = () => <Field className="w-full bg-white text-lg" />;`)).toContainEqual({ line: 2, rule: "component-variant" });
    expect(inspectDesign(`import { Input } from '@/shared/ui/input';
      const Screen = () => <Input className="w-full pl-8" />;`)).toEqual([]);
  });

  it("keeps table typography and row density in the library", () => {
    expect(inspectDesign(`import { TableHead, TableRow } from '@/shared/ui/table';
      const Screen = () => <><TableHead className="text-xs" /><TableRow className="h-16" /></>;`)).toEqual([
      { line: 2, rule: "component-variant" }, { line: 2, rule: "component-variant" },
    ]);
  });

  it("requires the common surface around a listing", () => {
    expect(inspectDesign(`import { DataTable } from '@/shared/ui/DataTable';
      const Screen = () => <div><DataTable /></div>;`)).toContainEqual({ line: 2, rule: "table-surface" });
  });

  it("allows token colors, layout, library variants and semantics", () => {
    expect(inspectDesign(`import { Button } from '@/shared/ui/button';
      import { DataTable } from '@/shared/ui/DataTable';
      import { Surface } from '@/shared/ui/Surface';
      const Screen = () => <Surface><p className="text-sm text-[var(--color-content-muted)]">Datos</p>
        <Button size="sm" variant="outline" className="w-full mt-2" /><DataTable /></Surface>;`)).toEqual([]);
  });

  it("does not inspect comments as controls or colors", () => {
    expect(inspectDesign('// Example: <input /> bg-[#abc123]\nconst name = "Ana";')).toEqual([]);
  });

  it.each(["Checkbox", "Switch", "SelectContent", "DialogContent", "DialogHeader", "DialogFooter", "DialogTitle", "DialogDescription", "DialogOverlay", "TooltipContent"])("keeps the appearance of %s in shared UI", component => {
    expect(inspectDesign(`import { ${component} as Piece } from '@/shared/ui/piece';
      const Screen = () => <Piece className="bg-white rounded-xl text-lg" />;`)).toContainEqual({ line: 2, rule: "component-variant" });
  });

  it("allows dialog sizing, scrolling and content layout without changing its appearance", () => {
    expect(inspectDesign(`import { DialogContent, DialogHeader } from '@/shared/ui/dialog';
      const Screen = () => <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="px-4 pr-12" />
      </DialogContent>;`)).toEqual([]);
  });

  it("requires a shared dialog instead of a native modal", () => {
    expect(inspectDesign('const Screen = () => <dialog open />;')).toContainEqual({ line: 1, rule: "shared-control" });
  });

  it("requires a keyboard-accessible shared tooltip instead of a native title", () => {
    expect(inspectDesign('const Screen = () => <span title="Correo completo">Correo…</span>;')).toContainEqual({ line: 1, rule: "shared-tooltip" });
    expect(inspectDesign(`import { Page } from '@/shared/ui/Page';
      const Screen = () => <Page title="Usuarios" />;`)).toEqual([]);
  });

  it("keeps icons behind the shared library rather than defining a feature-owned set", () => {
    expect(inspectDesign(`import { Mail } from 'lucide-react';
      const Screen = () => <Mail />;`)).toContainEqual({ line: 1, rule: "shared-icon" });
    expect(inspectDesign('const Screen = () => <svg><path d="M0 0" /></svg>;')).toContainEqual({ line: 1, rule: "shared-icon" });
    expect(inspectDesign(`import { MailIcon } from '@/shared/ui/icons';
      const Screen = () => <MailIcon className="size-4" />;`)).toEqual([]);
  });
  it("finds a locale text that only offers an unsaved-changes status", () => {
    expect(unsavedStatusTexts({ dirty: "Cambios sin guardar", page: { status: " · Unsaved changes" } })).toEqual(["dirty", "page.status"]);
    expect(unsavedStatusTexts({ unsaved: "Nuevo, sin guardar", discardDescription: "Vas a perder lo que cambiaste sin guardar.", unsavedChanges: { title: "¿Descartar los cambios?" }, saving: "Guardando…" })).toEqual([]);
  });
});
