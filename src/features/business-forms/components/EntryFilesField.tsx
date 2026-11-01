import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { IconButton } from "@/shared/ui/IconButton";
import { Input } from "@/shared/ui/input";
import { CloseIcon, DocumentIcon, PlusIcon } from "@/shared/ui/icons";
import type { FormEntryQuestion } from "../api/entries";
import { entryFileProblem, type EntryFileProblem } from "../entryForm";

interface Props {
  question: FormEntryQuestion;
  files: readonly File[];
  onChange: (files: File[]) => void;
  maxFileSizeMiB: number;
  id: string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
}

const photoAccept = "image/jpeg,image/png";
const documentAccept = "application/pdf,application/msword,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/jpeg,image/png";

/**
 * Photos and documents (CW4). They travel with the send; nothing is uploaded before it, so removing one needs no
 * confirmation. Type, size and count are checked here and the server checks the content again.
 */
export function EntryFilesField({ question, files, onChange, maxFileSizeMiB, id, invalid, describedBy, disabled }: Props) {
  const { t, i18n } = useTranslation("formEntries");
  const mobile = useMediaQuery("(width < 640px)");
  const photo = question.type === "photo";
  const max = question.files?.maxFiles ?? 1;
  const camera = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [problems, setProblems] = useState<{ name: string; problem: EntryFileProblem; size: number }[]>([]);
  const [dragging, setDragging] = useState(false);
  const previews = useMemo(() => photo ? files.map(file => URL.createObjectURL(file)) : [], [files, photo]);
  useEffect(() => () => previews.forEach(url => URL.revokeObjectURL(url)), [previews]);
  const full = files.length >= max;
  const megabytes = (size: number) => (size / 1024 / 1024).toLocaleString(i18n.language, { maximumFractionDigits: 1 });
  const describe = (file: File) => {
    const kind = file.type === "application/pdf" ? "PDF" : file.type.startsWith("image/") ? file.type.slice(6).toUpperCase().replace("JPEG", "JPG")
      : file.type.includes("sheet") || file.type.includes("excel") ? "Excel" : "Word";
    return kind + " · " + (file.size < 1024 * 1024 ? t("files.size_kb", { size: Math.max(1, Math.round(file.size / 1024)) }) : t("files.size_mb", { size: megabytes(file.size) }));
  };
  function add(candidates: readonly File[]) {
    const accepted = [...files];
    const rejected: typeof problems = [];
    for (const file of candidates) {
      const problem = entryFileProblem(question, accepted, file, maxFileSizeMiB);
      if (problem) rejected.push({ name: file.name, problem, size: file.size });
      else accepted.push(file);
    }
    setProblems(rejected);
    if (accepted.length !== files.length) onChange(accepted);
  }
  const remove = (index: number) => { setProblems([]); onChange(files.filter((_, position) => position !== index)); };
  const inputs = <>
    <Input ref={picker} type="file" hidden tabIndex={-1} accept={photo ? photoAccept : documentAccept} multiple={max - files.length > 1}
      onChange={event => { add([...(event.target.files ?? [])]); event.target.value = ""; }}/>
    <Input ref={camera} type="file" hidden tabIndex={-1} accept={photoAccept} capture="environment"
      onChange={event => { add([...(event.target.files ?? [])]); event.target.value = ""; }}/>
  </>;
  const messages = problems.length ? <ul className="flex flex-col gap-1 text-sm text-[var(--color-danger-700)]" aria-live="polite">{problems.map((item, index) => <li key={index}>{
    item.problem === "size" ? t("files.size", { name: item.name, size: megabytes(item.size), max: maxFileSizeMiB })
      : item.problem === "count" ? t("files.count", { name: item.name, max }) : t("files." + item.problem, { name: item.name })}</li>)}</ul> : null;
  const counter = files.length ? <p className="text-xs text-[var(--color-content-muted)]">{t("files.counter", { count: files.length, max })}</p> : null;
  const removeButton = (file: File, index: number, large = false) => large
    ? <Button type="button" variant="destructive-outline" size="touch" disabled={disabled} onClick={() => remove(index)}>{t("files.removeShort")}</Button>
    : <span className="absolute top-1 right-1"><IconButton variant="destructive-outline" size="icon-sm" label={t("files.remove", { name: file.name })} disabled={disabled} onClick={() => remove(index)}><CloseIcon className="size-3.5"/></IconButton></span>;

  if (mobile) {
    return <div className="flex flex-col gap-3">
      {inputs}
      {photo ? files.map((file, index) => <figure key={file.name + index} className="flex flex-col gap-2">
        <img src={previews[index]} alt={file.name} className="max-h-64 w-full rounded-[var(--radius-control)] border border-[var(--color-border)] object-cover"/>
        <figcaption className="flex items-center justify-between gap-2 text-sm"><span className="truncate">{file.name}</span>{removeButton(file, index, true)}</figcaption>
      </figure>) : files.map((file, index) => <div key={file.name + index} className="flex items-center gap-3 rounded-[var(--radius-control)] border border-[var(--color-border)] p-3">
        <DocumentIcon className="size-5 shrink-0"/><div className="min-w-0 flex-1"><p className="truncate text-sm">{file.name}</p><p className="text-xs text-[var(--color-content-muted)]">{describe(file)}</p></div>{removeButton(file, index)}
      </div>)}
      {counter}
      {!full ? <div className="flex flex-col gap-2">
        {photo ? <Button type="button" id={id} size="touch" variant="outline" className="w-full" aria-invalid={invalid || undefined} aria-describedby={describedBy} disabled={disabled} onClick={() => camera.current?.click()}>{t("files.takePhoto")}</Button> : null}
        {!photo || question.files?.photoSource !== "camera" ? <Button type="button" id={photo ? undefined : id} size="touch" variant="outline" className="w-full" aria-invalid={!photo && invalid || undefined}
          aria-describedby={photo ? undefined : describedBy} disabled={disabled} onClick={() => picker.current?.click()}>{photo ? t("files.gallery") : files.length ? t("files.otherFile") : t("files.chooseFiles")}</Button> : null}
      </div> : <DisabledReason reason={t("files.maxReached", { max })}><Button type="button" size="touch" variant="outline" className="w-full" disabled>{photo ? t("files.takePhoto") : t("files.otherFile")}</Button></DisabledReason>}
      {messages}
    </div>;
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(false); if (!disabled) add([...event.dataTransfer.files]); };
  const onPaste = (event: ClipboardEvent<HTMLDivElement>) => { const pasted = [...event.clipboardData.files]; if (pasted.length && !disabled) { event.preventDefault(); add(pasted); } };
  const choose = <Button type="button" id={id} variant="outline" size="sm" aria-invalid={invalid || undefined} aria-describedby={describedBy} disabled={disabled}
    onClick={() => picker.current?.click()}>{photo ? max > 1 ? t("files.choosePhotos") : t("files.choosePhoto") : t("files.chooseFiles")}</Button>;
  return <div className="flex flex-col gap-2" onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop} onPaste={onPaste}>
    {inputs}
    {files.length === 0 ? <div className={"flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] border border-dashed px-4 py-5 text-sm " + (dragging ? "border-[var(--color-brand-500)] bg-[var(--color-brand-50)]" : "border-[var(--color-input)]")}>
      <span className="text-[var(--color-content-muted)]">{photo ? t("files.dropPhotos") : t("files.dropFiles")}</span>{choose}
    </div> : photo ? <div className="flex flex-wrap items-start gap-2">
      {files.map((file, index) => <figure key={file.name + index} className="relative flex w-24 flex-col gap-1">
        <img src={previews[index]} alt={file.name} className="aspect-square w-24 rounded-[var(--radius-control)] border border-[var(--color-border)] object-cover"/>
        {removeButton(file, index)}
        <figcaption className="truncate text-xs text-[var(--color-content-muted)]">{file.name}</figcaption>
      </figure>)}
      {!full ? <div className={"inline-flex aspect-square w-24 items-center justify-center rounded-[var(--radius-control)] border border-dashed " + (dragging ? "border-[var(--color-brand-500)]" : "border-[var(--color-input)]")}>
        <Button type="button" id={id} variant="ghost" size="sm" className="flex-col" disabled={disabled} aria-invalid={invalid || undefined} aria-describedby={describedBy} onClick={() => picker.current?.click()}>
          <PlusIcon className="size-4"/>{t("files.add")}</Button></div> : null}
    </div> : <div className="flex flex-col gap-2">
      {files.map((file, index) => <div key={file.name + index} className="relative flex items-center gap-3 rounded-[var(--radius-control)] border border-[var(--color-border)] py-2 pr-9 pl-3">
        <DocumentIcon className="size-5 shrink-0"/><div className="min-w-0"><p className="truncate text-sm">{file.name}</p><p className="text-xs text-[var(--color-content-muted)]">{describe(file)}</p></div>{removeButton(file, index)}
      </div>)}
      {!full ? <div>{choose}</div> : null}
    </div>}
    {counter}
    {messages}
  </div>;
}
