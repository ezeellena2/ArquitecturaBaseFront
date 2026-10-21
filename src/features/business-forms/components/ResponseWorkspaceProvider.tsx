import { useCallback, useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import { PrivateFormFilesScopeProvider } from "@/shared/hooks/PrivateFormFilesScope";
import { ResponseWorkspaceContext, type ResponseFullEntry, type ResponseNavigationContext } from "../hooks/useResponseWorkspace";
import type { ResponseFilter } from "../responses";
export function ResponseWorkspaceProvider({
  owner,
  formId,
  children,
}: {
  owner: string;
  formId?: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<{
    owner: string;
    fullEntry: ResponseFullEntry | null;
    formId: string;
    filter: ResponseFilter;
    denied: boolean;
    navigation: (ResponseNavigationContext & { formId: string }) | null;
  }>({ owner, formId: "", filter: {}, denied: false, navigation: null, fullEntry: null });
  const location = useLocation();
  const activeForm = formId ?? /^\/formularios\/([^/]+)\/respuestas(?:\/|$)/.exec(
    location.pathname,
  )?.[1];
  if (state.formId && state.formId !== activeForm || state.navigation && state.navigation.formId !== activeForm || state.fullEntry && state.fullEntry.formId !== activeForm)
    setState({ ...state, formId: "", filter: {}, navigation: null, fullEntry: null });
  if (state.owner !== owner)
    setState({ owner, formId: "", filter: {}, denied: false, navigation: null, fullEntry: null });
  const deny = useCallback(
    () =>
      setState((previous) =>
        previous.owner === owner && !previous.denied
          ? { owner, formId: "", filter: {}, denied: true, navigation: null, fullEntry: null }
          : previous,
      ),
    [owner],
  );
  return (
    <PrivateFormFilesScopeProvider scope={activeForm && !state.denied ? `${owner}:${activeForm}` : null}>
    <ResponseWorkspaceContext.Provider
      value={{
        fullEntry: state.owner === owner ? state.fullEntry : null,
        prepareFull: (formId, recordId) => setState(previous => previous.owner === owner && !(previous.fullEntry?.formId === formId && previous.fullEntry.recordId === recordId && previous.fullEntry.locationKey === null) ? { ...previous, fullEntry: { formId, recordId, locationKey: null } } : previous),
        enterFull: (formId, recordId, locationKey, search) => setState(previous => {
          if (previous.owner !== owner) return previous;
          const entry = previous.fullEntry;
          const internal = entry?.formId === formId && entry.recordId === recordId && (entry.locationKey === null || entry.locationKey === locationKey);
          if (internal && entry.locationKey === locationKey) return previous;
          return { ...previous, formId, filter: internal ? previous.filter : {},
            navigation: internal && previous.navigation ? previous.navigation : { formId, origin: "sheet", selection: { recordId }, search },
            fullEntry: { formId, recordId, locationKey } };
        }),
        finishFull: () => setState(previous => previous.fullEntry ? { ...previous, fullEntry: null } : previous),
        denied: state.owner === owner && state.denied,
        deny,
        formId: state.owner === owner ? state.formId : "",
        filter: state.owner === owner ? state.filter : {},
        navigation: state.owner === owner ? state.navigation : null,
        setNavigation: (formId, navigation) => setState(previous => previous.owner === owner ? { ...previous, navigation: navigation ? { ...navigation, formId } : null } : previous),
        setFilter: (formId, filter) =>
          setState((previous) =>
            previous.owner === owner
              ? { ...previous, formId, filter }
              : previous,
          ),
      }}
    >
      {children}
    </ResponseWorkspaceContext.Provider>
    </PrivateFormFilesScopeProvider>
  );
}
