import type { FormCulture, LocalizedText } from "./model";
export interface PdfDesign {
    name: LocalizedText;
    questionIds: readonly string[];
    includeApproval: boolean;
    footer: LocalizedText | null;
    includePhotos: boolean;
}
export function preparePdfDesign(draft: PdfDesign, original: FormCulture): {
    design: PdfDesign | null;
    errors: Record<string, string>;
} {
    const errors: Record<string, string> = {};
    const text = (map: LocalizedText | null, path: string, max: number, required: boolean) => { const result: Record<string, string> = {}; for (const culture of ["es", "en"] as const) {
        const value = map?.[culture]?.trim();
        if (value) {
            result[culture] = value;
            if (value.length > max)
                errors[path + "." + culture] = "tooLong";
        }
    } if ((required || Object.keys(result).length) && !result[original])
        errors[path + "." + original] = "originalRequired"; return result; };
    const name = text(draft.name, "name", 160, true);
    const footer = text(draft.footer, "footer", 1000, false);
    return { design: Object.keys(errors).length ? null : { ...draft, name, footer: Object.keys(footer).length ? footer : null }, errors };
}
