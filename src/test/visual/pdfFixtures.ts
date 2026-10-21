import { fixtureDefinition, wireDefinition } from "./formFixtures";
import { responseRecordId } from "../responseFixtures";
import type { PdfDesign } from "@/features/business-forms/pdfDesign";
import type { ResponseWorkflow } from "@/features/business-forms/api/workflow";
export function samplePdf() {
    const content = "BT /F1 18 Tf 50 780 Td (Example visit receipt) Tj 0 -30 Td /F1 11 Tf (VIS-000024 - Approved) Tj 0 -25 Td (A fixed example used by the UI test fixture.) Tj ET";
    const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>", "<< /Length " + content.length + " >>\nstream\n" + content + "\nendstream", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
    let text = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => { offsets.push(text.length); text += (index + 1) + " 0 obj\n" + object + "\nendobj\n"; });
    const start = text.length;
    text += "xref\n0 6\n0000000000 65535 f \n" + offsets.slice(1).map(offset => String(offset).padStart(10, "0") + " 00000 n \n").join("") + "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + start + "\n%%EOF";
    return new TextEncoder().encode(text);
}
export function createPdfVisualFixtures() {
    const definition = fixtureDefinition();
    let current = { id: null as string | null, definitionId: definition.id, revision: 0, originalCulture: "es" as const, design: { name: { es: "Comprobante de visita", en: "" }, questionIds: definition.draft.fields.map(field => field.fieldId), includeApproval: true, footer: null, includePhotos: true } as PdfDesign, createdAtUtc: null as string | null, author: null as {
            userId: string;
            displayName: string;
        } | null };
    const writes: unknown[] = [];
    const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
    const documentId = "0199a0c0-0000-7000-8000-000000000080";
    return { writes, document: { id: documentId, runId: "0199a0c0-0000-7000-8000-000000000090", culture: "es" as const, name: "Visita-VIS-000024.pdf", size: samplePdf().length, createdAtUtc: "2026-10-16T12:00:00Z" }, async handle(request: Request): Promise<Response | null> {
            const path = new URL(request.url).pathname;
            if (path.endsWith("/pdf-design/preview")) {
                const body = await request.json() as {
                    design: PdfDesign;
                    culture: "es" | "en";
                };
                const culture = body.design.name[body.culture]?.trim() && (!body.design.footer || body.design.footer[body.culture]?.trim()) ? body.culture : "es";
                return new Response(samplePdf(), { headers: { "Content-Type": "application/pdf", "Content-Language": culture, "Content-Disposition": "inline; filename=example.pdf" } });
            }
            if (path.includes("/documents/"))
                return new Response(samplePdf(), { headers: { "Content-Type": "application/pdf", "Content-Language": "es", "Content-Disposition": "attachment; filename=Visita-VIS-000024.pdf" } });
            if (path.endsWith("/pdf-design")) {
                if (request.method === "POST") {
                    const body = await request.json() as {
                        design: PdfDesign;
                    };
                    writes.push(body);
                    current = { ...current, id: documentId, revision: current.revision + 1, design: body.design, createdAtUtc: "2026-10-16T12:00:00Z", author: { userId: documentId, displayName: "Ana" } };
                }
                return json(current);
            }
            if (path.endsWith("/rules/options"))
                return json({ definitionId: definition.id, name: definition.name, originalCulture: "es", questions: wireDefinition(definition).draft.fields, roles: [], conditionChoices: {} });
            if (path.endsWith("/workflow")) {
                const workflow: ResponseWorkflow = { recordId: responseRecordId, recordState: "Approved", ruleRevision: 1, task: null,
                    actions: [{ id: this.document.runId, ruleId: "0199a0c0-0000-7000-8000-000000000091", kind: "GeneratePdf", event: "Approved", order: 0, revision: 0, state: "Completed",
                        reasonCode: null, reason: null, canConsult: false, canRetry: false, recipients: [], createdAtUtc: this.document.createdAtUtc,
                        updatedAtUtc: this.document.createdAtUtc, completedAtUtc: this.document.createdAtUtc }], documents: [this.document] };
                return json(workflow);
            }
            return null;
        } };
}
