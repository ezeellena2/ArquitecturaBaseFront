import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { inspectDesign, unsavedStatusTexts } from "./designRules";

const root = path.resolve(import.meta.dirname, "../..");
function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(target) : /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.") ? [target] : [];
  });
}

describe("the application uses the shared design system", () => {
  it("keeps Sonner imports in the two shared adapters", () => {
    const consumers = sourceFiles(root).filter(file => !file.includes(`${path.sep}test${path.sep}`)).filter(file => {
      const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
      return ast.statements.some(statement => ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === "sonner");
    }).map(file => path.relative(root, file).replaceAll("\\", "/")).sort();
    expect(consumers).toEqual(["shared/ui/notifications.ts", "shared/ui/sonner.tsx"]);
  });
  // Textos fijos que el usuario aprobó conservar el 2026-11-01 porque no explican cómo funciona algo (archivo y clave).
  const keptLegends = new Set([
    "features/artificial-intelligence/pages/AiAssistantPage.tsx newHelp", // el cuerpo de una decisión dice qué se pierde
    "features/roles/pages/RoleEditorPage.tsx editor.gone.description", // un error dice por qué no está el rol
  ]);
  it("keeps feature controls, table density, typography and surfaces in shared UI", () => {
    const violations = sourceFiles(path.join(root, "features")).flatMap(file => {
      const name = path.relative(root, file).replaceAll("\\", "/");
      return inspectDesign(readFileSync(file, "utf8"))
        .filter(violation => violation.rule !== "legend" || !keptLegends.has(`${name} ${violation.key}`))
        .map(violation => `${name}:${violation.line} ${violation.rule}`);
    });
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("does not introduce feature stylesheets outside the token system", () => {
    function styles(directory: string): string[] {
      return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
        ? styles(path.join(directory, entry.name)) : /\.(css|scss|less)$/.test(entry.name) ? [entry.name] : []);
    }
    expect(styles(path.join(root, "features"))).toEqual([]);
  });

  // FORMATO ÚNICO DE NÚMEROS (2026-11-12): un número se escribe con la región de su idioma (es-AR, en-US) sólo desde
  // shared/lib/numberFormat; un Intl suelto con el idioma de la interfaz sigue la norma de España y no agrupa «1210».
  it("formats numbers only through the shared number format", () => {
    const loose = sourceFiles(root).filter(file => !file.endsWith(`shared${path.sep}lib${path.sep}numberFormat.ts`))
      .filter(file => /new Intl\.NumberFormat\(|\.toLocaleString\(/.test(readFileSync(file, "utf8")))
      .map(file => path.relative(root, file).replaceAll("\\", "/"));
    expect(loose).toEqual([]);
  });
  // The numbers of a text go through the same formatter on their own (shared/i18n): a format in a text would bypass it.
  it("leaves the numbers of the texts to the shared formatter", () => {
    const locales = path.join(root, "locales");
    const formatted = readdirSync(locales, { withFileTypes: true }).filter(entry => entry.isDirectory()).flatMap(language =>
      readdirSync(path.join(locales, language.name)).filter(name => name.endsWith(".json"))
        .filter(name => /\{\{[^}]*,[^}]*\}\}/.test(readFileSync(path.join(locales, language.name, name), "utf8"))).map(name => `${language.name}/${name}`));
    expect(formatted).toEqual([]);
  });

  it("mounts notifications once in application providers", () => {
    const mounts = sourceFiles(root).filter(file => !file.includes(`${path.sep}test${path.sep}`))
      .filter(file => /<Toaster\b/.test(readFileSync(file, "utf8")));
    expect(mounts.map(file => path.relative(root, file).replaceAll("\\", "/"))).toEqual(["app/providers.tsx"]);
  });
  // Enabled Save already says there are changes: no locale offers «Cambios sin guardar» as a status (visual-baseline.md).
  it("does not offer an unsaved-changes status in any locale", () => {
    const locales = path.join(root, "locales");
    const offered = readdirSync(locales, { withFileTypes: true }).filter(entry => entry.isDirectory()).flatMap(language =>
      readdirSync(path.join(locales, language.name)).filter(name => name.endsWith(".json")).flatMap(name =>
        unsavedStatusTexts(JSON.parse(readFileSync(path.join(locales, language.name, name), "utf8"))).map(key => `${language.name}/${name}: ${key}`)));
    expect(offered).toEqual([]);
  });
});
