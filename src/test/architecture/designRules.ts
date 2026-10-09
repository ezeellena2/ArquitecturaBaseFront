export interface DesignViolation {
  line: number;
  rule: string;
}

// Se inspecciona sintaxis, no texto crudo: ejemplos en comentarios no son código.
export function inspectDesign(source: string): DesignViolation[] {
  const file = ts.createSourceFile("screen.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const violations: DesignViolation[] = [];
  const controls = new Set(["button", "input", "select", "textarea", "dialog", "table", "thead", "tbody", "tfoot", "tr", "th", "td"]);
  const imports = new Map<string, string>();
  const constants = new Map<string, ts.Expression>();
  const add = (node: ts.Node, rule: string) => violations.push({ line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1, rule });

  for (const statement of file.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === "lucide-react") add(statement, "shared-icon");
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text.startsWith("@/shared/ui/")) {
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const binding of bindings.elements) imports.set(binding.name.text, binding.propertyName?.text ?? binding.name.text);
      }
    }
  }
  function index(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) constants.set(node.name.text, node.initializer);
    ts.forEachChild(node, index);
  }
  index(file);

  function strings(node: ts.Node, seen = new Set<string>()): string[] {
    if (ts.isStringLiteralLike(node)) return [node.text];
    if (ts.isIdentifier(node) && constants.has(node.text) && !seen.has(node.text)) {
      return strings(constants.get(node.text)!, new Set([...seen, node.text]));
    }
    const values: string[] = [];
    ts.forEachChild(node, child => { values.push(...strings(child, seen)); });
    return values;
  }

  function visit(node: ts.Node) {
    if (ts.isStringLiteralLike(node)) {
      if (/(?:text|rounded)-\[\d|#[\da-f]{6}\b|#[\da-f]{3}\b|(?:rgb|hsl)a?\(|(?:bg|text|border|fill|stroke)-(?:red|blue|green|emerald|gray|slate|zinc|stone|neutral|amber|yellow|orange|violet|purple|pink|rose|teal|cyan|lime|indigo|sky|fuchsia)-\d/i.test(node.text)) add(node, "design-token");
      if (node.text.includes("rounded-[var(--radius-card)]") && /\bborder\b/.test(node.text)) add(node, "shared-surface");
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = node.tagName.getText(file);
      const component = imports.get(name);
      if (controls.has(name)) add(node, "shared-control");
      if (name === "svg") add(node, "shared-icon");
      for (const attribute of node.attributes.properties) {
        if (!ts.isJsxAttribute(attribute)) continue;
        const attributeName = attribute.name.getText(file);
        if (attributeName === "style") add(attribute, "inline-style");
        if (attributeName === "title" && (/^[a-z]/.test(name) || component === "Button" || component === "IconButton")) add(attribute, "shared-tooltip");
        if (attributeName !== "className" || !attribute.initializer) continue;
        const values = strings(attribute.initializer).join(" ");
        const appearance = /(?:^|\s|:)(?:!?)(?:h-|min-h-|max-h-|size-|rounded|bg-|border|shadow|font-|leading-|tracking-|text-(?!left\b|right\b|center\b|start\b|end\b)|p[xytrbl]?-)/;
        const density = /(?:^|\s|:)(?:!?)(?:h-|min-h-|max-h-|text-(?!left\b|right\b|center\b)|font-|leading-|tracking-)/;
        const fieldAppearance = /(?:^|\s|:)(?:!?)(?:h-|size-|rounded|bg-|border|shadow|font-|leading-|tracking-|text-(?!left\b|right\b|center\b))/;
        if ((["Button", "IconButton", "TableHead", "TableHeader"].includes(component ?? "") && appearance.test(values)) || (component === "TableRow" && density.test(values))) add(node, "component-variant");
        if (["Input", "Textarea", "NativeSelect", "SelectTrigger"].includes(component ?? "") && fieldAppearance.test(values)) add(node, "component-variant");
        const surfaceAppearance = /(?:^|\s|:)(?:!?)(?:rounded|bg-|border|shadow|font-|leading-|tracking-|text-(?!left\b|right\b|center\b|start\b|end\b))/;
        if (["Checkbox", "Switch"].includes(component ?? "") && fieldAppearance.test(values)) add(node, "component-variant");
        if (["SelectContent", "DialogContent", "DialogHeader", "DialogFooter", "DialogTitle", "DialogDescription", "DialogOverlay", "TooltipContent"].includes(component ?? "") && surfaceAppearance.test(values)) add(node, "component-variant");
      }
      if (component === "DataTable") {
        let ancestor: ts.Node | undefined = node.parent;
        while (ancestor && !(ts.isJsxElement(ancestor) && imports.get(ancestor.openingElement.tagName.getText(file)) === "Surface")) ancestor = ancestor.parent;
        if (!ancestor) add(node, "table-surface");
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return violations;
}
import ts from "typescript";
