import { validFileCounts } from "../fileQuestions";
import { useTranslation } from "react-i18next";
import { InfoTip } from "@/shared/ui/InfoTip";
import { RadioGroupField } from "@/shared/ui/RadioGroupField";
import type { DraftQuestion, DraftFileSettings } from "../model";
import { SelectionRangeFields } from "./SelectionRangeFields";

export function FileQuestionSettings({ question, readOnly, error, onChange }: { question: Extract<DraftQuestion, { type: "photo" | "document" }>; readOnly: boolean; error?: string; onChange: (question: DraftQuestion) => void }) {
  const { t } = useTranslation("forms");
  const countError = error ?? (!validFileCounts(question.files) ? t("files.invalidRange") : undefined);
  const change = (files: DraftFileSettings) => onChange({ ...question, files, required: (files.minFiles ?? 0) > 0 });
  const howMany = t(question.type === "photo" ? "files.howManyPhotos" : "files.howManyDocuments");
  // What the minimum means and, for a document, which files it takes go in the (i) next to «Cuántas fotos» or «Cuántos documentos».
  const countHelp = question.type === "document" ? t("files.documentTypes") + " " + t("files.minimumHint") : t("files.minimumHint");
  return <div className="flex flex-col gap-4">
    {question.type === "photo" ? <div className="flex flex-col gap-2"><p className="text-sm font-medium">{t("files.photoSource")}</p><RadioGroupField label={t("files.photoSource")} variant="cards" value={question.files.photoSource ?? "cameraOrGallery"} onValueChange={source => change({ ...question.files, photoSource: source as "cameraOrGallery" | "camera" })} options={(["cameraOrGallery", "camera"] as const).map(source => ({ value: source, label: t("files.sources." + source), disabled: readOnly }))} /></div> : null}
    <div className="flex items-center gap-1"><p className="text-sm font-medium">{howMany}</p><span className="-my-1 inline-flex"><InfoTip label={t("common:actions.moreInfo", { label: howMany })} text={countHelp} /></span></div>
    <SelectionRangeFields value={{ minimum: question.files.minFiles, maximum: question.files.maxFiles }} limit={10} minimumLabel={t("files.minimum")} maximumLabel={t("files.maximum")} readOnly={readOnly} error={countError} onChange={range => change({ ...question.files, minFiles: range.minimum, maxFiles: range.maximum })}/>
  </div>;
}
