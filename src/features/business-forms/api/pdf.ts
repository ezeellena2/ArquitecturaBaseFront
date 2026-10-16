import { z } from "zod";
import { api, type ApiFile } from "@/shared/api/httpClient";
import { formId } from "./response";
import type { FormCulture } from "../model";
import type { PdfDesign } from "../pdfDesign";
const guid = z.string().uuid();
const utc = z.iso.datetime();
const text = z.record(z.string().refine((culture): boolean => culture === "es" || culture === "en"), z.string());
export const pdfDesignSchema = z.strictObject({ name: text, questionIds: z.array(guid), includeApproval: z.boolean(), footer: text.nullable(), includePhotos: z.boolean() });
const response = z.strictObject({ id: guid.nullable(), definitionId: guid, revision: z.number().int().nonnegative(), originalCulture: z.enum(["es", "en"]), design: pdfDesignSchema, createdAtUtc: utc.nullable(), author: z.strictObject({ userId: guid, displayName: z.string().nullable() }).nullable() });
export type FormPdfDesign = z.infer<typeof response>;
export function readPdfDesign(body: unknown): FormPdfDesign { const parsed = response.safeParse(body); if (!parsed.success)
    throw new Error("Invalid form PDF design contract."); return parsed.data; }
export type FormPdfFile = ReturnType<typeof readPdfFile>;
const definitionPath = (id: string) => "/api/forms/definitions/" + formId(id) + "/pdf-design";
export const fetchPdfDesign = async (id: string, signal?: AbortSignal) => readPdfDesign(await api.get<unknown>(definitionPath(id), { signal, cache: "no-store" }));
export const savePdfDesign = async (id: string, expectedRevision: number, design: PdfDesign, signal?: AbortSignal) => readPdfDesign(await api.post<unknown>(definitionPath(id), { expectedRevision, design }, { signal }));
function readPdfFile(file: ApiFile) { if (file.blob.type !== "application/pdf" || (file.contentLanguage !== "es" && file.contentLanguage !== "en"))
    throw new Error("Invalid form PDF content contract."); return { ...file, contentLanguage: file.contentLanguage as FormCulture }; }
export const previewPdfDesign = async (id: string, design: PdfDesign, culture: FormCulture, signal?: AbortSignal) => readPdfFile(await api.file(definitionPath(id) + "/preview", { method: "POST", body: JSON.stringify({ design, culture }), signal, headers: { accept: "application/pdf" } }));
export const fetchResponseDocument = async (recordId: string, documentId: string, download: boolean, signal?: AbortSignal) => readPdfFile(await api.file("/api/forms/records/" + formId(recordId) + "/documents/" + formId(documentId) + "/content?download=" + download, { signal, headers: { accept: "application/pdf" } }));
