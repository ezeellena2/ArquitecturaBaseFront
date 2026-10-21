import { useCallback, useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import { PrivateFormFilesScopeProvider } from "@/shared/hooks/PrivateFormFilesScope";
import { ResponseWorkspaceContext, type ResponseNavigationContext } from "../hooks/useResponseWorkspace";
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
    formId: string;
    filter: ResponseFilter;
    denied: boolean;
    navigation: (ResponseNavigationContext & { formId: string }) | null;
  }>({ owner, formId: "", filter: {}, denied: false, navigation: null });
  const location = useLocation();
  const activeForm = formId ?? /^\/formularios\/([^/]+)\/respuestas(?:\/|$)/.exec(
    location.pathname,
  )?.[1];
  if (state.formId && state.formId !== activeForm || state.navigation && state.navigation.formId !== activeForm)
    setState({ ...state, formId: "", filter: {}, navigation: null });
  if (state.owner !== owner)
    setState({ owner, formId: "", filter: {}, denied: false, navigation: null });
  const deny = useCallback(
    () =>
      setState((previous) =>
        previous.owner === owner && !previous.denied
          ? { owner, formId: "", filter: {}, denied: true, navigation: null }
          : previous,
      ),
    [owner],
  );
  return (
    <PrivateFormFilesScopeProvider scope={activeForm && !state.denied ? `${owner}:${activeForm}` : null}>
    <ResponseWorkspaceContext.Provider
      value={{
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
