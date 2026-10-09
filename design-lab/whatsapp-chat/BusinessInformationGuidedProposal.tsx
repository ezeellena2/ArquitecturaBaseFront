import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/FormField";
import { IconButton } from "@/shared/ui/IconButton";
import { ChevronDownIcon, PlusIcon, TrashIcon } from "@/shared/ui/icons";
import { Input } from "@/shared/ui/input";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { notify } from "@/shared/ui/notifications";
import { Page } from "@/shared/ui/Page";
import { Surface } from "@/shared/ui/Surface";
import { Textarea } from "@/shared/ui/textarea";
import { confirmedFaq, emptyPeriod, mapLink, timeOptions, validateHours, type FaqEntry, type LocationPoint, type OpeningDay, type OpeningPeriod } from "./businessGuidedModel";

const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const presets = ["booking", "payment", "delivery", "quote", "returns", "parking"] as const;
const examplePoints: LocationPoint[] = [{ latitude: -34.6037, longitude: -58.3816 }, { latitude: -34.6051, longitude: -58.3832 }];
interface SpecialDate { date: string; opening: OpeningDay }
interface Information {
  name: string; description: string; locationType: "local" | "area" | "both"; address: string; reference: string; area: string;
  point: LocationPoint | null; days: OpeningDay[]; exceptions: SpecialDate[]; services: string; policies: string; faq: FaqEntry[];
}
const blankDay = (weekday: number): OpeningDay => ({ weekday, status: "unknown", periods: [] });

