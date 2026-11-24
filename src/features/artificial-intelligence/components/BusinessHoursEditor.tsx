import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { formatDateOnly } from "@/shared/lib/dateTime";
import { timeZoneOptions } from "@/shared/lib/timeZones";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/FormField";
import { GroupLabel } from "@/shared/ui/GroupLabel";
import { IconButton } from "@/shared/ui/IconButton";
import { PencilIcon, PlusIcon, TrashIcon } from "@/shared/ui/icons";
import { Input } from "@/shared/ui/input";
import { Picker, type PickerOption } from "@/shared/ui/Picker";
import { Surface } from "@/shared/ui/Surface";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { emptyBusinessDetails, emptyPeriod, timeOptions, validateBusinessDetails, validateHours } from "../businessDetailsModel";
import type { BusinessDetails, OpeningPeriod, OpeningStatus, SpecialDate } from "../api/businessInformation";
const maxPeriods = 4;
const maxExceptions = 32;
const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const openingStatuses: readonly OpeningStatus[] = ["unknown", "open", "closed", "allDay"];
const times: readonly PickerOption[] = timeOptions.map(time => ({ id: time, label: time }));
type Hours = BusinessDetails["openingHours"];
/// What the dialog edits: a weekday has no date.
interface DayDraft { date?: string; status: OpeningStatus; periods: OpeningPeriod[] }
interface Problems { date?: string; periods?: string }
type Editing = { weekday: number } | { special: SpecialDate; isNew: boolean };
interface Props { value: Hours; onChange: (value: Hours) => void; editable: boolean; locked: boolean; error?: string; legacy: React.ReactNode }

