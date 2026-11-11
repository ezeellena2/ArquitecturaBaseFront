import type { FormStandard } from "@/features/business-forms/api/library";
// Synthetic UI examples for «Biblioteca» (BI1-A); the real contract comes from forms-http/library.
export function createLibraryVisualFixtures(culture: "es" | "en") {
  const standards: FormStandard[] = culture === "es"
    ? [{ key: "arca.invoice", version: 1, name: "Factura", description: "Factura C con sus ítems, el total y los datos del cliente.", prefix: "FAC", copies: 1, culture: "es", source: "ARCA", suggestedPrefix: "FAC2" },
      { key: "arca.credit-note", version: 1, name: "Nota de crédito", description: "Anula total o parcialmente una factura emitida.", prefix: "NC", copies: 0, culture: "es", source: "ARCA", suggestedPrefix: "NC" }]
    : [{ key: "arca.invoice", version: 1, name: "Invoice", description: "Invoice C with its items, the total and the customer's data.", prefix: "FAC", copies: 1, culture: "es", source: "ARCA", suggestedPrefix: "FAC2" },
      { key: "arca.credit-note", version: 1, name: "Credit note", description: "Fully or partly cancels an issued invoice.", prefix: "NC", copies: 0, culture: "es", source: "ARCA", suggestedPrefix: "NC" }];
  return async (request: Request): Promise<Response | undefined> => {
    const path = new URL(request.url).pathname;
    if (path === "/api/forms/library" && request.method === "GET") return Response.json({ standards });
    return undefined;
  };
}
