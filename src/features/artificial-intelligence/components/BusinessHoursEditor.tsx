import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/FormField";
import { IconButton } from "@/shared/ui/IconButton";
import { PlusIcon, TrashIcon } from "@/shared/ui/icons";
import { Input } from "@/shared/ui/input";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { Surface } from "@/shared/ui/Surface";
import { emptyBusinessDetails, emptyPeriod, timeOptions, validateBusinessDetails, validateHours } from "../businessDetailsModel";
import type { BusinessDetails, OpeningDay, OpeningPeriod, OpeningStatus, SpecialDate } from "../api/businessInformation";
const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
interface Props { value: BusinessDetails["openingHours"]; onChange: (value: BusinessDetails["openingHours"]) => void; editable: boolean; locked: boolean; error?: string; legacy: React.ReactNode }
export function BusinessHoursEditor({ value, onChange, editable, locked, error, legacy }: Props) {
  const { t } = useTranslation("businessInformation");
  const [special, setSpecial] = useState<SpecialDate | null>(null);
  const zones = useMemo(() => Array.from(new Set([value.timeZoneId, "UTC", ...Intl.supportedValuesOf("timeZone")])).sort(), [value.timeZoneId]);
  const disabled = !editable || locked;
  function changeDay(next: OpeningDay) { onChange({ ...value, days: value.days.map(day => day.weekday === next.weekday ? next : day) }); }
  // El error llega del editor: aparece al intentar guardar y después sigue en vivo, no al abrir un día.
  return <Surface title={t("hoursSection")} padded><div className="@container space-y-4" id="business-details.openingHours" tabIndex={-1} role="group" aria-label={t("hoursSection")} aria-invalid={!!error} aria-describedby={error ? "business-hours-error" : undefined}>
    <p className="text-sm text-[var(--color-content-muted)]">{t("hoursHint")}</p>
    <div className="divide-y divide-[var(--color-border)]">{value.days.map(day => {
      const label = t(`days.${weekdays[day.weekday]}`);
      return <div key={day.weekday} className="grid grid-cols-[minmax(0,1fr)_112px] items-start gap-2 py-3 @min-[424px]:grid-cols-[80px_112px_minmax(0,1fr)]">
        <p className="pt-1.5 text-sm font-medium">{label}</p>
        <OpeningStatusSelect status={day.status} label={label} disabled={disabled} onChange={status => changeDay({ ...day, status, periods: status === "open" ? day.periods.length ? day.periods : [emptyPeriod()] : [] })} />
        {day.status === "open" ? <div className="col-span-2 space-y-3 @min-[424px]:col-span-1"><OpeningPeriods periods={day.periods} label={label} disabled={disabled} onChange={periods => changeDay({ ...day, periods })} /></div> : null}
      </div>;
    })}</div>
    {error ? <p id="business-hours-error" role="alert" className="text-sm text-[var(--color-danger)]">{error}</p> : null}
    {editable ? <Button variant="outline" disabled={locked} onClick={() => onChange({ ...value, days: value.days.map(day => day.weekday < 5 ? { ...structuredClone(value.days[0]), weekday: day.weekday } : day) })}>{t("copyWeek")}</Button> : null}
    <FormField label={t("timeZoneLabel")} hint={t("timeZoneHint")}><NativeSelect value={value.timeZoneId} disabled={disabled} onChange={event => onChange({ ...value, timeZoneId: event.target.value })}>{zones.map(zone => <option key={zone}>{zone}</option>)}</NativeSelect></FormField>
    <div className="space-y-3 border-t border-[var(--color-border)] pt-3"><p className="text-sm font-medium">{t("exceptions")}</p>
      {!value.exceptions.length ? <p className="text-xs text-[var(--color-content-muted)]">{t("noExceptions")}</p> : value.exceptions.map(item => <div key={item.date} className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">{item.date} · {t(item.status)}{item.status === "open" ? ` · ${item.periods.map(period => `${period.start}–${period.end}${period.nextDay ? " (+1)" : ""}`).join(", ")}` : ""}</p>
        {editable ? <div className="flex items-center gap-2"><Button variant="muted-link" disabled={locked} onClick={() => setSpecial(structuredClone(item))}>{t("editDate")}</Button><IconButton label={t("removeDate", { date: item.date })} size="icon-sm" disabled={locked} onClick={() => onChange({ ...value, exceptions: value.exceptions.filter(previous => previous.date !== item.date) })}><TrashIcon className="size-4" /></IconButton></div> : null}
      </div>)}
      {editable ? <DisabledReason reason={!locked && value.exceptions.length >= 32 ? t("exceptionsLimit", { count: 32 }) : null}><Button variant="outline" disabled={locked || value.exceptions.length >= 32} onClick={() => setSpecial({ date: "", status: "closed", periods: [] })}>{t("addException")}</Button></DisabledReason> : null}
    </div>
  </div>{legacy}
  {special && editable && !locked ? <SpecialDateDialog initial={special} hours={value} onCancel={() => setSpecial(null)} onConfirm={next => { onChange({ ...value, exceptions: [...value.exceptions.filter(item => item.date !== special.date), next].sort((a,b) => a.date.localeCompare(b.date)) }); setSpecial(null); }} /> : null}
  </Surface>;
}
function OpeningStatusSelect({ status, label, disabled, onChange }: { status: OpeningStatus; label: string; disabled: boolean; onChange: (status: OpeningStatus) => void }) {
  const { t } = useTranslation("businessInformation");
  return <NativeSelect aria-label={`${label} · ${t("attention")}`} value={status} disabled={disabled} onChange={event => onChange(event.target.value as OpeningStatus)}>{["unknown", "open", "closed", "allDay"].map(value => <option key={value} value={value}>{t(value)}</option>)}</NativeSelect>;
}
function OpeningPeriods({ periods, label, disabled, onChange }: { periods: OpeningPeriod[]; label: string; disabled: boolean; onChange: (periods: OpeningPeriod[]) => void }) {
  const { t } = useTranslation("businessInformation");
  function update(index: number, next: OpeningPeriod) { onChange(periods.map((period,i) => i === index ? next : period)); }
  return <div className="space-y-3">{periods.map((period,index) => <div key={index} className="space-y-1.5">
    <div className="flex min-w-0 items-start gap-2">
      <NativeSelect className="w-20 shrink-0" aria-label={`${label} ${index+1} · ${t("from")}`} disabled={disabled} value={period.start} onChange={event => update(index,{ ...period, start:event.target.value })}><option value="">{t("chooseTime")}</option>{timeOptions.map(time => <option key={time}>{time}</option>)}</NativeSelect>
      <span className="pt-1 text-xs text-[var(--color-content-muted)]">–</span>
      <NativeSelect className="w-20 shrink-0" aria-label={`${label} ${index+1} · ${t("to")}`} disabled={disabled} value={period.end} onChange={event => update(index,{ ...period,end:event.target.value })}><option value="">{t("chooseTime")}</option>{timeOptions.map(time => <option key={time}>{time}</option>)}</NativeSelect>
      {!disabled && periods.length > 1 ? <IconButton label={`${t("removePeriod")} · ${label} ${index+1}`} size="icon-sm" onClick={() => onChange(periods.filter((_,i) => i !== index))}><TrashIcon className="size-4" /></IconButton> : null}
      {!disabled && periods.length === 1 ? <IconButton label={`${t("addPeriod")} · ${label}`} size="icon-sm" onClick={() => onChange([...periods,emptyPeriod()])}><PlusIcon className="size-4" /></IconButton> : null}
    </div>
    {period.nextDay || (period.start && period.end && period.end <= period.start) ? <label className="flex items-center gap-2 text-xs text-[var(--color-content-muted)]"><Checkbox disabled={disabled} checked={period.nextDay} onCheckedChange={checked => update(index,{ ...period,nextDay:checked === true })} />{t("nextDay")}</label> : null}
  </div>)}{!disabled && periods.length > 1 && periods.length < 4 ? <Button variant="muted-link" size="sm" onClick={() => onChange([...periods,emptyPeriod()])}>{t("addPeriod")}</Button> : null}</div>;
}
function SpecialDateDialog({ initial, hours, onCancel, onConfirm }: { initial: SpecialDate; hours: Props["value"]; onCancel: () => void; onConfirm: (value: SpecialDate) => void }) {
  const { t } = useTranslation("businessInformation");
  const restore = useRestoreFocusOnClose();
  const [value,setValue] = useState(initial);
  // Confirmar valida al tocarlo; después del primer intento, los errores siguen en vivo mientras se corrigen.
  const [attempted,setAttempted] = useState(false);
  const dateId = useId();
  function problems(next: SpecialDate): { date?: string; periods?: string } {
    const periods = validateHours([{ ...next,weekday:0 }],false);
    if (!next.date || periods) return { date: next.date ? undefined : "specialDateRequired", periods: periods ? `hourErrors.${periods}` : undefined };
    // Solo es de la fecha el error que aparece con ella: el que el horario ya tenía sin ella, como un día semanal incompleto, se marca al guardar.
    const others = hours.exceptions.filter(item => item.date !== initial.date);
    const scheduleError = (exceptions: SpecialDate[]) => validateBusinessDetails({ ...emptyBusinessDetails(hours.timeZoneId),openingHours:{ ...hours,exceptions } })["details.openingHours"];
    const withDate = scheduleError([...others,next]);
    return { date: withDate !== scheduleError(others) ? withDate : undefined };
  }
  const shown: ReturnType<typeof problems> = attempted ? problems(value) : {};
  function confirm() {
    const found = problems(value);
    if (!found.date && !found.periods) { onConfirm(value); return; }
    setAttempted(true);
    if (found.date) document.getElementById(dateId)?.focus();
  }
  return <Dialog open onOpenChange={open => { if (!open) onCancel(); }}><DialogContent onCloseAutoFocus={restore}>
    <DialogHeader><DialogTitle>{t("specialTitle")}</DialogTitle><DialogDescription>{t("specialHint")}</DialogDescription></DialogHeader>
    <FormField label={t("specialDate")} error={shown.date ? t(shown.date) : undefined}><Input id={dateId} type="date" min="1900-01-01" max="9998-12-31" value={value.date} onChange={event => setValue({ ...value,date:event.target.value })} /></FormField>
    <OpeningStatusSelect label={t("specialDate")} status={value.status} disabled={false} onChange={status => setValue({ ...value,status,periods:status === "open" ? [emptyPeriod()] : [] })} />
    {value.status === "open" ? <OpeningPeriods periods={value.periods} label={t("specialDate")} disabled={false} onChange={periods => setValue({ ...value,periods })} /> : null}
    {shown.periods ? <p role="alert" className="text-sm text-[var(--color-danger)]">{t(shown.periods)}</p> : null}
    <DialogFooter><Button variant="outline" onClick={onCancel}>{t("cancel")}</Button><Button onClick={confirm}>{t("confirmDate")}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
