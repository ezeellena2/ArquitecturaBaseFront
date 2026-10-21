import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(file)
      : /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.") ? [file] : [];
  });
}

function featureDependencies(fileName: string, source: string): string[] {
  const owner = path.relative(root, fileName).split(path.sep);
  const ast = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const violations: string[] = [];

  function inspect(specifier: ts.Node) {
    if (!ts.isStringLiteralLike(specifier)) return;
    const value = specifier.text;
    const target = value.startsWith("@/") ? path.resolve(root, value.slice(2))
      : value.startsWith(".") ? path.resolve(path.dirname(fileName), value) : undefined;
    if (!target) return;
    const dependency = path.relative(root, target).split(path.sep);
    if (owner[0] === "layouts") {
      if (dependency[0] === "app") violations.push(`${path.relative(root, fileName)} → ${value}`);
      return;
    }
    if (dependency[0] !== "features") return;
    if (owner[0] === "features" && owner[1] === dependency[1]) return;
    const line = ast.getLineAndCharacterOfPosition(specifier.getStart(ast)).line + 1;
    violations.push(`${path.relative(root, fileName).replaceAll("\\", "/")}:${line} → ${value}`);
  }

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) inspect(node.moduleSpecifier);
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) inspect(node.moduleSpecifier);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0]) {
      inspect(node.arguments[0]);
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) inspect(node.argument.literal);
    ts.forEachChild(node, visit);
  }

  visit(ast);
  return violations;
}

describe("feature dependency boundaries", () => {
  it.each([
    'import { Piece } from "@/features/roles/Piece";',
    'import type { Piece } from "../../roles/Piece";',
    'export { Piece } from "@/features/roles/Piece";',
    'export * from "../../roles/Piece";',
    'const piece = import("@/features/roles/Piece");',
    'type Piece = import("../../roles/Piece").Piece;',
  ])("detects an import or re-export from another feature: %s", source => {
    const violations = featureDependencies(path.join(root, "features/users/pages/Screen.tsx"), source);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("features/users/pages/Screen.tsx:1");
  });

  it("detects a shared component depending on a feature", () => {
    expect(featureDependencies(path.join(root, "shared/ui/Piece.tsx"),
      'import { Piece } from "@/features/users/Piece";')).toHaveLength(1);
  });

  it("allows the feature's own code, shared pieces and packages, ignoring comments and plain strings", () => {
    const source = `import { Local } from "../Local";
      import type { User } from "@/features/users/api/users";
      import { Button } from "@/shared/ui/button";
      import { useTranslation } from "react-i18next";
      // import { Role } from "@/features/roles/Role";
      const example = "@/features/roles/Role";`;
    expect(featureDependencies(path.join(root, "features/users/pages/Screen.tsx"), source)).toEqual([]);
  });

  it("keeps production features independent and shared code free of feature dependencies", () => {
    const violations = ["features", "shared", "layouts"].flatMap(folder => sourceFiles(path.join(root, folder)))
      .flatMap(file => featureDependencies(file, readFileSync(file, "utf8")));
    expect(violations, violations.join("\n")).toEqual([]);
  });
});

it("keeps layout imports independent of app composition", () => {
  expect(featureDependencies(path.join(root, "layouts/HomeLayout.tsx"), 'import { Shell } from "@/app/Shell";')).toHaveLength(1);
  expect(featureDependencies(path.join(root, "layouts/HomeLayout.tsx"), 'import { Context } from "./formsOverviewNavigation";')).toEqual([]);
});
