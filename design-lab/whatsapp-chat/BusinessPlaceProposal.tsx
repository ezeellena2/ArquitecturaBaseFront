import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { googleMapsPlaceLink, googleMapsSearchUrl } from "./businessPlaceModel";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FormField } from "@/shared/ui/FormField";
import { CheckIcon, SearchIcon } from "@/shared/ui/icons";
import { Input } from "@/shared/ui/input";
import { notify } from "@/shared/ui/notifications";
import { Page } from "@/shared/ui/Page";
import { Surface } from "@/shared/ui/Surface";

const emptyPlace = { link: "", name: "", address: "", reference: "" };

// This proposed UI never writes to the product API or imports data from Maps.
export function BusinessPlaceProposal() {
  const { t } = useTranslation("businessPlaceProposal");
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState(emptyPlace);
  const [draft, setDraft] = useState(emptyPlace);
  const [touched, setTouched] = useState(false);
  const link = googleMapsPlaceLink(draft.link);
  const searchUrl = googleMapsSearchUrl(search);
  const dirty = Object.keys(emptyPlace).some(key => draft[key as keyof typeof draft] !== saved[key as keyof typeof saved]);
  const invalidLink = draft.link.trim() !== "" && link === null;

  function change(field: keyof typeof draft, value: string) {
    setDraft(current => ({ ...current, [field]: value }));
    if (field === "link") setTouched(false);
  }

  function save(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!link) return;
    const next = { link, name: draft.name.trim(), address: draft.address.trim(), reference: draft.reference.trim() };
    setSaved(next);
    setDraft(next);
    notify({ id: "business-place-proposal-save", kind: "success", message: t("saved") });
  }

  return <Page title={t("title")} status={<span className="text-sm text-[var(--color-content-muted)]">{t(dirty ? "draft" : "proposal")}</span>} actions={<>
    <Button type="button" variant="outline" disabled={!dirty} onClick={() => { setDraft(saved); setTouched(false); }}>{t("discard")}</Button>
    <Button type="submit" form="business-place-proposal" disabled={!dirty || !link}>{t("save")}</Button>
  </>}>
    <div className="@container flex flex-col gap-5">
      <p className="max-w-3xl text-sm text-[var(--color-content-muted)]">{t("intro")}</p>
      <form id="business-place-proposal" onSubmit={save} className="grid min-w-0 items-start gap-5 @min-[780px]:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <Surface title={t("location")} padded>
          <div className="flex flex-wrap items-start gap-2">
            <div className="min-w-0 flex-1 basis-64">
              <FormField label={t("search")} hint={t("searchHelp")}>
                <Input type="search" autoComplete="off" placeholder={t("searchExample")} maxLength={200} value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }} />
              </FormField>
            </div>
            <div className="pt-[21px] max-sm:pt-0">
              {searchUrl ? <Button variant="outline" asChild><a href={searchUrl} target="_blank" rel="noopener noreferrer"><SearchIcon />{t("searchAction")}</a></Button>
                : <Button type="button" variant="outline" disabled><SearchIcon />{t("searchAction")}</Button>}
            </div>
          </div>
          <p className="text-sm text-[var(--color-content-muted)]">{t("searchNote")}</p>
          <div className="border-t border-[var(--color-border)] pt-4">
            <FormField label={t("link")} hint={t("linkHelp")} error={touched && invalidLink ? t("linkError") : undefined}>
              <Input type="url" autoComplete="off" placeholder={t("linkExample")} maxLength={4096} value={draft.link} onChange={event => change("link", event.target.value)} onBlur={() => setTouched(true)} />
            </FormField>
          </div>
          {link ? <div><Button variant="outline" asChild><a href={link} target="_blank" rel="noopener noreferrer">{t("check")}</a></Button></div> : null}
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <FormField label={t("name")} hint={t("nameHelp")}><Input placeholder={t("nameExample")} maxLength={200} value={draft.name} onChange={event => change("name", event.target.value)} /></FormField>
            <FormField label={t("address")} hint={t("addressHelp")}><Input placeholder={t("addressExample")} maxLength={500} value={draft.address} onChange={event => change("address", event.target.value)} /></FormField>
          </div>
          <FormField label={t("reference")}><Input placeholder={t("referenceExample")} maxLength={500} value={draft.reference} onChange={event => change("reference", event.target.value)} /></FormField>
        </Surface>
        <Surface title={t("preview")} padded>
          {link ? <div className="flex min-w-0 flex-col items-start gap-4">
            <p className="inline-flex items-center gap-2 text-sm text-[var(--color-content-muted)]"><CheckIcon className="size-4" />{t("confirmed")}</p>
            <div className="flex min-w-0 flex-col gap-2">
              <h3 className="break-words text-lg font-semibold">{draft.name.trim() || t("previewLabel")}</h3>
              {draft.address.trim() ? <p className="break-words text-sm">{draft.address.trim()}</p> : null}
              {draft.reference.trim() ? <p className="break-words text-sm text-[var(--color-content-muted)]">{draft.reference.trim()}</p> : null}
            </div>
            <Button variant="outline" asChild><a href={link} target="_blank" rel="noopener noreferrer">{t("previewAction")}</a></Button>
            <p className="text-sm text-[var(--color-content-muted)]">{t("exactLink")}</p>
          </div> : <EmptyState embedded title={t("previewEmpty")} description={t("previewHelp")} />}
        </Surface>
      </form>
      <p className="max-w-3xl text-sm text-[var(--color-content-muted)]">{t("limits")}</p>
    </div>
  </Page>;
}
