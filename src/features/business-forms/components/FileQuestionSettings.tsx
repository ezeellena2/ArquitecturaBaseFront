import { validFileCounts } from "../fileQuestions";
import { useTranslation } from "react-i18next";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { FormField } from "@/shared/ui/FormField";
import { InfoTip } from "@/shared/ui/InfoTip";
import { Picker } from "@/shared/ui/Picker";
import type { DraftQuestion, DraftFileSettings } from "../model";
import { SelectionRangeFields } from "./SelectionRangeFields";

export function FileQuestionSettings({ question, readOnly, disabledReason, error, onChange }: { question: Extract<DraftQuestion, { type: "photo" | "document" }>; readOnly: boolean;
  /** Why the files do not change (a question a library standard needs, BI1-A), on each control. */
  disabledReason?: string | null; error?: string; onChange: (question: DraftQuestion) => void }) {
  const { t } = useTranslation("forms");
  const countError = error ?? (!validFileCounts(question.files) ? t("files.invalidRange") : undefined);
  const change = (files: DraftFileSettings) => onChange({ ...question, files, required: (files.minFiles ?? 0) > 0 });
  const howMany = t(question.type === "photo" ? "files.howManyPhotos" : "files.howManyDocuments");
  // What the minimum means and, for a document, which files it takes go in the (i) next to «Cuántas fotos» or «Cuántos documentos».
  const countHelp = question.type === "document" ? t("files.documentTypes") + " " + t("files.minimumHint") : t("files.minimumHint");
  // Where the photo comes from goes in the only piece to choose (DS1-A, 2026-11-22), as wide as the counts under it; the one it
  // has changes nothing.
  const source = question.type === "photo" ? question.files.photoSource ?? "cameraOrGallery" : null;
  return <div className="flex flex-col gap-4">
    {source !== null ? <div className="max-w-sm"><FormField label={t("files.photoSource")}><DisabledReason reason={disabledReason} className="grid w-full">
      <Picker label={t("files.photoSource")} disabled={readOnly || !!disabledReason} value={source}
        onChange={next => { if (next !== source) change({ ...question.files, photoSource: next as "cameraOrGallery" | "camera" }); }}
        options={(["cameraOrGallery", "camera"] as const).map(option => ({ id: option, label: t("files.sources." + option) }))} />
    </DisabledReason></FormField></div> : null}
    <div className="flex items-center gap-1"><p className="text-sm font-medium">{howMany}</p><span className="-my-1 inline-flex"><InfoTip label={t("common:actions.moreInfo", { label: howMany })} text={countHelp} /></span></div>
    <SelectionRangeFields value={{ minimum: question.files.minFiles, maximum: question.files.maxFiles }} limit={10} minimumLabel={t("files.minimum")} maximumLabel={t("files.maximum")} readOnly={readOnly} disabledReason={disabledReason} error={countError} onChange={range => change({ ...question.files, minFiles: range.minimum, maxFiles: range.maximum })}/>
  </div>;
}
