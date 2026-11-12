import { useEffect, useMemo } from "react";
import { receivedDocumentForbidden, useReceivedDocumentMenuCounts } from "@/features/business-forms/hooks/useReceivedDocuments";
import type { FormsNavigationCount } from "@/layouts/formsOverviewNavigation";

/** The number of «Documentos recibidos» in the menu (DOC5-A): the documents that wait for someone of the team. */
export function ReceivedDocumentsCount({ onState }: { onState: (value: FormsNavigationCount) => void }) {
  const query = useReceivedDocumentMenuCounts();
  const { refetch } = query;
  const denied = receivedDocumentForbidden(query.error);
  // Reintentar goes back to the menu's skeleton until the number arrives, as the one of «Formularios».
  const retrying = query.isError && query.isFetching;
  const value = useMemo(() => ({ count: denied ? undefined : query.data?.total, pending: query.isPending || retrying,
    failed: query.isError && !denied, retry: () => { void refetch(); } }), [denied, query.data, query.isPending, retrying, query.isError, refetch]);
  useEffect(() => onState(value), [onState, value]);
  return null;
}