// Local proposal only. No Maps SDK, location service, API or storage is used.
export function BusinessInformationGuidedProposal() {
  const { t } = useTranslation("businessGuidedProposal");
  const sample = (): Information => ({
    name: t("sampleName"),
    description: t("sampleDescription"), locationType: "both", address: t("sampleAddress"), reference: "", area: t("sampleArea"), point: examplePoints[0],
    days: weekdays.map((_, weekday) => ({ weekday, status: weekday === 6 ? "closed" : "open", periods: weekday === 6 ? [] : [{ start: "09:00", end: weekday === 5 ? "13:00" : "18:00", nextDay: false }] })),
    exceptions: [], services: "", policies: "", faq: [{ id: "booking", question: t("presets.booking"), answer: "" }, { id: "payment", question: t("presets.payment"), answer: "" }],
  });
  const [baseline, setBaseline] = useState(sample);
  const [draft, setDraft] = useState(sample);
  const [nameError, setNameError] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [candidate, setCandidate] = useState<number | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<string | null>("booking");
  const [exceptionOpen, setExceptionOpen] = useState(false);
  const [specialDate, setSpecialDate] = useState<SpecialDate>({ date: "", opening: { weekday: 0, status: "closed", periods: [] } });
  const [discardOpen, setDiscardOpen] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const guard = useUnsavedChangesGuard(dirty);
  const hoursError = validateHours(draft.days);
  const exceptionError = validateHours([specialDate.opening]);
  const addresses = [t("sampleAddress"), t("secondAddress")];
  function change<K extends keyof Information>(key: K, value: Information[K]) { setDraft(previous => ({ ...previous, [key]: value })); }
  function changeDay(weekday: number, update: Partial<OpeningDay>) {
    change("days", draft.days.map(day => day.weekday === weekday ? { ...day, ...update } : day));
  }
  function changeFaq(id: string, update: Partial<FaqEntry>) { change("faq", draft.faq.map(entry => entry.id === id ? { ...entry, ...update } : entry)); }
  function addQuestion(question: string) {
    const id = crypto.randomUUID();
    change("faq", [...draft.faq, { id, question, answer: "" }]); setExpandedFaq(id);
  }
  function save() {
    setNameError(!draft.name.trim());
    if (!draft.name.trim() || hoursError) return;
    setBaseline(structuredClone(draft));
    notify({ id: "guided-business-save", kind: "success", message: t("saved") });
  }
  function discard() { setDraft(structuredClone(baseline)); setNameError(false); setDiscardOpen(false); }
  function periodEditor(period: OpeningPeriod, label: string, update: (value: OpeningPeriod) => void, remove?: () => void) {
    return <div className="min-w-0 space-y-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <NativeSelect aria-label={`${label} · ${t("from")}`} value={period.start} onChange={event => update({ ...period, start: event.target.value })} className="w-20 shrink-0"><option value="">{t("chooseTime")}</option>{timeOptions.map(value => <option key={value}>{value}</option>)}</NativeSelect>
        <span className="text-xs text-[var(--color-content-muted)]">–</span>
        <NativeSelect aria-label={`${label} · ${t("to")}`} value={period.end} onChange={event => update({ ...period, end: event.target.value })} className="w-20 shrink-0"><option value="">{t("chooseTime")}</option>{timeOptions.map(value => <option key={value}>{value}</option>)}</NativeSelect>
        {remove ? <IconButton label={`${t("removePeriod")} · ${label}`} size="icon-sm" onClick={remove}><TrashIcon className="size-4" /></IconButton> : null}
      </div>
      {period.nextDay || (period.start && period.end && period.end <= period.start) ? <label className="flex items-center gap-2 text-xs text-[var(--color-content-muted)]"><Checkbox checked={period.nextDay} onCheckedChange={checked => update({ ...period, nextDay: checked === true })} />{t("nextDay")}</label> : null}
    </div>;
  }
  function statusSelect(day: OpeningDay, label: string, update: (day: OpeningDay) => void) {
    return <NativeSelect aria-label={`${label} · ${t("attention")}`} value={day.status} onChange={event => {
      const status = event.target.value as OpeningDay["status"];
      update({ ...day, status, periods: status === "open" && !day.periods.length ? [emptyPeriod()] : day.periods });
    }}><option value="unknown">{t("unknown")}</option><option value="open">{t("open")}</option><option value="closed">{t("closed")}</option><option value="allDay">{t("allDay")}</option></NativeSelect>;
  }

  return <Page title={t("title")} status={dirty ? <span className="text-sm text-[var(--color-content-muted)]">{t("dirty")}</span> : undefined}
    actions={<><Button variant="outline" disabled={!dirty} onClick={() => setDiscardOpen(true)}>{t("discard")}</Button><Button disabled={!dirty} onClick={save}>{t("save")}</Button></>}>
    <div className="flex flex-col gap-5">
      <p className="text-xs text-[var(--color-content-muted)]">{t("lab")}</p>
      <Surface title={t("basics")} padded><div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t("name")} hint={t("nameHint")} required error={nameError ? t("nameRequired") : undefined}><Input value={draft.name} maxLength={120} onChange={event => { change("name", event.target.value); setNameError(false); }} /></FormField>
        <FormField label={t("description")}><Textarea value={draft.description} rows={2} maxLength={1000} onChange={event => change("description", event.target.value)} /></FormField>
      </div></Surface>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Surface title={t("locationSection")} padded>
          <FormField label={t("locationType")}><NativeSelect value={draft.locationType} onChange={event => change("locationType", event.target.value as Information["locationType"])}>{["local", "area", "both"].map(value => <option key={value} value={value}>{t(value)}</option>)}</NativeSelect></FormField>
          {draft.locationType !== "area" ? <>
            <FormField label={t("address")} hint={t("addressHint")}><Input value={draft.address} onChange={event => change("address", event.target.value)} maxLength={500} /></FormField>
            <IllustrativeMap selected={draft.point !== null} />
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-[var(--color-content-muted)]">{t(draft.point ? "pointChosen" : "noPoint")}</p><Button variant="outline" onClick={() => { setCandidate(null); setSearch(""); setMapOpen(true); }}>{t(draft.point ? "changeMap" : "chooseMap")}</Button></div>
            <FormField label={t("locationLink")} hint={t("locationLinkHint")}><Input type="url" value={draft.point ? mapLink(draft.point) : ""} readOnly /></FormField>
            {draft.point ? <a href={mapLink(draft.point)} target="_blank" rel="noreferrer" className="text-sm text-[var(--color-brand-600)] underline underline-offset-2">{t("openLocation")}</a> : null}
            <FormField label={t("reference")}><Input value={draft.reference} placeholder={t("referencePlaceholder")} onChange={event => change("reference", event.target.value)} maxLength={500} /></FormField>
          </> : null}
          {draft.locationType !== "local" ? <FormField label={t("serviceArea")}><Textarea rows={2} value={draft.area} placeholder={t("serviceAreaPlaceholder")} onChange={event => change("area", event.target.value)} maxLength={500} /></FormField> : null}
        </Surface>
        <Surface title={t("hoursSection")} padded><div className="@container space-y-4">
          <p className="text-sm text-[var(--color-content-muted)]">{t("hoursHint")}</p>
          <div className="divide-y divide-[var(--color-border)]">
            {draft.days.map(day => <div key={day.weekday} className="grid grid-cols-[minmax(0,1fr)_112px] items-start gap-2 py-3 @min-[424px]:grid-cols-[88px_96px_minmax(0,1fr)]">
              <p className="pt-1.5 text-sm font-medium">{t(`days.${weekdays[day.weekday]}`)}</p>
              {statusSelect(day, t(`days.${weekdays[day.weekday]}`), value => changeDay(day.weekday, value))}
              {day.status === "open" ? <div className="col-span-2 space-y-3 @min-[424px]:col-span-1">
                {day.periods.map((period, index) => <div key={index} className="flex min-w-0 items-start gap-2">{periodEditor(period, `${t(`days.${weekdays[day.weekday]}`)} ${index + 1}`, value => changeDay(day.weekday, { periods: day.periods.map((previous, i) => i === index ? value : previous) }), day.periods.length > 1 ? () => changeDay(day.weekday, { periods: day.periods.filter((_, i) => i !== index) }) : undefined)}
                  {day.periods.length === 1 ? <IconButton label={`${t("addPeriod")} · ${t(`days.${weekdays[day.weekday]}`)}`} size="icon-sm" onClick={() => changeDay(day.weekday, { periods: [...day.periods, emptyPeriod()] })}><PlusIcon className="size-4" /></IconButton> : null}
                </div>)}
                {day.periods.length > 1 ? <Button variant="muted-link" size="sm" onClick={() => changeDay(day.weekday, { periods: [...day.periods, emptyPeriod()] })}>{t("addPeriod")}</Button> : null}
              </div> : null}
            </div>)}
          </div>
          {hoursError ? <p role="alert" className="text-sm text-[var(--color-danger)]">{t(`hourErrors.${hoursError}`)}</p> : null}
          <Button variant="outline" onClick={() => {
            change("days", draft.days.map(day => day.weekday < 5 ? { ...structuredClone(draft.days[0]), weekday: day.weekday } : day));
            notify({ id: "guided-business-hours-copy", kind: "info", message: t("copyDone") });
          }}>{t("copyWeek")}</Button>
          <p className="text-xs text-[var(--color-content-muted)]">{t("timeZone")}</p>
          <div className="space-y-3 border-t border-[var(--color-border)] pt-3">
            <p className="text-sm font-medium">{t("exceptions")}</p>
            {!draft.exceptions.length ? <p className="text-xs text-[var(--color-content-muted)]">{t("noExceptions")}</p> : draft.exceptions.map(item => <div key={item.date} className="flex items-center justify-between gap-2 text-sm"><span>{item.date} · {t(item.opening.status)} {item.opening.status === "open" ? item.opening.periods.map(period => `${period.start}–${period.end}`).join(", ") : ""}</span><IconButton label={`${t("removeException")} ${item.date}`} onClick={() => change("exceptions", draft.exceptions.filter(previous => previous.date !== item.date))}><TrashIcon className="size-4" /></IconButton></div>)}
            <Button variant="outline" onClick={() => { setSpecialDate({ date: "", opening: { ...blankDay(0), status: "closed" } }); setExceptionOpen(true); }}>{t("addException")}</Button>
          </div>
        </div></Surface>
      </div>
      <Surface title={t("offering")} padded><div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t("services")}><Textarea value={draft.services} rows={2} placeholder={t("servicesPlaceholder")} maxLength={2000} onChange={event => change("services", event.target.value)} /></FormField>
        <FormField label={t("policies")}><Textarea value={draft.policies} rows={2} placeholder={t("policiesPlaceholder")} maxLength={2000} onChange={event => change("policies", event.target.value)} /></FormField>
      </div></Surface>
      <Surface title={t("faqSection")} padded>
        <p className="max-w-3xl text-sm text-[var(--color-content-muted)]">{t("faqHint")}</p>
        <div className="flex flex-wrap items-end gap-3"><div className="w-96 max-w-full"><FormField label={t("preset")}><NativeSelect value="" onChange={event => { if (event.target.value) addQuestion(t(`presets.${event.target.value}`)); }}><option value="">{t("chooseQuestion")}</option>{presets.filter(preset => !draft.faq.some(entry => entry.question === t(`presets.${preset}`))).map(preset => <option key={preset} value={preset}>{t(`presets.${preset}`)}</option>)}</NativeSelect></FormField></div><Button variant="outline" onClick={() => addQuestion("")}>{t("customQuestion")}</Button></div>
        <div className="divide-y divide-[var(--color-border)] rounded-[var(--radius-control)] border border-[var(--color-border)]">
          {!draft.faq.length ? <p className="p-3 text-sm text-[var(--color-content-muted)]">{t("noFaq")}</p> : draft.faq.map(entry => <div key={entry.id}>
            <div className="flex items-center gap-2 px-3 py-2"><button type="button" aria-expanded={expandedFaq === entry.id} aria-controls={`faq-${entry.id}`} className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm" onClick={() => setExpandedFaq(expandedFaq === entry.id ? null : entry.id)}><ChevronDownIcon className={`size-4 shrink-0 ${expandedFaq === entry.id ? "" : "-rotate-90"}`} /><span className="min-w-0 break-words font-medium">{entry.question || t("question")}</span></button><span className="text-xs text-[var(--color-content-muted)]">{t(entry.answer.trim() && entry.question.trim() ? "ready" : "noAnswer")}</span><IconButton label={`${t("removeQuestion")} · ${entry.question || t("question")}`} size="icon-sm" onClick={() => change("faq", draft.faq.filter(previous => previous.id !== entry.id))}><TrashIcon className="size-4" /></IconButton></div>
            {expandedFaq === entry.id ? <div id={`faq-${entry.id}`} className="grid gap-3 px-3 pb-4 md:grid-cols-2"><FormField label={t("question")}><Input value={entry.question} maxLength={300} onChange={event => changeFaq(entry.id, { question: event.target.value })} /></FormField><FormField label={t("answer")}><Textarea rows={2} value={entry.answer} maxLength={1000} placeholder={t("answerPlaceholder")} onChange={event => changeFaq(entry.id, { answer: event.target.value })} /></FormField></div> : null}
          </div>)}
        </div>
        <div className="flex flex-wrap justify-between gap-2 text-xs text-[var(--color-content-muted)]"><p>{t("faqUseHint")}</p><p>{t("faqCount", { count: confirmedFaq(draft.faq).length })}</p></div>
      </Surface>
    </div>

    <Dialog open={mapOpen} onOpenChange={setMapOpen}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>{t("mapTitle")}</DialogTitle><DialogDescription>{t("pointHint")}</DialogDescription></DialogHeader>
      <FormField label={t("searchAddress")} hint={t("mapSearchHint")}><Input value={search} placeholder={t("searchPlaceholder")} onChange={event => setSearch(event.target.value)} /></FormField>
      <div role="group" aria-label={t("searchResults")} className="grid gap-2">{addresses.map((address, index) => !search || address.toLocaleLowerCase().includes(search.toLocaleLowerCase()) ? <Button key={address} variant="outline" aria-pressed={candidate === index} className="h-auto min-h-[var(--height-control)] justify-start whitespace-normal text-left" onClick={() => setCandidate(index)}>{address}</Button> : null)}</div>
      <IllustrativeMap selected={candidate !== null} shifted={candidate === 1} onSelect={() => setCandidate(candidate === 0 ? 1 : 0)} />
      <p className="break-words text-sm">{candidate === null ? t("noPoint") : addresses[candidate]}</p>
      {candidate !== null ? <p className="break-all text-xs text-[var(--color-content-muted)]">{mapLink(examplePoints[candidate])}</p> : null}
      <DialogFooter><Button variant="outline" onClick={() => setMapOpen(false)}>{t("cancel")}</Button><Button disabled={candidate === null} onClick={() => { if (candidate === null) return; change("point", examplePoints[candidate]); change("address", addresses[candidate]); setMapOpen(false); }}>{t("useLocation")}</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={exceptionOpen} onOpenChange={setExceptionOpen}><DialogContent><DialogHeader><DialogTitle>{t("exceptionTitle")}</DialogTitle></DialogHeader>
      <FormField label={t("date")}><Input type="date" value={specialDate.date} onChange={event => setSpecialDate(previous => ({ ...previous, date: event.target.value }))} /></FormField>
      <FormField label={t("attention")}>{statusSelect(specialDate.opening, t("date"), opening => setSpecialDate(previous => ({ ...previous, opening })))}</FormField>
      {specialDate.opening.status === "open" ? periodEditor(specialDate.opening.periods[0], t("date"), value => setSpecialDate(previous => ({ ...previous, opening: { ...previous.opening, periods: [value] } }))) : null}
      {exceptionError ? <p role="alert" className="text-sm text-[var(--color-danger)]">{t(`hourErrors.${exceptionError}`)}</p> : null}
      <DialogFooter><Button variant="outline" onClick={() => setExceptionOpen(false)}>{t("cancel")}</Button><Button disabled={!specialDate.date || !!exceptionError || specialDate.opening.status === "unknown"} onClick={() => { change("exceptions", [...draft.exceptions.filter(item => item.date !== specialDate.date), structuredClone(specialDate)].sort((a, b) => a.date.localeCompare(b.date))); setExceptionOpen(false); }}>{t("add")}</Button></DialogFooter>
    </DialogContent></Dialog>
    <ConfirmDialog open={discardOpen} onOpenChange={setDiscardOpen} title={t("leaveTitle")} description={t("leaveHint")} confirmLabel={t("discard")} onConfirm={discard} />
    <ConfirmDialog open={guard.isBlocked} onOpenChange={open => { if (!open) guard.stay(); }} title={t("leaveTitle")} description={t("leaveHint")} confirmLabel={t("discard")} cancelLabel={t("stay")} onConfirm={guard.leave} />
  </Page>;
}

