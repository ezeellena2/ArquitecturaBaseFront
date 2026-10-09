import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { inspectDesign } from "./designRules";

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
  it("keeps feature controls, table density, typography and surfaces in shared UI", () => {
    const violations = sourceFiles(path.join(root, "features")).flatMap(file =>
      inspectDesign(readFileSync(file, "utf8")).map(violation => `${path.relative(root, file)}:${violation.line} ${violation.rule}`),
    );
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("does not introduce feature stylesheets outside the token system", () => {
    function styles(directory: string): string[] {
      return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
        ? styles(path.join(directory, entry.name)) : /\.(css|scss|less)$/.test(entry.name) ? [entry.name] : []);
    }
    expect(styles(path.join(root, "features"))).toEqual([]);
  });

  it("mounts notifications once in application providers", () => {
    const mounts = sourceFiles(root).filter(file => !file.includes(`${path.sep}test${path.sep}`))
      .filter(file => /<Toaster\b/.test(readFileSync(file, "utf8")));
    expect(mounts.map(file => path.relative(root, file).replaceAll("\\", "/"))).toEqual(["app/providers.tsx"]);
  });
});
