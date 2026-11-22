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
import { TrashIcon } from "@/shared/ui/icons";
import { Input } from "@/shared/ui/input";
import { Picker, type PickerOption } from "@/shared/ui/Picker";
import { Surface } from "@/shared/ui/Surface";
import { emptyBusinessDetails, emptyPeriod, timeOptions, validateBusinessDetails, validateHours } from "../businessDetailsModel";
import type { BusinessDetails, OpeningDay, OpeningPeriod, OpeningStatus, SpecialDate } from "../api/businessInformation";
const maxPeriods = 4;
const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const openingStatuses: readonly OpeningStatus[] = ["unknown", "open", "closed", "allDay"];
const times: readonly PickerOption[] = timeOptions.map(time => ({ id: time, label: time }));
interface Props { value: BusinessDetails["openingHours"]; onChange: (value: BusinessDetails["openingHours"]) => void; editable: boolean; locked: boolean; error?: string; legacy: React.ReactNode }
export function BusinessHoursEditor({ value, onChange, editable, locked, error, legacy }: Props) {
  const { t, i18n } = useTranslation("businessInformation");
  // A special date is shown with numbers only, in the order of the language (2026-11-10), never as it is stored.
  const shownDate = (date: string) => formatDateOnly(date, i18n.language) ?? date;
  const [special, setSpecial] = useState<SpecialDate | null>(null);
  // The only list of time zones (DS1-A), with the chosen one and «UTC» even if the browser does not list them.
  const zones = useMemo(() => timeZoneOptions(i18n.language, [value.timeZoneId, "UTC"]), [i18n.language, value.timeZoneId]);
  const disabled = !editable || locked;
  function changeDay(next: OpeningDay) { onChange({ ...value, days: value.days.map(day => day.weekday === next.weekday ? next : day) }); }
  // El error llega del editor: aparece al intentar guardar y después sigue en vivo, no al abrir un día.
  return <Surface title={t("hoursSection")} padded><div className="@container space-y-4" id="business-details.openingHours" tabIndex={-1} role="group" aria-label={t("hoursSection")} aria-invalid={!!error} aria-describedby={error ? "business-hours-error" : undefined}>
    <div className="divide-y divide-[var(--color-border)]">{value.days.map(day => {
      const label = t(`days.${weekdays[day.weekday]}`);
      // The state goes in the shared piece for choosing (four fixed ones, DS1-A, 2026-11-22): from 44rem it has its own
      // column between the day and its periods; narrower, it goes under the day.
      return <div key={day.weekday} className="grid grid-cols-1 items-start gap-2 py-3 @min-[424px]:grid-cols-[5rem_minmax(0,1fr)] @min-[44rem]:grid-cols-[5rem_max-content_minmax(0,1fr)]">
        <p className="text-sm font-medium @min-[424px]:pt-1.5">{label}</p>
        <div className="min-w-0"><OpeningStatusControl status={day.status} label={`${label} · ${t("attention")}`} disabled={disabled} onChange={status => changeDay({ ...day, status, periods: status === "open" ? day.periods.length ? day.periods : [emptyPeriod()] : [] })} /></div>
        {day.status === "open" ? <div className="space-y-3 @min-[424px]:col-start-2 @min-[44rem]:col-start-3"><OpeningPeriods periods={day.periods} label={label} editable={editable} disabled={disabled} onChange={periods => changeDay({ ...day, periods })} /></div> : null}
      </div>;
    })}</div>
    {error ? <p id="business-hours-error" role="alert" className="text-sm text-[var(--color-danger)]">{error}</p> : null}
    {editable ? <Button variant="outline" disabled={locked} onClick={() => onChange({ ...value, days: value.days.map(day => day.weekday < 5 ? { ...structuredClone(value.days[0]), weekday: day.weekday } : day) })}>{t("copyWeek")}</Button> : null}
    {/* Que la zona sea sólo la del horario, y no la general, no es obvio: va en la (i) de su etiqueta. As wide as in
        Configuración and Mi perfil: the city and, in grey, the time of its country, with the search inside. */}
    <div className="w-full sm:w-96"><FormField label={t("timeZoneLabel")} help={t("timeZoneHint")}><Picker label={t("timeZoneLabel")} options={zones} value={value.timeZoneId} disabled={disabled} onChange={timeZoneId => onChange({ ...value, timeZoneId })} /></FormField></div>
    <div className="space-y-3 border-t border-[var(--color-border)] pt-3"><p className="text-sm font-medium">{t("exceptions")}</p>
      {!value.exceptions.length ? <p className="text-xs text-[var(--color-content-muted)]">{t("noExceptions")}</p> : value.exceptions.map(item => <div key={item.date} className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">{shownDate(item.date)} · {t(item.status)}{item.status === "open" ? ` · ${item.periods.map(period => `${period.start}–${period.end}${period.nextDay ? " (+1)" : ""}`).join(", ")}` : ""}</p>
        {editable ? <div className="flex items-center gap-2"><Button variant="muted-link" disabled={locked} onClick={() => setSpecial(structuredClone(item))}>{t("editDate")}</Button><IconButton label={t("removeDate", { date: shownDate(item.date) })} size="icon-sm" disabled={locked} onClick={() => onChange({ ...value, exceptions: value.exceptions.filter(previous => previous.date !== item.date) })}><TrashIcon className="size-4" /></IconButton></div> : null}
      </div>)}
      {editable ? <DisabledReason reason={!locked && value.exceptions.length >= 32 ? t("exceptionsLimit", { count: 32 }) : null}><Button variant="outline" disabled={locked || value.exceptions.length >= 32} onClick={() => setSpecial({ date: "", status: "closed", periods: [] })}>{t("addException")}</Button></DisabledReason> : null}
    </div>
  </div>{legacy}
  {special && editable && !locked ? <SpecialDateDialog initial={special} hours={value} onCancel={() => setSpecial(null)} onConfirm={next => { onChange({ ...value, exceptions: [...value.exceptions.filter(item => item.date !== special.date), next].sort((a,b) => a.date.localeCompare(b.date)) }); setSpecial(null); }} /> : null}
  </Surface>;
}
/// The four states go in the shared piece for choosing, like any list (DS1-A, 2026-11-22: «un combo desplegable a elegir las
/// opciones»). A weekday is named by its row («Lunes · Atención»); the state of a special date, by its title («Atención»).
/// Choosing the state it already has changes nothing: a special date would lose its periods.
function OpeningStatusControl({ status, label, disabled, onChange }: { status: OpeningStatus; label: string; disabled: boolean; onChange: (status: OpeningStatus) => void }) {
  const { t } = useTranslation("businessInformation");
  return <Picker label={label} disabled={disabled} value={status} className="w-full sm:w-44"
    options={openingStatuses.map(value => ({ id: value, label: t(value) }))}
    onChange={value => { if (value !== status) onChange(value as OpeningStatus); }} />;
}
/// «Agregar franja» va siempre debajo de las franjas, con la misma forma: con cuatro se apaga con el límite como motivo
/// (`DisabledReason`) y, mientras el editor está bloqueado, sólo se apaga. La papelera aparece en cada franja cuando hay
/// más de una. Sin permiso para editar, ninguno de los dos se muestra.
function OpeningPeriods({ periods, label, editable, disabled, onChange }: { periods: OpeningPeriod[]; label: string; editable: boolean; disabled: boolean; onChange: (periods: OpeningPeriod[]) => void }) {
  const { t } = useTranslation("businessInformation");
  const full = periods.length >= maxPeriods;
  function update(index: number, next: OpeningPeriod) { onChange(periods.map((period,i) => i === index ? next : period)); }
  return <div className="space-y-3">{periods.map((period,index) => <div key={index} className="space-y-1.5">
    <div className="flex min-w-0 items-start gap-2">
      {/* A time is one of 96, every 15 minutes: the Picker, with «Elegir» while there is none and the search inside. */}
      <Picker className="w-24 shrink-0" label={`${label} ${index+1} · ${t("from")}`} disabled={disabled} placeholder={t("chooseTime")} options={times} value={period.start || null} onChange={start => update(index,{ ...period, start })} />
      <span className="pt-1 text-xs text-[var(--color-content-muted)]">–</span>
      <Picker className="w-24 shrink-0" label={`${label} ${index+1} · ${t("to")}`} disabled={disabled} placeholder={t("chooseTime")} options={times} value={period.end || null} onChange={end => update(index,{ ...period, end })} />
      {editable && periods.length > 1 ? <IconButton label={`${t("removePeriod")} · ${label} ${index+1}`} size="icon-sm" disabled={disabled} onClick={() => onChange(periods.filter((_,i) => i !== index))}><TrashIcon className="size-4" /></IconButton> : null}
    </div>
    {period.nextDay || (period.start && period.end && period.end <= period.start) ? <label className="flex items-center gap-2 text-xs text-[var(--color-content-muted)]"><Checkbox disabled={disabled} checked={period.nextDay} onCheckedChange={checked => update(index,{ ...period,nextDay:checked === true })} />{t("nextDay")}</label> : null}
  </div>)}{editable ? <div className="flex"><DisabledReason reason={!disabled && full ? t("periodsLimit", { count: maxPeriods }) : null}><Button variant="muted-link" size="sm" aria-label={`${t("addPeriod")} · ${label}`} disabled={disabled || full} onClick={() => onChange([...periods,emptyPeriod()])}>{t("addPeriod")}</Button></DisabledReason></div> : null}</div>;
}
function SpecialDateDialog({ initial, hours, onCancel, onConfirm }: { initial: SpecialDate; hours: Props["value"]; onCancel: () => void; onConfirm: (value: SpecialDate) => void }) {
  const { t } = useTranslation("businessInformation");
  const restore = useRestoreFocusOnClose();
  const [value,setValue] = useState(initial);
  // Confirmar valida al tocarlo; después del primer intento, los errores siguen en vivo mientras se corrigen.
  const [attempted,setAttempted] = useState(false);
  const dateId = useId();
  const statusId = useId();
  const periodsId = useId();
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
  // Sin leyenda debajo del título: el diálogo se explica con sus campos. Cada parte lleva su etiqueta, como la fecha
  // (lista de chequeo, 2026-11-11): «Atención» es el estado y «Horario», el grupo de sus franjas, con su problema debajo.
  return <Dialog open onOpenChange={open => { if (!open) onCancel(); }}><DialogContent aria-describedby={undefined} onCloseAutoFocus={restore}>
    <DialogHeader><DialogTitle>{t("specialTitle")}</DialogTitle></DialogHeader>
    <FormField label={t("specialDate")} error={shown.date ? t(shown.date) : undefined}><Input id={dateId} type="date" min="1900-01-01" max="9998-12-31" value={value.date} onChange={event => setValue({ ...value,date:event.target.value })} /></FormField>
    <div className="flex flex-col items-start gap-1.5"><GroupLabel id={statusId}>{t("attention")}</GroupLabel>
      <OpeningStatusControl status={value.status} label={t("attention")} disabled={false} onChange={status => setValue({ ...value,status,periods:status === "open" ? [emptyPeriod()] : [] })} /></div>
    {value.status === "open" ? <FormField label={t("specialPeriods")} htmlFor={periodsId} error={shown.periods ? t(shown.periods) : undefined}>
      <div role="group" aria-labelledby={`${periodsId}-label`}><OpeningPeriods periods={value.periods} label={t("specialDate")} editable disabled={false} onChange={periods => setValue({ ...value,periods })} /></div>
    </FormField> : null}
    <DialogFooter><Button variant="outline" onClick={onCancel}>{t("cancel")}</Button><Button onClick={confirm}>{t("confirmDate")}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