function IllustrativeMap({ selected, shifted = false, onSelect }: { selected: boolean; shifted?: boolean; onSelect?: () => void }) {
  const { t } = useTranslation("businessGuidedProposal");
  // Diagram of streets, not map tiles or geocoding. The two points are fictional fixture selections.
  return <div className="relative h-40 overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-muted)]">
    <div aria-hidden="true" className="absolute inset-0" style={{ backgroundImage: "linear-gradient(90deg, transparent 47%, var(--color-surface) 47%, var(--color-surface) 53%, transparent 53%), linear-gradient(0deg, transparent 42%, var(--color-surface) 42%, var(--color-surface) 56%, transparent 56%)", backgroundSize: "140px 90px" }} />
    <div aria-hidden="true" className="absolute top-0 bottom-0 left-2/3 w-12 -rotate-12 border-x border-[var(--color-border)] bg-[var(--color-table-section)]" />
    {selected ? <div aria-hidden="true" className={`absolute top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-full -rotate-45 rounded-[50%_50%_50%_0] border-2 border-white bg-[var(--color-brand-600)] shadow-sm ${shifted ? "left-[70%]" : "left-1/2"}`}><div className="absolute top-1.5 left-1.5 h-2 w-2 rounded-full bg-white" /></div> : null}
    {onSelect ? <button type="button" aria-label={t("selectPoint")} className="absolute inset-0 cursor-crosshair" onClick={onSelect} /> : null}
    <p className="absolute right-0 bottom-0 left-0 bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-content-muted)]">{t("mapHint")}</p>
  </div>;
}
