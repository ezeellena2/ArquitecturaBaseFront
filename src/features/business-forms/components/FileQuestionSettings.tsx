import { validFileCounts } from "../fileQuestions";
import { useTranslation } from "react-i18next";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { RadioGroupField } from "@/shared/ui/RadioGroupField";
import type { DraftQuestion, DraftFileSettings } from "../model";

export function FileQuestionSettings({ question, readOnly, error, onChange }: { question: Extract<DraftQuestion, { type: "photo" | "document" }>; readOnly: boolean; error?: string; onChange: (question: DraftQuestion) => void }) {
  const { t } = useTranslation("forms");
  const countError = error ?? (!validFileCounts(question.files) ? t("files.invalidRange") : undefined);
  const change = (files: DraftFileSettings) => onChange({ ...question, files, required: (files.minFiles ?? 0) > 0 });
  return <div className="flex flex-col gap-4">
    {question.type === "photo" ? <div className="flex flex-col gap-2"><p className="text-sm font-medium">{t("files.photoSource")}</p><RadioGroupField label={t("files.photoSource")} variant="cards" value={question.files.photoSource ?? "cameraOrGallery"} onValueChange={source => change({ ...question.files, photoSource: source as "cameraOrGallery" | "camera" })} options={(["cameraOrGallery", "camera"] as const).map(source => ({ value: source, label: t("files.sources." + source), description: t("files.sourceHelp." + source), disabled: readOnly }))} /></div> : <p className="text-sm text-[var(--color-content-muted)]">{t("files.documentTypes")}</p>}
    <p className="text-sm font-medium">{t(question.type === "photo" ? "files.howManyPhotos" : "files.howManyDocuments")}</p>
    <div className="grid max-w-sm grid-cols-2 gap-4">
      <FormField label={t("files.minimum")} error={countError}><Input type="number" step={1} required min={0} max={10} readOnly={readOnly} value={question.files.minFiles ?? ""} onChange={event => change({ ...question.files, minFiles: event.target.value === "" ? null : event.target.valueAsNumber })} /></FormField>
      <FormField label={t("files.maximum")} error={countError}><Input type="number" step={1} required min={1} max={10} readOnly={readOnly} value={question.files.maxFiles ?? ""} onChange={event => change({ ...question.files, maxFiles: event.target.value === "" ? null : event.target.valueAsNumber })} /></FormField>
    </div>
    <p className="text-xs text-[var(--color-content-muted)]">{t("files.minimumHint")}</p>
  </div>;
}
