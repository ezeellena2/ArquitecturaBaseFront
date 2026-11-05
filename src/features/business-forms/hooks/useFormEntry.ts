import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { fetchFormEntry, fetchFormEntryCorrection, fetchFormEntryOptions, submitFormEntry, submitFormEntryCorrection, type FormEntry, type FormEntrySubmitted } from "../api/entries";
import { correctionSignature, entrySignature, keptFileIds, toEntrySend, type EntryDraft } from "../entryForm";

/** The response being corrected (CW10-A): its catalog lists are those of whoever answered it. */
export const EntryRecordContext = createContext<string | undefined>(undefined);

/** Who loads: the query keys separate account, language and permissions, so another owner never sees this data. */
export function useFormEntryScope() {
  const { data: user } = useCurrentUser();
  const { i18n } = useTranslation();
  const owner = [user?.id ?? "", i18n.language, [...(user?.permissions ?? [])].sort().join(",")].join(":");
  return { user, owner, canCreate: !!user?.permissions.includes("formrecords.create") };
}

/** The active version to load, read again on each opening: a new version or a deactivation must show at once. */
export function useFormEntry(formId: string) {
  const scope = useFormEntryScope();
  const query = useQuery({
    queryKey: ["form-entry", scope.owner, formId],
    queryFn: ({ signal }) => fetchFormEntry(formId, signal),
    enabled: scope.canCreate && !!formId, gcTime: 0, staleTime: 0, retry: false, meta: { errorOwner: "local" },
  });
  return { scope, query };
}

/**
 * A catalog question's options for the person who loads, fifty at a time, searched in the server; a list that depends on
 * other answers is read for the ones chosen (CW7).
 */
export function useEntryOptions(entry: FormEntry, fieldId: string, search: string, enabled: boolean, answers: Readonly<Record<string, string>> = {}) {
  const { owner } = useFormEntryScope();
  const recordId = useContext(EntryRecordContext);
  return useInfiniteQuery({
    queryKey: ["form-entry-options", owner, entry.definitionId, entry.versionId, fieldId, search, answers, recordId ?? null],
    queryFn: ({ pageParam, signal }) => fetchFormEntryOptions(entry.definitionId, entry.versionId, fieldId, pageParam, search, signal, answers, recordId),
    initialPageParam: 1,
    getNextPageParam: last => last.hasNext ? last.page + 1 : undefined,
    enabled, gcTime: 0, retry: false, meta: { errorOwner: "local" },
  });
}

/**
 * Sends the loaded response. The request keeps its id while it carries the same answers, so repeating it after a cut
 * returns the first result without another number; any change makes another request, and so does the next response
 * once one arrived, even with the same kept answers (AR2-A). Nothing goes to MutationCache.
 */
export function useFormEntrySubmit(formId: string) {
  const last = useRef<{ signature: string; requestId: string } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const submit = useCallback(async (entry: FormEntry, draft: EntryDraft): Promise<FormEntrySubmitted> => {
    const signature = entrySignature(entry, draft);
    if (last.current?.signature !== signature) last.current = { signature, requestId: crypto.randomUUID() };
    setProgress(0);
    try {
      const result = await submitFormEntry(formId, toEntrySend(entry, draft, last.current.requestId), fraction => setProgress(fraction));
      last.current = null;
      return result;
    } finally {
      setProgress(null);
    }
  }, [formId]);
  return { submit, progress, sending: progress !== null };
}

/**
 * What correcting a response opens (CW10-A): the active version with the response as it was, read again on each opening.
 * Whoever loaded it corrects it until it is decided; with «Corregir y anular respuestas», anyone and always: the server says.
 */
export function useEntryCorrection(formId: string, recordId: string) {
  const scope = useFormEntryScope();
  const query = useQuery({
    queryKey: ["form-entry-correction", scope.owner, formId, recordId],
    queryFn: ({ signal }) => fetchFormEntryCorrection(formId, recordId, signal),
    enabled: !!formId && !!recordId, gcTime: 0, staleTime: 0, retry: false, meta: { errorOwner: "local" },
  });
  return { scope, query };
}

/** Sends a correction with its reason and the files that stay; the request keeps its id while it carries the same content. */
export function useFormEntryCorrectionSubmit(formId: string, recordId: string) {
  const last = useRef<{ signature: string; requestId: string } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const submit = useCallback(async (entry: FormEntry, draft: EntryDraft, reason: string): Promise<FormEntrySubmitted> => {
    const signature = correctionSignature(entry, draft, reason);
    if (last.current?.signature !== signature) last.current = { signature, requestId: crypto.randomUUID() };
    setProgress(0);
    try {
      const result = await submitFormEntryCorrection(formId, recordId, toEntrySend(entry, draft, last.current.requestId), reason.trim(),
        keptFileIds(draft), fraction => setProgress(fraction));
      last.current = null;
      return result;
    } finally {
      setProgress(null);
    }
  }, [formId, recordId]);
  return { submit, progress, sending: progress !== null };
}
