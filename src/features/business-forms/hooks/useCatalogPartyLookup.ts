import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { readErrorMessage } from "@/shared/api/errorFeedback";
import { notify } from "@/shared/ui/notifications";
import { fetchCatalogItems, lookupCatalogParty } from "../api/catalogs";
import type { CatalogLookupResult } from "../api/catalogResponse";
import type { CatalogFieldDraft } from "../catalogFields";
import type { CatalogManualItemValue } from "../catalogItemEdits";
import { catalogLookupFailure, catalogLookupOptionIds, taxIdProblem, withCatalogLookup } from "../catalogPartyLookup";
import type { FormCulture } from "../model";

/** The registry that completes the catalog (CA1), as the page passes it to the option editor: its name in the menu language and
 *  the saved field that holds the tax id. */
export interface CatalogLookupOffer { readonly catalogId: string; readonly name: string; readonly fieldId: string }

interface LookupRun {
  /** The option as it is when the answer arrives: the person may keep typing while the registry answers. */
  readonly latest: () => CatalogManualItemValue;
  readonly fields: readonly CatalogFieldDraft[];
  /** The language the texts are edited in, and the one typed values are written in. */
  readonly culture: FormCulture; readonly valueCulture: FormCulture;
  readonly onChange: (item: CatalogManualItemValue) => void;
}

/**
 * «Completar con …» in the option editor. A wrong tax id is said next to its field and never leaves the page; a right one asks the
 * registry, outside any cache and without retrying, and its answer fills the option (nothing is saved). If the registry does not
 * know it or does not answer, the notice says so and the option is completed by hand. Closing the option cancels the question.
 */
export function useCatalogPartyLookup(offer: CatalogLookupOffer | undefined) {
  const { t } = useTranslation("forms");
  const feedbackId = "catalogs:lookup:" + useId();
  const [working, setWorking] = useState(false);
  // The tax id a message was given for: it goes away as soon as the tax id is edited.
  const [problem, setProblem] = useState<{ readonly taxId: string; readonly message: string } | null>(null);
  const operation = useRef<AbortController | null>(null);
  useEffect(() => () => { operation.current?.abort(); operation.current = null; }, []);
  const run = async ({ latest, fields, culture, valueCulture, onChange }: LookupRun) => {
    const field = offer ? fields.find(candidate => candidate.isActive && candidate.id?.toLowerCase() === offer.fieldId.toLowerCase()) : undefined;
    if (!offer || !field?.id || operation.current) return;
    const taxId = latest().fields?.[field.id] ?? "";
    const invalid = taxIdProblem(taxId);
    if (invalid) { setProblem({ taxId, message: t("catalogs.lookup.taxId." + invalid) }); return; }
    setProblem(null);
    const controller = new AbortController();
    operation.current = controller;
    setWorking(true);
    try {
      const result = await lookupCatalogParty(offer.catalogId, taxId, controller.signal);
      if (controller.signal.aborted) return;
      if (result.failureCode !== null) {
        const failure = catalogLookupFailure(result.failureCode);
        if (failure === "taxId") setProblem({ taxId, message: t("catalogs.lookup.taxId.checkDigit") });
        else notify({ id: feedbackId, kind: "warning", message: failure === "notFound" ? t("catalogs.lookup.notFound", { name: offer.name }) : failure === "unavailable" ? t("catalogs.lookup.unavailable", { name: offer.name }) : result.failureMessage ?? t("common:states.error"),
          description: failure === "unavailable" ? t("catalogs.lookup.unavailableHint") : undefined });
        return;
      }
      const texts = await optionTexts(result, fields, controller.signal);
      if (controller.signal.aborted) return;
      onChange(withCatalogLookup(latest(), result, fields, culture, valueCulture, texts));
      notify({ id: feedbackId, kind: "success", message: t("catalogs.lookup.done", { name: offer.name }) });
    } catch (error) {
      if (!controller.signal.aborted) notify({ id: feedbackId, kind: "error", message: readErrorMessage(error, t) });
    } finally {
      if (operation.current === controller) { operation.current = null; setWorking(false); }
    }
  };
  return { working, problem, run };
}

// The names of the options a catalog field got, so it shows them as if chosen by hand. Without them, the field finds the option
// among the first ones of its source.
async function optionTexts(result: CatalogLookupResult, fields: readonly CatalogFieldDraft[], signal: AbortSignal) {
  const texts: Record<string, Record<string, string>> = {};
  for (const [source, ids] of catalogLookupOptionIds(result, fields)) {
    try {
      const page = await fetchCatalogItems(source, { page: 1, pageSize: ids.length, ids }, signal);
      for (const option of page.items) texts[option.id.toLowerCase()] = Object.fromEntries(Object.entries(option.text).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
    } catch {
      if (signal.aborted) break;
    }
  }
  return texts;
}