/// The hours read as tables (IN1-C, IN2 and IN3, 2026-11-22): the week, a day per row, and the special dates, a date per row.
/// «Horario» is one piece of data, the hours of that day: its periods or, when it does not open, its state. A day and a special
/// date are edited in the same dialog, opened by the pencil of its row; nothing in a row is a button with text (2026-11-20).
export function BusinessHoursEditor({ value, onChange, editable, locked, error, legacy }: Props) {
  const { t, i18n } = useTranslation("businessInformation");
  // A special date is shown with numbers only, in the order of the language (2026-11-10), never as it is stored.
  const shownDate = (date: string) => formatDateOnly(date, i18n.language) ?? date;
  const dayName = (weekday: number) => t(`days.${weekdays[weekday]}`);
  const dayInText = (weekday: number) => t(`daysInText.${weekdays[weekday]}`);
  const [editing, setEditing] = useState<Editing | null>(null);
  // The only list of time zones (DS1-A), with the chosen one and «UTC» even if the browser does not list them.
  const zones = useMemo(() => timeZoneOptions(i18n.language, [value.timeZoneId, "UTC"]), [i18n.language, value.timeZoneId]);
  const exceptionsId = useId();
  const full = value.exceptions.length >= maxExceptions;
  // A day is checked alone when its dialog confirms; what crosses into the next day is checked on Save, under the week.
  function problemsOf(next: DayDraft): Problems {
    const periods = validateHours([{ weekday: 0, status: next.status, periods: next.periods }], false);
    if (!editing || "weekday" in editing) return { periods: periods ? `hourErrors.${periods}` : undefined };
    if (!next.date || periods) return { date: next.date ? undefined : "specialDateRequired", periods: periods ? `hourErrors.${periods}` : undefined };
    // Solo es de la fecha el error que aparece con ella: el que el horario ya tenía sin ella, como un día semanal incompleto, se marca al guardar.
    const others = value.exceptions.filter(item => item.date !== editing.special.date);
    const scheduleError = (exceptions: SpecialDate[]) => validateBusinessDetails({ ...emptyBusinessDetails(value.timeZoneId), openingHours: { ...value, exceptions } })["details.openingHours"];
    const withDate = scheduleError([...others, { date: next.date, status: next.status, periods: next.periods }]);
    return { date: withDate !== scheduleError(others) ? withDate : undefined };
  }
  function confirm(next: DayDraft) {
    if (!editing) return;
    if ("weekday" in editing) onChange({ ...value, days: value.days.map(day => day.weekday === editing.weekday ? { weekday: day.weekday, status: next.status, periods: next.periods } : day) });
    else onChange({ ...value, exceptions: [...value.exceptions.filter(item => item.date !== editing.special.date), { date: next.date ?? "", status: next.status, periods: next.periods }].sort((a, b) => a.date.localeCompare(b.date)) });
    setEditing(null);
  }
  // El error llega del editor: aparece al intentar guardar y después sigue en vivo.
  return <Surface title={t("hoursSection")} padded><div className="flex flex-col gap-4" id="business-details.openingHours" tabIndex={-1} role="group" aria-label={t("hoursSection")} aria-invalid={!!error} aria-describedby={error ? "business-hours-error" : undefined}>
    {/* Arriba, porque vale para la semana y para las fechas especiales; que sea sólo la del horario va en la (i). */}
    <div className="w-full sm:w-96"><FormField label={t("timeZoneLabel")} help={t("timeZoneHint")}><Picker label={t("timeZoneLabel")} options={zones} value={value.timeZoneId} disabled={!editable || locked} onChange={timeZoneId => onChange({ ...value, timeZoneId })} /></FormField></div>
    <div className="flex flex-col gap-2">
      <Surface><Table aria-label={t("weekTable")}>
        <TableHeader><TableRow><TableHead className="w-28">{t("day")}</TableHead><TableHead>{t("specialPeriods")}</TableHead>{editable ? <TableHead className="w-px"><span className="sr-only">{t("actionsColumn")}</span></TableHead> : null}</TableRow></TableHeader>
        <TableBody>{value.days.map(day => <TableRow key={day.weekday}>
          <TableCell>{dayName(day.weekday)}</TableCell>
          <TableCell className="whitespace-normal"><Schedule day={day} /></TableCell>
          {editable ? <TableCell className="text-right"><IconButton size="icon-sm" label={t("editDay", { day: dayInText(day.weekday) })} disabled={locked} onClick={() => setEditing({ weekday: day.weekday })}><PencilIcon className="size-4" /></IconButton></TableCell> : null}
        </TableRow>)}</TableBody>
      </Table></Surface>
      {error ? <p id="business-hours-error" role="alert" className="text-sm text-[var(--color-danger)]">{error}</p> : null}
    </div>
    {editable ? <div className="flex"><Button variant="outline" disabled={locked} onClick={() => onChange({ ...value, days: value.days.map(day => day.weekday < 5 ? { ...structuredClone(value.days[0]), weekday: day.weekday } : day) })}>{t("copyWeek")}</Button></div> : null}
    {/* Sin fechas no hay tabla ni un texto que lo diga: queda «Agregar fecha especial», y sin permiso, nada. */}
    {editable || value.exceptions.length ? <div className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-3"><p id={exceptionsId} className="text-sm font-medium">{t("exceptions")}</p>
      {value.exceptions.length ? <Surface><Table aria-labelledby={exceptionsId}>
        <TableHeader><TableRow><TableHead className="w-28">{t("specialDate")}</TableHead><TableHead>{t("specialPeriods")}</TableHead>{editable ? <TableHead className="w-px"><span className="sr-only">{t("actionsColumn")}</span></TableHead> : null}</TableRow></TableHeader>
        <TableBody>{value.exceptions.map(item => <TableRow key={item.date}>
          <TableCell>{shownDate(item.date)}</TableCell>
          <TableCell className="whitespace-normal"><Schedule day={item} /></TableCell>
          {editable ? <TableCell><div className="flex justify-end gap-1">
            <IconButton size="icon-sm" label={t("editDate", { date: shownDate(item.date) })} disabled={locked} onClick={() => setEditing({ special: structuredClone(item), isNew: false })}><PencilIcon className="size-4" /></IconButton>
            <IconButton size="icon-sm" label={t("removeDate", { date: shownDate(item.date) })} disabled={locked} onClick={() => onChange({ ...value, exceptions: value.exceptions.filter(previous => previous.date !== item.date) })}><TrashIcon className="size-4" /></IconButton>
          </div></TableCell> : null}
        </TableRow>)}</TableBody>
      </Table></Surface> : null}
      {editable ? <div className="flex"><DisabledReason reason={!locked && full ? t("exceptionsLimit", { count: maxExceptions }) : null}><Button variant="outline" size="sm" disabled={locked || full} onClick={() => setEditing({ special: { date: "", status: "closed", periods: [] }, isNew: true })}><PlusIcon className="size-4" />{t("addException")}</Button></DisabledReason></div> : null}
    </div> : null}
  </div>{legacy}
  {editing && editable && !locked ? "weekday" in editing
    ? <OpeningDayDialog title={t("dayTitle", { day: dayInText(editing.weekday) })} initial={structuredClone(value.days.find(day => day.weekday === editing.weekday)!)} dated={false} periodsLabel={dayName(editing.weekday)} confirmLabel={t("done")} problemsOf={problemsOf} onCancel={() => setEditing(null)} onConfirm={confirm} />
    : <OpeningDayDialog title={t("specialTitle")} initial={editing.special} dated periodsLabel={t("specialDate")} confirmLabel={t(editing.isNew ? "confirmDate" : "done")} problemsOf={problemsOf} onCancel={() => setEditing(null)} onConfirm={confirm} />
    : null}
  </Surface>;
}
/// «Horario»: the periods of a day, one per line, with «del día siguiente» when it closes after midnight, or its state when it
/// does not open; «Sin definir» in grey, as what is missing.
function Schedule({ day }: { day: DayDraft }) {
  const { t } = useTranslation("businessInformation");
  if (day.status !== "open") return <span className={day.status === "unknown" ? "text-[var(--color-content-muted)]" : undefined}>{t(day.status)}</span>;
  return <>{day.periods.map((period, index) => <span key={index} className="block"><span className="whitespace-nowrap">{period.start || "—"} – {period.end || "—"}</span>{period.nextDay ? ` ${t("nextDayShort")}` : null}</span>)}</>;
}
/// The four states go in the shared piece for choosing, like any list (DS1-A, 2026-11-22: «un combo desplegable a elegir las
/// opciones»), named «Atención» under the title of the dialog. Choosing the state it already has changes nothing.
function OpeningStatusControl({ status, onChange }: { status: OpeningStatus; onChange: (status: OpeningStatus) => void }) {
  const { t } = useTranslation("businessInformation");
  return <Picker label={t("attention")} value={status} className="w-full"
    options={openingStatuses.map(value => ({ id: value, label: t(value) }))}
    onChange={value => { if (value !== status) onChange(value as OpeningStatus); }} />;
}
/// «Agregar franja» va siempre debajo de las franjas, con la misma forma: con cuatro se apaga con el límite como motivo
/// (`DisabledReason`). La papelera aparece en cada franja cuando hay más de una.
function OpeningPeriods({ periods, label, onChange }: { periods: OpeningPeriod[]; label: string; onChange: (periods: OpeningPeriod[]) => void }) {
  const { t } = useTranslation("businessInformation");
  const full = periods.length >= maxPeriods;
  function update(index: number, next: OpeningPeriod) { onChange(periods.map((period,i) => i === index ? next : period)); }
  return <div className="space-y-3">{periods.map((period,index) => <div key={index} className="space-y-1.5">
    <div className="flex min-w-0 items-start gap-2">
      {/* A time is one of 96, every 15 minutes: the Picker, with «Elegir» while there is none and the search inside. */}
      <Picker className="w-24 shrink-0" label={`${label} ${index+1} · ${t("from")}`} placeholder={t("chooseTime")} options={times} value={period.start || null} onChange={start => update(index,{ ...period, start })} />
      <span className="pt-1 text-xs text-[var(--color-content-muted)]">–</span>
      <Picker className="w-24 shrink-0" label={`${label} ${index+1} · ${t("to")}`} placeholder={t("chooseTime")} options={times} value={period.end || null} onChange={end => update(index,{ ...period, end })} />
      {periods.length > 1 ? <IconButton label={`${t("removePeriod")} · ${label} ${index+1}`} size="icon-sm" onClick={() => onChange(periods.filter((_,i) => i !== index))}><TrashIcon className="size-4" /></IconButton> : null}
    </div>
    {period.nextDay || (period.start && period.end && period.end <= period.start) ? <label className="flex items-center gap-2 text-xs text-[var(--color-content-muted)]"><Checkbox checked={period.nextDay} onCheckedChange={checked => update(index,{ ...period,nextDay:checked === true })} />{t("nextDay")}</label> : null}
  </div>)}<div className="flex"><DisabledReason reason={full ? t("periodsLimit", { count: maxPeriods }) : null}><Button variant="muted-link" size="sm" aria-label={`${t("addPeriod")} · ${label}`} disabled={full} onClick={() => onChange([...periods,emptyPeriod()])}>{t("addPeriod")}</Button></DisabledReason></div></div>;
}
/// One dialog for a weekday and for a special date (IN2): only a special date has its date. «Listo» (or «Agregar fecha» for
/// a new date) checks what the dialog brings and, with a problem, stays open; after the first try the problems follow what is
/// corrected. Cancel and the × change nothing and give the focus back to the pencil.
function OpeningDayDialog({ title, initial, dated, periodsLabel, confirmLabel, problemsOf, onCancel, onConfirm }: { title: string; initial: DayDraft; dated: boolean; periodsLabel: string; confirmLabel: string; problemsOf: (value: DayDraft) => Problems; onCancel: () => void; onConfirm: (value: DayDraft) => void }) {
  const { t } = useTranslation("businessInformation");
  const restore = useRestoreFocusOnClose();
  const [value,setValue] = useState(initial);
  const [attempted,setAttempted] = useState(false);
  const dateId = useId();
  const statusId = useId();
  const periodsId = useId();
  const shown: Problems = attempted ? problemsOf(value) : {};
  function confirm() {
    const found = problemsOf(value);
    if (!found.date && !found.periods) { onConfirm(value); return; }
    setAttempted(true);
    if (found.date) document.getElementById(dateId)?.focus();
  }
  // Sin leyenda debajo del título: el diálogo se explica con sus campos. Cada parte lleva su etiqueta, como la fecha
  // (lista de chequeo, 2026-11-11): «Atención» es el estado y «Horario», el grupo de sus franjas, con su problema debajo.
  return <Dialog open onOpenChange={open => { if (!open) onCancel(); }}><DialogContent aria-describedby={undefined} onCloseAutoFocus={restore}>
    <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
    {dated ? <FormField label={t("specialDate")} error={shown.date ? t(shown.date) : undefined}><Input id={dateId} type="date" min="1900-01-01" max="9998-12-31" value={value.date ?? ""} onChange={event => setValue({ ...value,date:event.target.value })} /></FormField> : null}
    <div className="flex flex-col gap-1.5"><GroupLabel id={statusId}>{t("attention")}</GroupLabel>
      <OpeningStatusControl status={value.status} onChange={status => setValue({ ...value,status,periods:status === "open" ? value.periods.length ? value.periods : [emptyPeriod()] : [] })} /></div>
    {value.status === "open" ? <FormField label={t("specialPeriods")} htmlFor={periodsId} error={shown.periods ? t(shown.periods) : undefined}>
      <div role="group" aria-labelledby={`${periodsId}-label`}><OpeningPeriods periods={value.periods} label={periodsLabel} onChange={periods => setValue({ ...value,periods })} /></div>
    </FormField> : null}
    <DialogFooter><Button variant="outline" onClick={onCancel}>{t("cancel")}</Button><Button onClick={confirm}>{confirmLabel}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
